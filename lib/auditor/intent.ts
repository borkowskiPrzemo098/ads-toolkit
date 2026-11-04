import { normalizeKeyword, stem, stripDiacritics, words } from "@/lib/keywords/normalize"
import { SIGNALS } from "@/lib/keywords/signals"
import {
  compileMatcher,
  DICTIONARIES,
  type NegativeCategory,
} from "@/lib/negatives/dictionaries"

/*
 * Heuristic intent of a search term, from dictionaries and word rules shared with the
 * keyword analyzer and the negative keyword generator. It reads the wording of a query; it
 * is not a semantic judgement, and the UI says so.
 */

export type Intent =
  "purchase" | "commercial" | "informational" | "navigational" | "unrelated" | "uncertain"

export const INTENT_LABEL: Record<Intent, string> = {
  purchase: "Zakupowa",
  commercial: "Komercyjna",
  informational: "Informacyjna",
  navigational: "Nawigacyjna",
  unrelated: "Niepowiązana",
  uncertain: "Niepewna",
}

/** Dictionary categories that are usually unwanted for a store (unless they are the offer). */
export type UnwantedCategory = Extract<
  NegativeCategory,
  "free" | "jobs" | "used" | "repair" | "howto"
>

export const UNWANTED_LABEL: Record<UnwantedCategory, string> = {
  free: "darmowe",
  jobs: "praca",
  used: "używane",
  repair: "naprawa i serwis",
  howto: "instrukcje i poradniki",
}

export interface IntentContext {
  /** Stems of the user's offer words; empty = unrelated terms cannot be detected. */
  offerStems: Set<string>
  brandWords: string[]
  competitors: string[]
}

export interface IntentResult {
  intent: Intent
  unwanted: UnwantedCategory | null
  /** Words that decided the class, shown to the user. */
  reasons: string[]
}

const UNWANTED = DICTIONARIES.filter((d) =>
  (["free", "jobs", "used", "repair", "howto"] as string[]).includes(d.category)
).map((d) => ({
  category: d.category as UnwantedCategory,
  regex: compileMatcher(d.patterns),
}))

const fold = (v: string) => stripDiacritics(normalizeKeyword(v))

export function intentContext(
  offer: string,
  brands: string,
  competitors: string
): IntentContext {
  const list = (v: string) =>
    v
      .split(/[,;\n]/)
      .map(fold)
      .filter(Boolean)
  return {
    offerStems: new Set(list(offer).flatMap((w) => words(w).map(stem))),
    brandWords: list(brands),
    competitors: list(competitors),
  }
}

const containsPhrase = (text: string, phrase: string) =>
  ` ${text} `.includes(` ${phrase} `)

export function classifyTerm(term: string, ctx: IntentContext): IntentResult {
  const r = classify(featuresOf(term), ctx)
  return { ...r, reasons: [...new Set(r.reasons)] }
}

/**
 * Everything about a term that does not depend on the user's offer words: normalised text,
 * stems, dictionary hits and signal words. Cached, so editing the offer words reclassifies
 * 200 000 terms with set lookups only.
 */
interface Features {
  text: string
  stems: string[]
  /** Unwanted dictionary hits in category order, with the stems of each hit. */
  unwanted: { category: UnwantedCategory; word: string; stems: string[] }[]
  signals: Partial<Record<(typeof SIGNALS)[number]["category"], string>>
}

const featureCache = new Map<string, Features>()
const MAX_CACHE = 400_000

function featuresOf(term: string): Features {
  const hit = featureCache.get(term)
  if (hit) return hit
  const text = fold(term)
  const unwanted: Features["unwanted"] = []
  for (const { category, regex } of UNWANTED) {
    regex.lastIndex = 0
    if (!regex.test(text)) continue
    regex.lastIndex = 0
    for (const m of text.matchAll(regex))
      unwanted.push({ category, word: m[0], stems: words(m[0]).map(stem) })
  }
  const signals: Features["signals"] = {}
  for (const s of SIGNALS) {
    const m = s.pattern.exec(text)
    if (m) signals[s.category] = m[0].trim()
  }
  const f = { text, stems: words(text).map(stem), unwanted, signals }
  if (featureCache.size >= MAX_CACHE) featureCache.clear()
  featureCache.set(term, f)
  return f
}

function classify(f: Features, ctx: IntentContext): IntentResult {
  const { text, stems, signals } = f
  const hasOffer = stems.some((s) => ctx.offerStems.has(s))

  // Unwanted dictionaries, unless the matched word is part of the offer ("naprawa" for a repair shop).
  const hit = f.unwanted.find((u) => !u.stems.some((x) => ctx.offerStems.has(x)))
  const unwanted: UnwantedCategory | null = hit?.category ?? null
  const reasons: string[] = hit ? [hit.word] : []

  const brand = ctx.brandWords.find((b) => containsPhrase(text, b))
  const competitor = ctx.competitors.find((c) => containsPhrase(text, c))
  if (brand || competitor)
    return {
      intent: "navigational",
      unwanted,
      reasons: [...reasons, (brand ?? competitor)!],
    }

  const nav = signals.navigational
  if (nav) return { intent: "navigational", unwanted, reasons: [...reasons, nav] }
  if (unwanted === "jobs") return { intent: "unrelated", unwanted, reasons }
  const info = signals.informational
  if (info || unwanted === "howto")
    return {
      intent: "informational",
      unwanted,
      reasons: [...reasons, ...(info ? [info] : [])],
    }
  // Offer words given and none in the query: probably not about the offer.
  if (ctx.offerStems.size && !hasOffer)
    return { intent: "unrelated", unwanted, reasons: [...reasons, "brak słów oferty"] }
  // "za darmo" also matches price words; someone looking for free stuff is not buying.
  if (unwanted === "free") return { intent: "uncertain", unwanted, reasons }
  const buy = signals.transactional ?? signals.price ?? signals.location
  if (buy) return { intent: "purchase", unwanted, reasons: [...reasons, buy] }
  const research = signals.research
  if (research) return { intent: "commercial", unwanted, reasons: [...reasons, research] }
  if (hasOffer)
    return { intent: "commercial", unwanted, reasons: [...reasons, "słowa oferty"] }
  return { intent: "uncertain", unwanted, reasons }
}
