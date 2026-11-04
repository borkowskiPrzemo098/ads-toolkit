import type { Finding, FindingArea } from "./findings"
import type { RuleContext } from "./rules/context"
import { pickKeywordReport } from "./rules/keywords"
import type { SearchTermAnalysis } from "./rules/search-terms"
import type { SegmentAnalysis } from "./rules/segments"
import { sumMetrics } from "./metrics"
import { share } from "./rules/context"

/*
 * "Indeks efektywności kampanii" (spec section 8). Not a Google score. Each area scores
 * 100 × (1 − share of its spend in elements with a detected problem). An area without data
 * is left out (not scored as zero), and the overall index is the plain average of the
 * assessed areas, shown together with how many of the seven areas could be assessed.
 */

export type IndexArea =
  "campaigns" | "keywords" | "traffic" | "devices" | "locations" | "ads" | "costControl"

export const INDEX_LABEL: Record<IndexArea, string> = {
  campaigns: "Efektywność kampanii",
  keywords: "Efektywność słów kluczowych",
  traffic: "Jakość ruchu",
  devices: "Efektywność urządzeń",
  locations: "Efektywność lokalizacji",
  ads: "Efektywność reklam",
  costControl: "Kontrola kosztów",
}

export interface AreaScore {
  area: IndexArea
  label: string
  score: number | null
  /** How the score was computed (assessed) or why it was not (not assessed). */
  basis: string
}

export interface EfficiencyIndex {
  overall: number | null
  areas: AreaScore[]
  assessed: number
  completeness: number
}

interface Inputs {
  ctx: RuleContext
  findings: Finding[]
  searchTerms: SearchTermAnalysis | null
  devices: SegmentAnalysis | null
  locations: SegmentAnalysis | null
  ads: { totalCost: number; flaggedCost: number } | null
}

const problemCost = (findings: Finding[], area: FindingArea) =>
  findings
    .filter((f) => f.area === area && f.kind === "problem")
    .reduce((s, f) => s + f.cost, 0)

function scored(
  area: IndexArea,
  flagged: number,
  base: number,
  what: string,
  money: (v: number) => string
): AreaScore {
  const s = Math.min(1, flagged / base)
  return {
    area,
    label: INDEX_LABEL[area],
    score: Math.round(100 * (1 - s)),
    basis: `${share(s)} kosztu (${money(flagged)} z ${money(base)}) w ${what} z wykrytymi problemami.`,
  }
}

const notAssessed = (area: IndexArea, reason: string): AreaScore => ({
  area,
  label: INDEX_LABEL[area],
  score: null,
  basis: reason,
})

export function efficiencyIndex({
  ctx,
  findings,
  searchTerms,
  devices,
  locations,
  ads,
}: Inputs): EfficiencyIndex {
  const { data, money } = ctx
  const accountCost = data.totals.cost ?? 0
  const hasConversions = (data.totals.conversions ?? 0) > 0
  const areas: AreaScore[] = []

  // Campaigns.
  if (
    data.primary &&
    data.campaigns.some((c) => c.primary) &&
    accountCost > 0 &&
    hasConversions
  )
    areas.push(
      scored(
        "campaigns",
        problemCost(findings, "campaign"),
        accountCost,
        "kampaniach",
        money
      )
    )
  else
    areas.push(notAssessed("campaigns", "Brak raportu kampanii z kosztem i konwersjami."))

  // Keywords.
  const kwReport = pickKeywordReport(ctx)
  const kwCost = kwReport
    ? (sumMetrics(kwReport.records.map((r) => r.metrics)).cost ?? 0)
    : 0
  if (kwReport && kwCost > 0)
    areas.push(
      scored(
        "keywords",
        problemCost(findings, "keyword"),
        kwCost,
        "słowach kluczowych",
        money
      )
    )
  else areas.push(notAssessed("keywords", "Brak raportu słów kluczowych."))

  // Traffic quality: search-term spend that is off-intent without conversions or suggested for exclusion.
  const stCost = searchTerms?.base.metrics.cost ?? 0
  if (searchTerms && stCost > 0) {
    const off = searchTerms.rows
      .filter(
        (r) =>
          r.suggestion === "exclude" ||
          ((r.intent.unwanted !== null || r.intent.intent === "unrelated") &&
            (r.metrics.conversions ?? 0) === 0)
      )
      .reduce((s, r) => s + (r.metrics.cost ?? 0), 0)
    areas.push(
      scored(
        "traffic",
        off,
        stCost,
        "zapytaniach niepożądanych lub bez konwersji (wg heurystyki)",
        money
      )
    )
  } else areas.push(notAssessed("traffic", "Brak raportu wyszukiwanych haseł."))

  const segment = (
    area: IndexArea,
    a: SegmentAnalysis | null,
    findingArea: FindingArea,
    what: string,
    missing: string
  ) => {
    const base = a?.base.metrics.cost ?? 0
    if (a && base > 0 && a.base.cr)
      areas.push(scored(area, problemCost(findings, findingArea), base, what, money))
    else areas.push(notAssessed(area, missing))
  }
  segment(
    "devices",
    devices,
    "device",
    "urządzeniach",
    "Brak raportu urządzeń z konwersjami."
  )
  segment(
    "locations",
    locations,
    "location",
    "lokalizacjach",
    "Brak raportu lokalizacji z konwersjami."
  )

  if (ads && ads.totalCost > 0)
    areas.push(scored("ads", ads.flaggedCost, ads.totalCost, "reklamach", money))
  else areas.push(notAssessed("ads", "Brak raportu reklam."))

  // Cost control: spend with a significant lack of conversions, at the most detailed level
  // available (keywords or search terms), against the whole account.
  const zeroKw = findings.filter((f) => f.rule === "B1").reduce((s, f) => s + f.cost, 0)
  const zeroSt =
    searchTerms?.rows
      .filter((r) => r.suggestion === "exclude")
      .reduce((s, r) => s + (r.metrics.cost ?? 0), 0) ?? 0
  if (accountCost > 0 && hasConversions && (kwReport || searchTerms)) {
    const wasted = Math.max(zeroKw, zeroSt)
    const s = scored("costControl", wasted, accountCost, "", money)
    areas.push({
      ...s,
      basis: `${share(Math.min(1, wasted / accountCost))} kosztu konta (${money(wasted)} z ${money(accountCost)}) poszło na słowa lub hasła bez konwersji mimo wystarczającej liczby kliknięć.`,
    })
  } else
    areas.push(
      notAssessed(
        "costControl",
        "Wymaga raportu kampanii oraz raportu słów kluczowych lub wyszukiwanych haseł."
      )
    )

  const assessed = areas.filter((a) => a.score !== null)
  return {
    overall: assessed.length
      ? Math.round(assessed.reduce((s, a) => s + a.score!, 0) / assessed.length)
      : null,
    areas,
    assessed: assessed.length,
    completeness: assessed.length / areas.length,
  }
}
