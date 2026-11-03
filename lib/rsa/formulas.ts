import { countChars, limitOf, type AssetKind } from "./limits"

/** What the advertiser tells us. Lists are comma-separated in the form. */
export interface RsaBrief {
  brand: string
  product: string
  keywords: string[]
  benefits: string[]
  /** Who it is for, as it follows "dla": "biegaczy", "małych firm". */
  audience: string
  ctas: string[]
  /** Price or discount as the advertiser states it: "od 199 zł", "-20%". */
  price: string
  /** The customer's problem: "obtarte stopy po bieganiu". */
  problem: string
  /** Offer details: "darmowa dostawa od 200 zł". */
  offer: string
}

export const EMPTY_BRIEF: RsaBrief = {
  brand: "",
  product: "",
  keywords: [],
  benefits: [],
  audience: "",
  ctas: [],
  price: "",
  problem: "",
  offer: "",
}

export type FormulaId =
  | "keyword"
  | "brand"
  | "benefit-cta"
  | "problem-solution"
  | "offer-advantage"
  | "price-cta"
  | "urgency-cta"
  | "product-use"

export const FORMULAS: { id: FormulaId; label: string; description: string }[] = [
  {
    id: "keyword",
    label: "Słowo kluczowe",
    description: "Fraza, której ktoś szuka, wprost w nagłówku.",
  },
  { id: "brand", label: "Marka", description: "Nazwa firmy i to, co sprzedajesz." },
  {
    id: "benefit-cta",
    label: "Korzyść + CTA",
    description: "Co klient zyskuje i co ma zrobić.",
  },
  {
    id: "problem-solution",
    label: "Problem + rozwiązanie",
    description: "Nazwij kłopot klienta i pokaż wyjście.",
  },
  {
    id: "offer-advantage",
    label: "Oferta + przewaga",
    description: "Konkret oferty i powód, by wybrać Ciebie.",
  },
  {
    id: "price-cta",
    label: "Cena + CTA",
    description: "Cena lub rabat i wezwanie do działania.",
  },
  {
    id: "urgency-cta",
    label: "Pilność + CTA",
    description: "Zachęta, by działać teraz.",
  },
  {
    id: "product-use",
    label: "Produkt + zastosowanie",
    description: "Dla kogo i do czego jest produkt.",
  },
]

type Slot =
  | "brand"
  | "product"
  | "kw"
  | "benefit"
  | "benefit2"
  | "audience"
  | "cta"
  | "price"
  | "problem"
  | "offer"

interface Template {
  formula: FormulaId
  kind: AssetKind
  text: string
}

/**
 * Templates only combine the advertiser's own words with neutral connectors. They never add
 * claims ("najtaniej", "oficjalny sklep") the advertiser did not make.
 */
const TEMPLATES: Template[] = [
  { formula: "keyword", kind: "headline", text: "{kw}" },
  { formula: "keyword", kind: "headline", text: "{kw} – {brand}" },
  { formula: "keyword", kind: "headline", text: "{kw}. {cta}" },
  { formula: "brand", kind: "headline", text: "{brand}" },
  { formula: "brand", kind: "headline", text: "{brand}: {product}" },
  { formula: "brand", kind: "headline", text: "{product} {brand}" },
  { formula: "benefit-cta", kind: "headline", text: "{benefit}" },
  { formula: "benefit-cta", kind: "headline", text: "{benefit}. {cta}" },
  { formula: "benefit-cta", kind: "headline", text: "{cta}" },
  { formula: "problem-solution", kind: "headline", text: "{problem}?" },
  { formula: "offer-advantage", kind: "headline", text: "{offer}" },
  { formula: "offer-advantage", kind: "headline", text: "{product}: {benefit}" },
  { formula: "price-cta", kind: "headline", text: "{product} {price}" },
  { formula: "price-cta", kind: "headline", text: "{kw} {price}" },
  { formula: "price-cta", kind: "headline", text: "{price}. {cta}" },
  { formula: "urgency-cta", kind: "headline", text: "{cta} już dziś" },
  { formula: "product-use", kind: "headline", text: "{product} dla {audience}" },
  { formula: "product-use", kind: "headline", text: "{kw} dla {audience}" },

  { formula: "benefit-cta", kind: "description", text: "{benefit}, {benefit2}. {cta}." },
  { formula: "benefit-cta", kind: "description", text: "{benefit}. {cta} w {brand}." },
  {
    formula: "problem-solution",
    kind: "description",
    text: "{problem}? {product} od {brand} to rozwiązanie. {cta}.",
  },
  {
    formula: "problem-solution",
    kind: "description",
    text: "{problem}? {product} od {brand}: {benefit}, {benefit2}.",
  },
  {
    formula: "offer-advantage",
    kind: "description",
    text: "{offer}. {benefit} i {benefit2}. {cta}.",
  },
  {
    formula: "offer-advantage",
    kind: "description",
    text: "{product} od {brand}: {benefit}, {benefit2}. {offer}.",
  },
  {
    formula: "price-cta",
    kind: "description",
    text: "{product} {price}. {benefit}. {cta}.",
  },
  { formula: "price-cta", kind: "description", text: "{kw} {price} w {brand}. {cta}." },
  {
    formula: "urgency-cta",
    kind: "description",
    text: "{cta} już dziś. {benefit}, {benefit2}.",
  },
  { formula: "urgency-cta", kind: "description", text: "{offer}. {cta} już dziś." },
  {
    formula: "product-use",
    kind: "description",
    text: "{product} dla {audience}. {benefit}, {benefit2}. {cta}.",
  },
  {
    formula: "product-use",
    kind: "description",
    text: "{kw} dla {audience}: {benefit}. {cta}.",
  },
]

