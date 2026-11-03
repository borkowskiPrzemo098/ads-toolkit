import { calcFail, calcOk, type CalcResult } from "@/types/calculation"
import { METRICS, type Metric, type ReportRow } from "./import"

/** Sums per metric; null when no row had that metric at all (column missing). */
export type Totals = Record<Metric, number | null>

export function totalsOf(rows: ReportRow[]): Totals {
  const totals = {} as Totals
  for (const metric of METRICS) {
    const values = rows.map((r) => r[metric]).filter((v): v is number => v !== null)
    totals[metric] = values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  return totals
}

export interface Kpis {
  ctr: CalcResult
  cpc: CalcResult
  cpa: CalcResult
  conversionRate: CalcResult
  roas: CalcResult
  avgConversionValue: CalcResult
}

const MISSING: Record<Metric, string> = {
  impressions: "Brak danych o wyświetleniach.",
  clicks: "Brak danych o kliknięciach.",
  cost: "Brak danych o koszcie.",
  conversions: "Brak danych o konwersjach.",
  conversionValue: "Brak danych o wartości konwersji.",
}

function ratio(t: Totals, num: Metric, den: Metric, zero: string, scale = 1): CalcResult {
  const n = t[num]
  const d = t[den]
  if (n === null) return calcFail(MISSING[num])
  if (d === null) return calcFail(MISSING[den])
  if (d === 0) return calcFail(zero)
  return calcOk((n / d) * scale)
}

export function kpisOf(t: Totals): Kpis {
  return {
    ctr: ratio(t, "clicks", "impressions", "Brak wyświetleń.", 100),
    cpc: ratio(t, "cost", "clicks", "Brak kliknięć."),
    cpa: ratio(t, "cost", "conversions", "Brak konwersji."),
    conversionRate: ratio(t, "conversions", "clicks", "Brak kliknięć.", 100),
    roas: ratio(t, "conversionValue", "cost", "Brak kosztu.", 100),
    avgConversionValue: ratio(t, "conversionValue", "conversions", "Brak konwersji."),
  }
}

export interface Breakdown<K extends string> {
  key: K
  totals: Totals
  kpis: Kpis
}

/** Totals per day (or week/month, whatever the date column holds), oldest first. */
export function byDate(rows: ReportRow[]): Breakdown<string>[] | null {
  if (!rows.some((r) => r.date)) return null
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) {
    if (!row.date) continue
    groups.set(row.date, [...(groups.get(row.date) ?? []), row])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const totals = totalsOf(list)
      return { key, totals, kpis: kpisOf(totals) }
    })
}

/** Totals per campaign, highest cost first. */
export function byCampaign(rows: ReportRow[]): Breakdown<string>[] | null {
  if (!rows.some((r) => r.campaign)) return null
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) {
    const key = row.campaign ?? "(bez nazwy)"
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const totals = totalsOf(list)
      return { key, totals, kpis: kpisOf(totals) }
    })
    .sort(
      (a, b) =>
        (b.totals.cost ?? 0) - (a.totals.cost ?? 0) || a.key.localeCompare(b.key, "pl")
    )
}

export function dateRange(rows: ReportRow[]): { from: string; to: string } | null {
  const dates = rows
    .map((r) => r.date)
    .filter((d): d is string => d !== null)
    .sort()
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null
}

/** Relative change in percent; null when there is no baseline to compare with. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function budgetUse(cost: number | null, budget: number | null): CalcResult {
  if (budget === null) return calcFail("Podaj budżet, aby zobaczyć jego wykorzystanie.")
  if (budget <= 0) return calcFail("Budżet musi być większy od zera.")
  if (cost === null) return calcFail(MISSING.cost)
  return calcOk((cost / budget) * 100)
}

export interface PeriodSummary {
  totals: Totals
  kpis: Kpis
  daily: Breakdown<string>[] | null
  campaigns: Breakdown<string>[] | null
  range: { from: string; to: string } | null
}

export function summarize(rows: ReportRow[]): PeriodSummary {
  const totals = totalsOf(rows)
  return {
    totals,
    kpis: kpisOf(totals),
    daily: byDate(rows),
    campaigns: byCampaign(rows),
    range: dateRange(rows),
  }
}
