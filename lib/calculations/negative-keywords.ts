import {
  normalizeKeyword,
  stem,
  STOPWORDS,
  stripDiacritics,
  words,
} from "@/lib/keywords/normalize"
import {
  compileMatcher,
  DICTIONARIES,
  type NegativeCategory,
} from "@/lib/negatives/dictionaries"

export type { NegativeCategory }
export type MatchType = "broad" | "phrase" | "exact"
export type Decision = "pending" | "accepted" | "rejected"

export interface SearchTerm {
  term: string
  clicks: number | null
  impressions: number | null
  cost: number | null
  conversions: number | null
}

/** Merged search term: duplicates in the input are combined, their metrics summed. */
export interface TermRecord extends SearchTerm {
  /** Normalised text. */
  term: string
  occurrences: number
}

export interface NegativeSuggestion {
  /** Stable key: category plus stem (or phrase). */
  id: string
  category: NegativeCategory
  /** Every word form seen in the terms; Google Ads negatives do not match close variants. */
  forms: string[]
  /** Indexes into `terms`. */
  termIndexes: number[]
  clicks: number | null
  cost: number | null
  conversions: number | null
}

export interface NegativeAnalysis {
  terms: TermRecord[]
  suggestions: NegativeSuggestion[]
  stats: {
    entries: number
    empty: number
    uniqueTerms: number
    duplicateTerms: number
    /** Terms covered by at least one suggestion. */
    matchedTerms: number
    hasMetrics: boolean
  }
}

export interface NegativeOptions {
  /** Words describing the offer. They are never suggested and define "related" terms. */
  offerWords?: string[]
  competitors?: string[]
  /** The user's own unwanted words and phrases. */
  customWords?: string[]
}

const cleanList = (list: string[] = []) => [
  ...new Set(list.map(normalizeKeyword).filter(Boolean)),
]

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const sum = (values: (number | null)[]) =>
  values.some((v) => v !== null) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : null

export function mergeTerms(input: SearchTerm[]) {
  const byText = new Map<string, TermRecord>()
  let empty = 0
  for (const raw of input) {
    const term = normalizeKeyword(raw.term)
    if (!term) {
      empty++
      continue
    }
    const existing = byText.get(term)
    if (!existing) {
      byText.set(term, { ...raw, term, occurrences: 1 })
      continue
    }
    existing.occurrences++
    existing.clicks = sum([existing.clicks, raw.clicks])
    existing.impressions = sum([existing.impressions, raw.impressions])
    existing.cost = sum([existing.cost, raw.cost])
    existing.conversions = sum([existing.conversions, raw.conversions])
  }
  return { terms: [...byText.values()], empty }
}

interface Builder {
  category: NegativeCategory
  key: string
  forms: Set<string>
  termIndexes: Set<number>
}

export function suggestNegatives(
  input: SearchTerm[],
  options: NegativeOptions = {}
): NegativeAnalysis {
  const { terms, empty } = mergeTerms(input)
  const offer = cleanList(options.offerWords)
  const offerStems = new Set(offer.flatMap((w) => words(w).map(stem)))
  const isOffer = (text: string) => words(text).some((w) => offerStems.has(stem(w)))

  const builders = new Map<string, Builder>()
  const add = (
    category: NegativeCategory,
    key: string,
    form: string,
    termIndex: number
  ) => {
    const id = `${category}:${key}`
    const b = builders.get(id) ?? {
      category,
      key,
      forms: new Set(),
      termIndexes: new Set(),
    }
    b.forms.add(form)
    b.termIndexes.add(termIndex)
    builders.set(id, b)
  }

  const matchers: { category: NegativeCategory; regex: RegExp }[] = [
    ...DICTIONARIES.map((d) => ({
      category: d.category,
      regex: compileMatcher(d.patterns),
    })),
  ]
  const userList = (category: NegativeCategory, list: string[]) => {
    const cleaned = cleanList(list).map(stripDiacritics)
    if (cleaned.length) {
      matchers.push({ category, regex: compileMatcher(cleaned.map(escapeRegExp)) })
    }
  }
  userList("competitor", options.competitors ?? [])
  userList("custom", options.customWords ?? [])

  terms.forEach((record, index) => {
    // Folding keeps string length (one letter per diacritic), so indexes map back.
    const folded = stripDiacritics(record.term)
    for (const { category, regex } of matchers) {
      regex.lastIndex = 0
      for (const match of folded.matchAll(regex)) {
        const form = record.term.slice(match.index, match.index + match[0].length)
        if (isOffer(form)) continue
        const multiWord = form.includes(" ")
        const key =
          category === "competitor" || category === "custom" || multiWord
            ? stripDiacritics(form)
            : stem(form)
        add(category, key, form, index)
      }
    }
  })

  if (offerStems.size > 0) {
    // Words that already have a specific category ("praca" → jobs) are not repeated as unrelated.
    const categorised = new Set([...builders.values()].map((b) => b.key))
    addUnrelated(terms, offerStems, categorised, add)
  }

  const suggestions: NegativeSuggestion[] = [...builders.entries()].map(([id, b]) => {
    const indexes = [...b.termIndexes].sort((x, y) => x - y)
    const pick = (key: "clicks" | "cost" | "conversions") =>
      sum(indexes.map((i) => terms[i][key]))
    return {
      id,
      category: b.category,
      forms: [...b.forms].sort((x, y) => x.localeCompare(y, "pl")),
      termIndexes: indexes,
      clicks: pick("clicks"),
      cost: pick("cost"),
      conversions: pick("conversions"),
    }
  })

  suggestions.sort(
    (a, b) =>
      (b.cost ?? 0) - (a.cost ?? 0) ||
      b.termIndexes.length - a.termIndexes.length ||
      a.forms[0].localeCompare(b.forms[0], "pl")
  )

  const matched = new Set(suggestions.flatMap((s) => s.termIndexes))
  return {
    terms,
    suggestions,
    stats: {
      entries: input.length,
      empty,
      uniqueTerms: terms.length,
      duplicateTerms: input.length - empty - terms.length,
      matchedTerms: matched.size,
      hasMetrics: terms.some((t) => t.clicks !== null || t.cost !== null),
    },
  }
}

