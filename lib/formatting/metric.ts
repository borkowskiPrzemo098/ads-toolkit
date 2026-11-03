import type { MetricKind } from "@/constants/profitability"
import type { CalcResult } from "@/types/calculation"
import { formatCurrency, formatPercent, type Currency } from "./number"

export function formatMetricValue(value: number, kind: MetricKind, currency: Currency) {
  return kind === "currency" ? formatCurrency(value, currency) : formatPercent(value, 1)
}

/** Formatted value, or null when the metric cannot be computed. */
export function formatMetric(result: CalcResult, kind: MetricKind, currency: Currency) {
  return result.ok ? formatMetricValue(result.value, kind, currency) : null
}

/**
 * Difference B − A. Percent metrics differ in percentage points, so "p.p." instead of "%".
 * Returns a signed string, e.g. "+120,00 zł" or "−3,2 p.p.".
 */
export function formatDelta(a: number, b: number, kind: MetricKind, currency: Currency) {
  const delta = b - a
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : ""
  const magnitude = Math.abs(delta)
  const body =
    kind === "currency"
      ? formatCurrency(magnitude, currency)
      : `${formatPercent(magnitude, 1).replace("%", "")} p.p.`
  return `${sign}${body}`
}
