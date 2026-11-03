import {
  nearDuplicateKey,
  normalizeKeyword,
  stem,
  STOPWORDS,
  stripDiacritics,
  words,
} from "@/lib/keywords/normalize"
import {
  CATEGORY_PRIORITY,
  INTENT_BY_CATEGORY,
  isModifier,
  SIGNALS,
  type KeywordCategory,
  type KeywordIntent,
} from "@/lib/keywords/signals"

export type Separator = "auto" | "newline" | "comma" | "semicolon" | "tab"
export type LengthGroup = "short" | "medium" | "long"
export type KeywordStatus = "unique" | "duplicate" | "near-duplicate"

/** Hard cap so a pasted export cannot freeze the tab. */
export const MAX_KEYWORDS = 50_000

export interface KeywordRow {
  /** Position in the input (0-based), so nothing is ever reordered away silently. */
  id: number
  original: string
  keyword: string
  wordCount: number
  lengthGroup: LengthGroup
  category: KeywordCategory
  /** Every category whose signal matched; `category` is the highest-priority one. */
  tags: KeywordCategory[]
  intent: KeywordIntent
  status: KeywordStatus
  /** Id of the first row this one duplicates (exactly or nearly). */
  duplicateOf: number | null
  generic: boolean
  topic: string
  action: string
}

export interface KeywordStats {
  /** Entries after splitting, including empty ones. */
  entries: number
  empty: number
  analyzed: number
  /** Entries beyond MAX_KEYWORDS, reported, never dropped silently. */
  overLimit: number
  unique: number
  duplicates: number
  nearDuplicates: number
  generic: number
  byCategory: Partial<Record<KeywordCategory, number>>
  byLength: Record<LengthGroup, number>
}

export interface KeywordTopic {
  name: string
  rowIds: number[]
}

export interface KeywordAnalysis {
  rows: KeywordRow[]
  stats: KeywordStats
  topics: KeywordTopic[]
}

export interface KeywordAnalysisOptions {
  /** Brand names (own and competitors'), matched as whole phrases. */
  brands?: string[]
}

const SPLITTERS: Record<Exclude<Separator, "auto">, RegExp> = {
  newline: /\r?\n/,
  comma: /,/,
  semicolon: /;/,
  tab: /\t/,
}

/**
 * Splits pasted text into entries. "auto" splits by lines; a single line falls back to
 * semicolons or commas. Lines pasted from a spreadsheet keep only their first column.
 */
export function splitKeywordText(text: string, separator: Separator = "auto"): string[] {
  if (separator !== "auto") return text.split(SPLITTERS[separator])
  if (/\r?\n/.test(text.trim()))
    return text.split(/\r?\n/).map((line) => line.split("\t")[0])
  if (text.includes(";")) return text.split(";")
  if (text.includes(",")) return text.split(",")
  return [text]
}

const lengthGroupOf = (count: number): LengthGroup =>
  count <= 1 ? "short" : count <= 3 ? "medium" : "long"

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function brandMatcher(brands: string[]): RegExp | null {
  const cleaned = brands
    .map((b) => stripDiacritics(normalizeKeyword(b)))
    .filter((b) => b.length >= 2)
  if (cleaned.length === 0) return null
  return new RegExp(`(?:^|\\s)(?:${cleaned.map(escapeRegExp).join("|")})(?=$|\\s)`)
}

function categorize(folded: string, wordCount: number, brand: RegExp | null) {
  const tags: KeywordCategory[] = []
  if (brand?.test(folded)) tags.push("brand")
  for (const signal of SIGNALS)
    if (signal.pattern.test(folded)) tags.push(signal.category)
  if (tags.length === 0) tags.push(wordCount <= 1 ? "generic" : "product")
  const category = CATEGORY_PRIORITY.find((c) => tags.includes(c))!
  return { category, tags }
}

const ACTIONS: Record<KeywordCategory, string> = {
  brand: "Osobna kampania brandowa albo wykluczenie w kampaniach ogólnych.",
  navigational: "Sprawdź, czy ktoś nie szuka konkretnej strony; często do wykluczenia.",
  price: "Pasuje do kampanii sprzedażowej; dopasuj komunikat cenowy.",
  location: "Rozważ osobną grupę z kierowaniem na tę lokalizację.",
  transactional: "Dobra kandydatka do kampanii sprzedażowej.",
  research: "Osobna grupa z treścią porównawczą albo niższa stawka.",
  informational: "Rzadko kupuje; osobna grupa z treścią albo wykluczenie.",
  product: "Sprawdź trafność; dodaj modyfikator, jeśli fraza jest zbyt szeroka.",
  generic: "Bardzo ogólna; ostrożnie z dopasowaniem przybliżonym.",
}

