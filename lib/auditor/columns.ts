import { stripDiacritics } from "@/lib/keywords/normalize"

/**
 * Canonical fields of the auditor's data model. Header names come from Google Ads exports in
 * the Polish and English interface; derived ratios (CTR, CPA…) are recognised only so they can
 * be cross-checked later: KPIs are always recomputed from the base metrics.
 */
export const FIELDS = {
  // Identifiers, most reliable first (used for joining reports).
  customerId: { label: "Identyfikator klienta", kind: "id" },
  account: { label: "Konto", kind: "dimension" },
  currency: { label: "Waluta", kind: "dimension" },
  campaignId: { label: "Identyfikator kampanii", kind: "id" },
  campaign: { label: "Kampania", kind: "dimension" },
  campaignType: { label: "Typ kampanii", kind: "dimension" },
  campaignStatus: { label: "Stan kampanii", kind: "dimension" },
  adGroupId: { label: "Identyfikator grupy reklam", kind: "id" },
  adGroup: { label: "Grupa reklam", kind: "dimension" },
  adId: { label: "Identyfikator reklamy", kind: "id" },
  adType: { label: "Typ reklamy", kind: "dimension" },
  adStrength: { label: "Skuteczność reklamy", kind: "dimension" },
  headline: { label: "Nagłówek", kind: "dimension" },
  keywordId: { label: "Identyfikator słowa kluczowego", kind: "id" },
  keyword: { label: "Słowo kluczowe", kind: "dimension" },
  matchType: { label: "Typ dopasowania", kind: "dimension" },
  searchTerm: { label: "Wyszukiwane hasło", kind: "dimension" },
  landingPage: { label: "Strona docelowa", kind: "dimension" },
  conversionAction: { label: "Działanie powodujące konwersję", kind: "dimension" },
  device: { label: "Urządzenie", kind: "dimension" },
  location: { label: "Lokalizacja", kind: "dimension" },
  // Time.
  date: { label: "Data", kind: "time" },
  week: { label: "Tydzień", kind: "time" },
  month: { label: "Miesiąc", kind: "time" },
  dayOfWeek: { label: "Dzień tygodnia", kind: "time" },
  hour: { label: "Godzina", kind: "time" },
  // Base metrics.
  impressions: { label: "Wyświetlenia", kind: "metric" },
  clicks: { label: "Kliknięcia", kind: "metric" },
  cost: { label: "Koszt", kind: "metric" },
  conversions: { label: "Konwersje", kind: "metric" },
  conversionValue: { label: "Wartość konwersji", kind: "metric" },
  // Derived ratios: recognised, never summed.
  ctr: { label: "CTR", kind: "derived" },
  avgCpc: { label: "Śr. CPC", kind: "derived" },
  costPerConversion: { label: "Koszt / konw.", kind: "derived" },
  conversionRate: { label: "Współczynnik konwersji", kind: "derived" },
  roas: { label: "Wartość konw. / koszt", kind: "derived" },
} as const

export type Field = keyof typeof FIELDS
export type FieldKind = (typeof FIELDS)[Field]["kind"]
export const FIELD_KEYS = Object.keys(FIELDS) as Field[]
export const METRIC_FIELDS = FIELD_KEYS.filter((f) => FIELDS[f].kind === "metric")
export const NUMERIC_FIELDS = FIELD_KEYS.filter(
  (f) => FIELDS[f].kind === "metric" || FIELDS[f].kind === "derived"
)

/**
 * Lower case, no diacritics, no punctuation except "/": "Koszt/konw." and "Cost / conv."
 * become "koszt/konw" and "cost/conv". Parenthesised suffixes stay, so
 * "Miasto (lokalizacja użytkownika)" is distinct from a plain "Miasto".
 */
