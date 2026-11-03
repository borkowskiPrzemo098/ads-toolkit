import type { Field, Mapping } from "./columns"

/** The ten report types the auditor understands, from the most granular dimension down. */
export const REPORT_TYPES = {
  searchTerm: {
    label: "Wyszukiwane hasła",
    needs: ["searchTerm"],
    level: 4,
  },
  keyword: { label: "Słowa kluczowe", needs: ["keyword"], level: 4 },
  ad: { label: "Reklamy", needs: ["adId"], level: 4 },
  landingPage: { label: "Strony docelowe", needs: ["landingPage"], level: 3 },
  conversion: {
    label: "Konwersje (działania)",
    needs: ["conversionAction"],
    level: 3,
  },
  schedule: { label: "Godziny i dni tygodnia", needs: ["hour"], level: 3 },
  device: { label: "Urządzenia", needs: ["device"], level: 3 },
  location: { label: "Lokalizacje", needs: ["location"], level: 3 },
  adGroup: { label: "Grupy reklam", needs: ["adGroup"], level: 2 },
  campaign: { label: "Kampanie", needs: ["campaign"], level: 1 },
} as const satisfies Record<string, { label: string; needs: Field[]; level: number }>

export type ReportType = keyof typeof REPORT_TYPES
export const REPORT_TYPE_KEYS = Object.keys(REPORT_TYPES) as ReportType[]

/** Columns each type must have to be analysed; the rest is optional and reported as missing. */
export const REQUIRED: Record<ReportType, Field[]> = {
  searchTerm: ["searchTerm", "clicks", "cost"],
  keyword: ["keyword", "clicks", "cost"],
  ad: ["clicks", "cost"],
  landingPage: ["landingPage", "clicks", "cost"],
  conversion: ["conversionAction", "conversions"],
  schedule: ["clicks", "cost"],
  device: ["device", "clicks", "cost"],
  location: ["location", "clicks", "cost"],
  adGroup: ["adGroup", "clicks", "cost"],
  campaign: ["campaign", "clicks", "cost"],
}

/** Optional columns that unlock analyses; their absence is listed, never treated as an error. */
export const USEFUL: Record<ReportType, Field[]> = {
  searchTerm: [
    "campaign",
    "adGroup",
    "keyword",
    "matchType",
    "conversions",
    "conversionValue",
  ],
  keyword: [
    "campaign",
    "adGroup",
    "matchType",
    "impressions",
    "conversions",
    "conversionValue",
  ],
  ad: ["campaign", "adGroup", "adType", "adStrength", "impressions", "conversions"],
  landingPage: ["campaign", "impressions", "conversions", "conversionValue"],
  conversion: ["campaign", "conversionValue"],
  schedule: ["dayOfWeek", "impressions", "conversions", "conversionValue"],
  device: ["campaign", "impressions", "conversions", "conversionValue"],
  location: ["campaign", "impressions", "conversions", "conversionValue"],
  adGroup: ["campaign", "impressions", "conversions", "conversionValue"],
  campaign: ["impressions", "conversions", "conversionValue", "date", "campaignType"],
}

export interface Detection {
  type: ReportType | null
  /** high: the defining column is present; low: guessed from weaker hints. */
  confidence: "high" | "low"
  reason: string
}

/**
 * Picks the most granular dimension present. A search terms export also carries keyword and
 * campaign columns, so the order of checks matters: search term → keyword → ad → … → campaign.
 * Schedule reports are recognised by hour, or by day of week without any finer dimension.
 */
export function detectReportType(mapping: Mapping, fileName = ""): Detection {
  const has = (f: Field) => mapping[f] !== undefined
  for (const type of REPORT_TYPE_KEYS) {
    if (REPORT_TYPES[type].needs.every(has))
      return {
        type,
        confidence: "high",
        reason: `kolumna „${columnHint(type)}”`,
      }
    // Ads exported without IDs still have an ad type, strength or headline column.
    if (type === "ad" && (has("adType") || has("adStrength") || has("headline")))
      return { type, confidence: "high", reason: "kolumny reklamy (typ, nagłówek)" }
    if (type === "schedule" && has("dayOfWeek"))
      return { type, confidence: "high", reason: "kolumna „Dzień tygodnia”" }
  }
  const name = fileName.toLocaleLowerCase("pl-PL")
  if (/wyszukiwan|search.?term/.test(name))
    return { type: "searchTerm", confidence: "low", reason: "nazwa pliku" }
  return { type: null, confidence: "low", reason: "brak rozpoznawalnych kolumn" }
}

function columnHint(type: ReportType): string {
  const hints: Record<ReportType, string> = {
    searchTerm: "Wyszukiwane hasło",
    keyword: "Słowo kluczowe",
    ad: "Identyfikator reklamy",
    landingPage: "Strona docelowa",
    conversion: "Działanie powodujące konwersję",
    schedule: "Godzina",
    device: "Urządzenie",
    location: "Lokalizacja",
    adGroup: "Grupa reklam",
    campaign: "Kampania",
  }
  return hints[type]
}