/** Analyzes raw entries. Every non-empty entry yields exactly one row, in input order. */
export function analyzeKeywords(
  entries: string[],
  options: KeywordAnalysisOptions = {}
): KeywordAnalysis {
  const brand = brandMatcher(options.brands ?? [])
  const rows: KeywordRow[] = []
  let empty = 0
  let overLimit = 0

  const firstExact = new Map<string, number>()
  const firstNear = new Map<string, number>()

  entries.forEach((original, index) => {
    const keyword = normalizeKeyword(original)
    if (!keyword) {
      empty++
      return
    }
    if (rows.length >= MAX_KEYWORDS) {
      overLimit++
      return
    }

    const tokens = words(keyword)
    const folded = stripDiacritics(keyword)
    const { category, tags } = categorize(folded, tokens.length, brand)

    let status: KeywordStatus = "unique"
    let duplicateOf: number | null = null
    const exact = firstExact.get(keyword)
    const nearKey = nearDuplicateKey(keyword)
    const near = nearKey ? firstNear.get(nearKey) : undefined

    if (exact !== undefined) {
      status = "duplicate"
      duplicateOf = exact
    } else {
      firstExact.set(keyword, index)
      if (near !== undefined) {
        status = "near-duplicate"
        duplicateOf = near
      } else if (nearKey) {
        firstNear.set(nearKey, index)
      }
    }

    rows.push({
      id: index,
      original,
      keyword,
      wordCount: tokens.length,
      lengthGroup: lengthGroupOf(tokens.length),
      category,
      tags,
      intent: INTENT_BY_CATEGORY[category],
      status,
      duplicateOf,
      generic: tokens.length === 1,
      topic: "",
      action: "",
    })
  })

  const byId = new Map(rows.map((r) => [r.id, r]))
  const topics = assignTopics(rows)

  for (const row of rows) {
    if (row.status === "duplicate") row.action = "Usuń: to samo co wcześniejsza fraza."
    else if (row.status === "near-duplicate")
      row.action = `Prawie to samo co „${byId.get(row.duplicateOf!)!.keyword}”; zostaw jedną.`
    else row.action = ACTIONS[row.category]
  }

  const byCategory: KeywordStats["byCategory"] = {}
  const byLength: KeywordStats["byLength"] = { short: 0, medium: 0, long: 0 }
  for (const row of rows) {
    if (row.status === "duplicate") continue
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1
    byLength[row.lengthGroup]++
  }

  return {
    rows,
    topics,
    stats: {
      entries: entries.length,
      empty,
      analyzed: rows.length,
      overLimit,
      unique: rows.filter((r) => r.status !== "duplicate").length,
      duplicates: rows.filter((r) => r.status === "duplicate").length,
      nearDuplicates: rows.filter((r) => r.status === "near-duplicate").length,
      generic: rows.filter((r) => r.generic && r.status !== "duplicate").length,
      byCategory,
      byLength,
    },
  }
}

const NO_TOPIC = "Bez wyraźnego tematu"

/**
 * Groups phrases by their most common subject word: stems are counted across the list,
 * skipping stopwords, numbers and modifiers ("tanie", "kup", city names), and each phrase
 * joins the group of its most frequent stem.
 */
function assignTopics(rows: KeywordRow[]): KeywordTopic[] {
  const subjectStems = new Map<number, { stem: string; word: string }[]>()
  const stemCount = new Map<string, number>()
  const surface = new Map<string, Map<string, number>>()

  for (const row of rows) {
    if (row.status === "duplicate") continue
    const seen = new Set<string>()
    const items: { stem: string; word: string }[] = []
    for (const word of words(row.keyword)) {
      const folded = stripDiacritics(word)
      if (
        STOPWORDS.has(folded) ||
        /\d/.test(folded) ||
        folded.length < 3 ||
        isModifier(folded)
      )
        continue
      const s = stem(word)
      items.push({ stem: s, word })
      if (seen.has(s)) continue
      seen.add(s)
      stemCount.set(s, (stemCount.get(s) ?? 0) + 1)
      const forms = surface.get(s) ?? new Map<string, number>()
      forms.set(word, (forms.get(word) ?? 0) + 1)
      surface.set(s, forms)
    }
    subjectStems.set(row.id, items)
  }

  const nameOf = (s: string) =>
    [...surface.get(s)!.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl")
    )[0][0]

  const groups = new Map<string, number[]>()
  const byId = new Map(rows.map((r) => [r.id, r]))

  for (const row of rows) {
    if (row.status === "duplicate") {
      row.topic = byId.get(row.duplicateOf!)!.topic
    } else {
      const items = subjectStems.get(row.id) ?? []
      let best: string | null = null
      for (const item of items) {
        if (best === null || stemCount.get(item.stem)! > stemCount.get(best)!)
          best = item.stem
      }
      row.topic = best === null ? NO_TOPIC : nameOf(best)
    }
    const list = groups.get(row.topic) ?? []
    list.push(row.id)
    groups.set(row.topic, list)
  }

  return [...groups.entries()]
    .map(([name, rowIds]) => ({ name, rowIds }))
    .sort(
      (a, b) =>
        Number(a.name === NO_TOPIC) - Number(b.name === NO_TOPIC) ||
        b.rowIds.length - a.rowIds.length ||
        a.name.localeCompare(b.name, "pl")
    )
}
