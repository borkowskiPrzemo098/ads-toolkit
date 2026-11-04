import { kpisOf, type Kpis, type Totals } from "@/lib/reports/aggregate"
import { METRICS, type Metric } from "@/lib/reports/import"

/**
 * Base metrics of one record or a sum of records. null = the report has no such column
 * (not zero). KPIs reuse the PPC report formulas: CTR = clicks / impressions × 100%,
 * CPC = cost / clicks, conversion rate = conversions / clicks × 100%, CPA = cost / conversions,
 * ROAS = conversion value / cost × 100%; a zero or missing denominator gives "N/D" with a reason.
 */
export type Metrics = Totals
export type { Kpis, Metric }
export { METRICS, kpisOf }

export const emptyMetrics = (): Metrics => ({
  impressions: null,
  clicks: null,
  cost: null,
  conversions: null,
  conversionValue: null,
})

/** Adds b into a, keeping null only while neither side has the metric. */
export function addInto(a: Metrics, b: Metrics): Metrics {
  for (const m of METRICS) {
    const v = b[m]
    if (v !== null) a[m] = (a[m] ?? 0) + v
  }
  return a
}

export function sumMetrics(items: Metrics[]): Metrics {
  return items.reduce((acc, m) => addInto(acc, m), emptyMetrics())
}

/** Relative difference of b against a: 0.05 = 5% more. null when a is 0 or either is missing. */
export function relativeDiff(a: number | null, b: number | null): number | null {
  if (a === null || b === null || a === 0) return null
  return (b - a) / Math.abs(a)
}