/**
 * Terms with no offer word are likely unrelated. From them, suggest words that never occur
 * in a related term, so shared words like "damskie" are not excluded by accident.
 */
function addUnrelated(
  terms: TermRecord[],
  offerStems: Set<string>,
  categorised: Set<string>,
  add: (category: NegativeCategory, key: string, form: string, termIndex: number) => void
) {
  const relatedStems = new Set<string>()
  const unrelated: number[] = []
  terms.forEach((record, index) => {
    const stems = words(record.term).map(stem)
    if (stems.some((s) => offerStems.has(s))) stems.forEach((s) => relatedStems.add(s))
    else unrelated.push(index)
  })
  for (const index of unrelated) {
    for (const word of words(terms[index].term)) {
      const folded = stripDiacritics(word)
      if (STOPWORDS.has(folded) || folded.length < 3 || /\d/.test(folded)) continue
      const s = stem(word)
      if (relatedStems.has(s) || categorised.has(s)) continue
      add("unrelated", s, word, index)
    }
  }
}

/** Google Ads keyword limits: 10 words, 80 characters, and no special symbols. */
export const NEGATIVE_MAX_WORDS = 10
export const NEGATIVE_MAX_CHARS = 80
const INVALID_CHARS = /[!@%^*()={};~`<>?\\|,]/

export function formatNegative(text: string, matchType: MatchType): string {
  if (matchType === "phrase") return `"${text}"`
  if (matchType === "exact") return `[${text}]`
  return text
}

export interface NegativeEntry {
  /** Text without match-type symbols. */
  text: string
  matchType: MatchType
  /** As pasted into Google Ads: word, "phrase" or [exact]. */
  formatted: string
  suggestionId: string
  category: NegativeCategory
}

export interface NegativeList {
  entries: NegativeEntry[]
  duplicatesRemoved: number
  /** Entries Google Ads would reject, left out with the reason. */
  rejected: { text: string; reason: string }[]
}

export interface SuggestionDecision {
  status: Decision
  /** null = use the list-wide default. */
  matchType: MatchType | null
}

/**
 * Builds the final list from accepted suggestions only. Broad and phrase use the word forms;
 * exact uses the whole search terms, since an exact negative blocks only that exact query.
 */
export function buildNegativeList(
  analysis: NegativeAnalysis,
  decisions: Record<string, SuggestionDecision>,
  defaultMatchType: MatchType
): NegativeList {
  const entries: NegativeEntry[] = []
  const seen = new Set<string>()
  const rejected: NegativeList["rejected"] = []
  let duplicatesRemoved = 0

  for (const suggestion of analysis.suggestions) {
    const decision = decisions[suggestion.id]
    if (decision?.status !== "accepted") continue
    const matchType = decision.matchType ?? defaultMatchType
    const texts =
      matchType === "exact"
        ? suggestion.termIndexes.map((i) => analysis.terms[i].term)
        : suggestion.forms

    for (const text of texts) {
      if (INVALID_CHARS.test(text)) {
        rejected.push({ text, reason: "Zawiera znaki niedozwolone w Google Ads." })
        continue
      }
      if (text.length > NEGATIVE_MAX_CHARS || words(text).length > NEGATIVE_MAX_WORDS) {
        rejected.push({ text, reason: "Ponad 10 słów lub 80 znaków." })
        continue
      }
      const formatted = formatNegative(text, matchType)
      if (seen.has(formatted)) {
        duplicatesRemoved++
        continue
      }
      seen.add(formatted)
      entries.push({
        text,
        matchType,
        formatted,
        suggestionId: suggestion.id,
        category: suggestion.category,
      })
    }
  }

  return { entries, duplicatesRemoved, rejected }
}
