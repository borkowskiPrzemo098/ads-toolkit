import { formatPeriod } from "@/lib/reports/dates"
import type { CalcResult } from "@/types/calculation"
import { REPORT_TYPES } from "./detect"
import type { AuditDataset } from "./join"
import {
  addInto,
  emptyMetrics,
  kpisOf,
  relativeDiff,
  type Metric,
  type Metrics,
} from "./metrics"
import type { NormalizedReport } from "./normalize"
import { T } from "./thresholds"

/*
 * Period comparison (spec section 9). Two sources: two reports of the same type covering
 * different periods, or one daily report split into "last N days vs previous N days".
 * Periods of different length are compared per day for volume metrics; ratios (CTR, CPC,
 * CPA, ROAS) need no normalisation. Unreliable comparisons carry a warning.
 */

interface Window {
  from: string
  to: string
  days: number
}

interface Side {
  label: string
  window: Window
  metrics: Metrics
  campaigns: Map<string, { name: string; metrics: Metrics }>
}

export interface ComparisonOption {
  id: string
  label: string
}

export type MetricKey = Metric | "ctr" | "cpc" | "cpa" | "roas"

export interface MetricRow {
  key: MetricKey
  label: string
  previous: number | null
  current: number | null
  change: number | null
  /** Relative change, 0.1 = +10%. */
  changePct: number | null
  /** Whether the direction is good for the advertiser; null = neutral (cost). */
  good: boolean | null
  kind: "money" | "number" | "percent"
  perDay: boolean
}

export interface CampaignChange {
  name: string
  metric: "CPA" | "ROAS"
  previous: number
  current: number
  changePct: number
  conversions: [number, number]
}

export interface Comparison {
  previous: Side
  current: Side
  normalized: boolean
  warnings: string[]
  rows: MetricRow[]
  improved: CampaignChange[]
  worsened: CampaignChange[]
}

const DAY = 86_400_000
const daysOf = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1
const shift = (iso: string, d: number) =>
  new Date(Date.parse(iso) + d * DAY).toISOString().slice(0, 10)

/** Every comparison the imported data allow. */
export function comparisonOptions(data: AuditDataset): ComparisonOption[] {
  const out: ComparisonOption[] = []
  const withPeriod = data.reports.filter(
    (r) => r.period && r.records.some((x) => x.metrics.cost !== null)
  )
  for (let i = 0; i < withPeriod.length; i++)
    for (let j = i + 1; j < withPeriod.length; j++) {
      const [a, b] = [withPeriod[i], withPeriod[j]].sort((x, y) =>
        x.period!.from.localeCompare(y.period!.from)
      )
      if (
        a.type !== b.type ||
        (a.period!.from === b.period!.from && a.period!.to === b.period!.to)
      )
        continue
      out.push({
        id: `pair:${a.id}:${b.id}`,
        label: `${REPORT_TYPES[a.type].label}: ${formatPeriod(a.period!.from, a.period!.to)} → ${formatPeriod(b.period!.from, b.period!.to)}`,
      })
    }
  for (const r of data.reports) {
    const dates = r.records
      .map((x) => x.dims.date)
      .filter((d): d is string => !!d)
      .sort()
    if (!dates.length) continue
    const span = daysOf(dates[0], dates[dates.length - 1])
    if (span < 14) continue
    const n = Math.floor(span / 2)
    out.push({
      id: `split:${r.id}:${n}`,
      label: `${r.name}: ostatnie ${n} dni wobec poprzednich ${n}`,
    })
  }
  return out
}

function side(
  data: AuditDataset,
  report: NormalizedReport,
  window: Window,
  byDate: boolean
): Side {
  const keys = data.campaignKeyOf.get(report.id) ?? []
  const names = new Map(data.campaigns.map((c) => [c.key, c.name]))
  const metrics = emptyMetrics()
  const campaigns = new Map<string, { name: string; metrics: Metrics }>()
  report.records.forEach((r, i) => {
    if (byDate && (!r.dims.date || r.dims.date < window.from || r.dims.date > window.to))
      return
    addInto(metrics, r.metrics)
    const k = keys[i]
    if (!k) return
    const c = campaigns.get(k) ?? { name: names.get(k) ?? k, metrics: emptyMetrics() }
    addInto(c.metrics, r.metrics)
    campaigns.set(k, c)
  })
  return { label: formatPeriod(window.from, window.to), window, metrics, campaigns }
}

