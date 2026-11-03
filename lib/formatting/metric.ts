import type { CalcResult } from "@/types/calculation"
import { formatCurrency, formatNumber, formatPercent, type Currency } from "./number"

/** count: whole events (clicks); decimal: one decimal place (forecast conversions). */
export type MetricKind = "currency" | "percent" | "count" | "decimal"

export function formatMetricValue(value: number, kind: MetricKind, currency: Currency) {
  switch (kind) {
    case "currency":
      return formatCurrency(value, currency)
    case "percent":
      return formatPercent(value, 1)
    case "count":
      return formatNumber(Math.round(value))
    case "decimal":
      return formatNumber(value, 1)
  }
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
    kind === "percent"
      ? `${formatPercent(magnitude, 1).replace("%", "")} p.p.`
      : formatMetricValue(magnitude, kind, currency)
  return `${sign}${body}`
}