/** How many items of each list feed the combinations. Keeps proposals varied but finite. */
const LIST_DEPTH = 3
const PER_FORMULA = 8
// Whitespace boundaries: \b does not work after Polish letters such as "ś".
const URGENT_WORDS = /(?:^|\s)(teraz|dziś|dzisiaj|już|natychmiast)(?=$|[\s.,])/i

const slotsOf = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as Slot)

/** Lower-cases the first letter mid-sentence, unless the word looks like an acronym or a name with inner capitals. */
function lowerFirst(text: string): string {
  const word = text.split(/\s/)[0]
  if (
    word.length > 1 &&
    (word === word.toUpperCase() || /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(word.slice(1)))
  ) {
    return text
  }
  return text.charAt(0).toLocaleLowerCase("pl-PL") + text.slice(1)
}

/** Capitalises sentence starts, removes doubled spaces and stray punctuation. */
export function tidy(text: string, kind: AssetKind): string {
  let t = text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,:?!])/g, "$1")
    .replace(/([.?!])\.+/g, "$1")
    .trim()
  t = t.replace(
    /(^|[.?!]\s)([a-ząćęłńóśźż])/g,
    (_, start: string, ch: string) => start + ch.toLocaleUpperCase("pl-PL")
  )
  if (kind === "headline") t = t.replace(/\.$/, "")
  if (kind === "description" && !/[.?!]$/.test(t)) t += "."
  return t
}

const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))]

export interface Proposal {
  id: string
  formula: FormulaId
  kind: AssetKind
  text: string
  length: number
}

/** Fills every template with every combination of the brief, keeping only texts that fit. */
export function generateProposals(brief: RsaBrief): Proposal[] {
  const lists: Record<"kw" | "benefit" | "cta", string[]> = {
    kw: clean(brief.keywords).slice(0, LIST_DEPTH),
    benefit: clean(brief.benefits).slice(0, LIST_DEPTH),
    cta: clean(brief.ctas).slice(0, LIST_DEPTH),
  }
  const single: Record<Exclude<Slot, "kw" | "benefit" | "benefit2" | "cta">, string> = {
    brand: brief.brand.trim(),
    product: brief.product.trim(),
    audience: brief.audience.trim(),
    price: brief.price.trim(),
    problem: brief.problem.trim(),
    offer: brief.offer.trim(),
  }

  const proposals: Proposal[] = []
  const seen = new Set<string>()
  const perFormula = new Map<string, number>()

  for (const template of TEMPLATES) {
    const slots = slotsOf(template.text)
    const kws = slots.includes("kw") ? lists.kw : [""]
    const benefits = slots.includes("benefit") ? lists.benefit : [""]
    const ctas = slots.includes("cta") ? lists.cta : [""]

    for (const kw of kws) {
      for (const [bi, benefit] of benefits.entries()) {
        // Pairs in one order only: "A, B" without a mirrored "B, A".
        const seconds = slots.includes("benefit2")
          ? lists.benefit.filter((_, j) => j > bi)
          : [""]
        for (const benefit2 of seconds) {
          for (const cta of ctas) {
            // "Kup teraz już dziś" says the same thing twice.
            if (template.formula === "urgency-cta" && URGENT_WORDS.test(cta)) continue
            const values: Record<Slot, string> = { ...single, kw, benefit, benefit2, cta }
            if (slots.some((s) => !values[s])) continue

            // Every slot is lower-cased mid-sentence; tidy() restores sentence starts.
            const raw = template.text.replace(/\{(\w+)\}/g, (_, slot: Slot) =>
              slot === "brand" ? values.brand : lowerFirst(values[slot])
            )
            const text = tidy(raw, template.kind)
            const length = countChars(text)
            const key = `${template.kind}:${text.toLocaleLowerCase("pl-PL")}`
            const countKey = `${template.kind}:${template.formula}`
            if (length > limitOf(template.kind) || seen.has(key)) continue
            if ((perFormula.get(countKey) ?? 0) >= PER_FORMULA) continue
            seen.add(key)
            perFormula.set(countKey, (perFormula.get(countKey) ?? 0) + 1)
            proposals.push({
              id: key,
              formula: template.formula,
              kind: template.kind,
              text,
              length,
            })
          }
        }
      }
    }
  }
  return proposals
}

/** Brief fields a formula needs that are still empty, to tell the user what to fill. */
export function missingInputs(brief: RsaBrief, formula: FormulaId): (keyof RsaBrief)[] {
  const slotToField: Record<Slot, keyof RsaBrief> = {
    brand: "brand",
    product: "product",
    kw: "keywords",
    benefit: "benefits",
    benefit2: "benefits",
    audience: "audience",
    cta: "ctas",
    price: "price",
    problem: "problem",
    offer: "offer",
  }
  const filled = (field: keyof RsaBrief) => {
    const value = brief[field]
    return Array.isArray(value) ? clean(value).length > 0 : value.trim() !== ""
  }
  const templates = TEMPLATES.filter((t) => t.formula === formula)
  // A formula is usable when at least one of its templates has every field it needs.
  const options = templates.map((t) => [
    ...new Set(slotsOf(t.text).map((s) => slotToField[s])),
  ])
  if (options.some((fields) => fields.every(filled))) return []
  const smallest = options.sort(
    (a, b) => a.filter((f) => !filled(f)).length - b.filter((f) => !filled(f)).length
  )[0]
  return smallest.filter((f) => !filled(f))
}
