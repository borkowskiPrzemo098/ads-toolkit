import { formatMoney } from "../format"
import type { AuditDataset } from "../join"
import { kpisOf, type Kpis, type Metrics } from "../metrics"
import type { NormalizedReport } from "../normalize"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { formatPeriod } from "@/lib/reports/dates"

/** Optional user goals; without them the account's own averages are the benchmark. */
export interface AuditTargets {
  cpa: number | null
  /** In percent, like the dashboard: 400 = 400%. */
  roas: number | null
}

export interface RuleContext {
  data: AuditDataset
  targets: AuditTargets
  money: (v: number) => string
}

export function makeContext(data: AuditDataset, targets: AuditTargets): RuleContext {
  return { data, targets, money: (v) => formatMoney(v, data.currency) }
}

/** Account-level averages used as the benchmark. */
export interface Baseline {
  metrics: Metrics
  kpis: Kpis
  /** Conversion rate as a fraction (0.035), or null without clicks/conversions. */
  cr: number | null
  cpa: number | null
  /** ROAS in percent. */
  roas: number | null
}

export function baselineOf(metrics: Metrics): Baseline {
  const kpis = kpisOf(metrics)
  return {
    metrics,
    kpis,
    cr:
      kpis.conversionRate.ok && kpis.conversionRate.value > 0
        ? kpis.conversionRate.value / 100
        : null,
    cpa: kpis.cpa.ok ? kpis.cpa.value : null,
    roas: kpis.roas.ok ? kpis.roas.value : null,
  }
}

export const periodOf = (r: NormalizedReport) =>
  r.period ? formatPeriod(r.period.from, r.period.to) : null

export const n0 = (v: number | null) => (v === null ? "—" : formatNumber(v))
export const n1 = (v: number | null) =>
  v === null ? "—" : formatNumber(v, v % 1 ? 1 : 0)
export const pct = (v: number, digits = 1) => formatPercent(v, digits)
export const share = (fraction: number) => formatPercent(fraction * 100, 0)
