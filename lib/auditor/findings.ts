/*
 * What every audit finding carries (spec section 5): name, severity, situation, evidence with
 * numbers, possible cause, recommended action, estimated impact when it can be computed,
 * confidence, and the source (report, dimension, period, method).
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info"
export type Confidence = "high" | "medium" | "low"
export type FindingArea =
  "campaign" | "keyword" | "searchTerm" | "device" | "location" | "schedule"

export const AREA_LABEL: Record<FindingArea, string> = {
  campaign: "Kampanie",
  keyword: "Słowa kluczowe",
  searchTerm: "Wyszukiwane hasła",
  device: "Urządzenia",
  location: "Lokalizacje",
  schedule: "Godziny i dni",
}
/** Problem to fix, or an opportunity to use. */
export type FindingKind = "problem" | "opportunity" | "data"

export interface Evidence {
  label: string
  value: string
}

export interface Finding {
  id: string
  /** Rule code from thresholds.ts, e.g. "A2". */
  rule: string
  area: FindingArea
  kind: FindingKind
  severity: Severity
  confidence: Confidence
  title: string
  /** What the finding is about: a campaign, a keyword, or several. */
  subject: string
  situation: string
  evidence: Evidence[]
  cause: string
  action: string
  /** Estimated effect, always worded as an estimate; omitted when it cannot be computed. */
  impact?: string
  source: {
    report: string
    dimension: string
    period: string | null
    method: string
  }
  /** For sorting: cost involved. */
  cost: number
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Krytyczny",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
  info: "Informacyjny",
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Wysoka",
  medium: "Średnia",
  low: "Niska",
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

/** Confidence from the p-value of the sample check. */
export const confidenceOf = (p: number): Confidence =>
  p < 0.001 ? "high" : p < 0.01 ? "medium" : "low"

export function sortFindings(list: Finding[]): Finding[] {
  return [...list].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.kind === "problem" ? 0 : 1) - (b.kind === "problem" ? 0 : 1) ||
      b.cost - a.cost
  )
}