export function compare(data: AuditDataset, id: string): Comparison | null {
  const [kind, a, b] = id.split(":")
  let previous: Side
  let current: Side
  if (kind === "pair") {
    const ra = data.reports.find((r) => r.id === a)
    const rb = data.reports.find((r) => r.id === b)
    if (!ra?.period || !rb?.period) return null
    previous = side(
      data,
      ra,
      {
        from: ra.period.from,
        to: ra.period.to,
        days: daysOf(ra.period.from, ra.period.to),
      },
      false
    )
    current = side(
      data,
      rb,
      {
        from: rb.period.from,
        to: rb.period.to,
        days: daysOf(rb.period.from, rb.period.to),
      },
      false
    )
  } else {
    const r = data.reports.find((x) => x.id === a)
    const n = Number(b)
    if (!r || !n) return null
    const last = r.records
      .map((x) => x.dims.date)
      .filter((d): d is string => !!d)
      .sort()
      .at(-1)!
    const cur = { from: shift(last, -(n - 1)), to: last, days: n }
    const prev = { from: shift(cur.from, -n), to: shift(cur.from, -1), days: n }
    previous = side(data, r, prev, true)
    current = side(data, r, cur, true)
  }

  const warnings: string[] = []
  const normalized = previous.window.days !== current.window.days
  if (normalized)
    warnings.push(
      `Okresy mają różną długość (${previous.window.days} i ${current.window.days} dni): koszt, kliknięcia, wyświetlenia, konwersje i wartość porównujemy jako średnie dzienne.`
    )
  if (previous.window.to >= current.window.from)
    warnings.push(
      "Okresy nachodzą na siebie: część dni jest w obu okresach, więc zmiany są zaniżone."
    )
  const minConv = Math.min(
    previous.metrics.conversions ?? 0,
    current.metrics.conversions ?? 0
  )
  if (minConv < 10)
    warnings.push(
      `W jednym z okresów jest tylko ${minConv} konwersji: zmiany CPA i współczynnika konwersji mogą być przypadkowe.`
    )

  const per = (m: Metrics, days: number): Metrics => {
    if (!normalized) return m
    const out = emptyMetrics()
    for (const k of Object.keys(m) as Metric[])
      out[k] = m[k] === null ? null : m[k]! / days
    return out
  }
  const p = per(previous.metrics, previous.window.days)
  const c = per(current.metrics, current.window.days)
  const kp = kpisOf(previous.metrics)
  const kc = kpisOf(current.metrics)
  const val = (r: CalcResult) => (r.ok ? r.value : null)
  const row = (
    key: MetricKey,
    label: string,
    prev: number | null,
    cur: number | null,
    kind: MetricRow["kind"],
    up: boolean | null,
    perDay: boolean
  ): MetricRow => {
    const change = prev !== null && cur !== null ? cur - prev : null
    const changePct = relativeDiff(prev, cur)
    return {
      key,
      label,
      previous: prev,
      current: cur,
      change,
      changePct,
      good: up === null || change === null || change === 0 ? null : up === change > 0,
      kind,
      perDay,
    }
  }
  const rows: MetricRow[] = [
    row("cost", "Koszt", p.cost, c.cost, "money", null, normalized),
    row("clicks", "Kliknięcia", p.clicks, c.clicks, "number", true, normalized),
    row(
      "impressions",
      "Wyświetlenia",
      p.impressions,
      c.impressions,
      "number",
      true,
      normalized
    ),
    row("ctr", "CTR", val(kp.ctr), val(kc.ctr), "percent", true, false),
    row("cpc", "Śr. CPC", val(kp.cpc), val(kc.cpc), "money", false, false),
    row(
      "conversions",
      "Konwersje",
      p.conversions,
      c.conversions,
      "number",
      true,
      normalized
    ),
    row("cpa", "CPA", val(kp.cpa), val(kc.cpa), "money", false, false),
    row(
      "conversionValue",
      "Wartość konwersji",
      p.conversionValue,
      c.conversionValue,
      "money",
      true,
      normalized
    ),
    row("roas", "ROAS", val(kp.roas), val(kc.roas), "percent", true, false),
  ]

  // Campaigns: CPA change where both periods have enough conversions; ROAS when value exists.
  const changes: CampaignChange[] = []
  for (const [key, cur] of current.campaigns) {
    const prev = previous.campaigns.get(key)
    if (!prev) continue
    const a1 = kpisOf(prev.metrics)
    const a2 = kpisOf(cur.metrics)
    const conv: [number, number] = [
      prev.metrics.conversions ?? 0,
      cur.metrics.conversions ?? 0,
    ]
    if (conv[0] < T.swingMinConversions || conv[1] < T.swingMinConversions) continue
    if (a1.roas.ok && a2.roas.ok && (prev.metrics.conversionValue ?? 0) > 0) {
      const ch = relativeDiff(a1.roas.value, a2.roas.value)
      if (ch !== null)
        changes.push({
          name: cur.name,
          metric: "ROAS",
          previous: a1.roas.value,
          current: a2.roas.value,
          changePct: ch,
          conversions: conv,
        })
    } else if (a1.cpa.ok && a2.cpa.ok) {
      const ch = relativeDiff(a1.cpa.value, a2.cpa.value)
      // Lower CPA is better: flip the sign so "improvement" is positive for both metrics.
      if (ch !== null)
        changes.push({
          name: cur.name,
          metric: "CPA",
          previous: a1.cpa.value,
          current: a2.cpa.value,
          changePct: ch,
          conversions: conv,
        })
    }
  }
  const score = (x: CampaignChange) => (x.metric === "CPA" ? -x.changePct : x.changePct)
  const improved = changes
    .filter((x) => score(x) > 0)
    .sort((x, y) => score(y) - score(x))
    .slice(0, 3)
  const worsened = changes
    .filter((x) => score(x) < 0)
    .sort((x, y) => score(x) - score(y))
    .slice(0, 3)

  return { previous, current, normalized, warnings, rows, improved, worsened }
}