export function normalizeHeader(header: string): string {
  return stripDiacritics(header.toLocaleLowerCase("pl-PL"))
    .replace(/[.:]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[^a-z0-9/()% -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Known header names per field (already normalised). Order matters only within a field. */
const HEADERS: Record<Field, string[]> = {
  customerId: ["customer id", "identyfikator klienta", "id klienta"],
  account: ["account", "account name", "konto", "nazwa konta"],
  currency: ["currency", "currency code", "waluta", "kod waluty"],
  campaignId: ["campaign id", "identyfikator kampanii", "id kampanii"],
  campaign: ["campaign", "campaign name", "kampania", "nazwa kampanii"],
  campaignType: ["campaign type", "typ kampanii", "advertising channel type"],
  campaignStatus: [
    "campaign status",
    "campaign state",
    "stan kampanii",
    "status kampanii",
  ],
  adGroupId: ["ad group id", "identyfikator grupy reklam", "id grupy reklam"],
  adGroup: ["ad group", "ad group name", "grupa reklam", "nazwa grupy reklam"],
  adId: ["ad id", "identyfikator reklamy", "id reklamy"],
  adType: ["ad type", "typ reklamy"],
  adStrength: ["ad strength", "skutecznosc reklamy", "sila reklamy"],
  headline: ["headline 1", "headline", "naglowek 1", "naglowek"],
  keywordId: [
    "keyword id",
    "criterion id",
    "identyfikator slowa kluczowego",
    "id slowa kluczowego",
  ],
  keyword: [
    "keyword",
    "search keyword",
    "slowo kluczowe",
    "slowo kluczowe w sieci wyszukiwania",
    "slowo kluczowe w wyszukiwarce",
  ],
  matchType: [
    "match type",
    "search keyword match type",
    "keyword match type",
    "typ dopasowania",
    "typ dopasowania slowa kluczowego",
  ],
  searchTerm: ["search term", "search terms", "wyszukiwane haslo", "wyszukiwane hasla"],
  landingPage: [
    "landing page",
    "final url",
    "expanded landing page",
    "strona docelowa",
    "rozwinieta strona docelowa",
    "koncowy url",
    "koncowy adres url",
  ],
  conversionAction: [
    "conversion action",
    "conversion name",
    "dzialanie powodujace konwersje",
    "nazwa dzialania powodujacego konwersje",
    "konwersja",
  ],
  device: ["device", "urzadzenie"],
  location: [
    "location",
    "country/territory",
    "country/territory (user location)",
    "region (user location)",
    "city (user location)",
    "city",
    "region",
    "matched location",
    "targeted location",
    "user location",
    "lokalizacja",
    "kraj/terytorium",
    "kraj/terytorium (lokalizacja uzytkownika)",
    "region (lokalizacja uzytkownika)",
    "miasto (lokalizacja uzytkownika)",
    "miasto",
    "lokalizacja docelowa",
    "dopasowana lokalizacja",
    "lokalizacja uzytkownika",
  ],
  date: ["day", "date", "dzien", "data"],
  week: ["week", "tydzien"],
  month: ["month", "miesiac"],
  dayOfWeek: ["day of the week", "day of week", "dzien tygodnia"],
  hour: [
    "hour of the day",
    "hour of day",
    "hour",
    "godzina",
    "godzina dnia",
    "pora dnia",
  ],
  impressions: ["impr", "impressions", "wysw", "wyswietlenia"],
  clicks: ["clicks", "klikniecia"],
  cost: ["cost", "koszt"],
  conversions: ["conversions", "conv", "konwersje", "konw", "all conv", "wszystkie konw"],
  conversionValue: [
    "conv value",
    "conversion value",
    "conversions value",
    "total conv value",
    "wartosc konw",
    "wartosc konwersji",
    "laczna wartosc konw",
  ],
  ctr: ["ctr"],
  avgCpc: ["avg cpc", "sr cpc", "sredni cpc", "average cpc"],
  costPerConversion: [
    "cost/conv",
    "cost per conversion",
    "koszt/konw",
    "koszt konwersji",
    "koszt/konwersje",
  ],
  conversionRate: ["conv rate", "conversion rate", "wsp konw", "wspolczynnik konwersji"],
  roas: ["conv value/cost", "wartosc konw/koszt", "roas"],
}

const BY_HEADER = new Map<string, Field>()
for (const field of FIELD_KEYS) {
  for (const h of HEADERS[field]) if (!BY_HEADER.has(h)) BY_HEADER.set(h, field)
}

/** The field a header names, or null when unknown. */
export function fieldForHeader(header: string): Field | null {
  const h = normalizeHeader(header)
  return BY_HEADER.get(h) ?? null
}

export type Mapping = Partial<Record<Field, number>>

/**
 * Suggests a column per field from the header row. The first column wins when two headers
 * name the same field (e.g. "Region" and "Miasto" both mean location: the first is kept and
 * the second stays available for manual mapping).
 */
export function suggestMapping(header: string[]): Mapping {
  const mapping: Mapping = {}
  header.forEach((cell, index) => {
    const field = fieldForHeader(cell)
    if (field && mapping[field] === undefined) mapping[field] = index
  })
  return mapping
}

/** Fields the user can assign by hand on the mapping screen, in display order. */
export const MAPPABLE_FIELDS: Field[] = [
  "campaign",
  "adGroup",
  "keyword",
  "searchTerm",
  "matchType",
  "adId",
  "landingPage",
  "conversionAction",
  "device",
  "location",
  "date",
  "dayOfWeek",
  "hour",
  "impressions",
  "clicks",
  "cost",
  "conversions",
  "conversionValue",
  "campaignId",
  "adGroupId",
  "keywordId",
  "customerId",
  "campaignType",
  "campaignStatus",
]
