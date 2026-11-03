import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Currency,
} from "@/lib/formatting/number"
import type { KpiLine } from "./model"

export function formatKpi(
  line: Pick<KpiLine, "kind">,
  value: number,
  currency: Currency
) {
  if (line.kind === "currency") return formatCurrency(value, currency)
  if (line.kind === "percent") return formatPercent(value, value < 10 ? 2 : 0)
  return formatNumber(value, value % 1 ? 1 : 0)
}

export function formatChange(change: number): string {
  return `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatPercent(Math.abs(change), 0)}`
}

/** "good" when the change goes the desired way, "bad" when not, "neutral" otherwise. */
export function changeTone(
  line: Pick<KpiLine, "better" | "change">
): "good" | "bad" | "neutral" {
  if (line.change === null || line.better === null || Math.abs(line.change) < 1)
    return "neutral"
  const improved = line.better === "higher" ? line.change > 0 : line.change < 0
  return improved ? "good" : "bad"
}
