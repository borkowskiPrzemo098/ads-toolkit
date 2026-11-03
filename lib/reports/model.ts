import type { Currency } from "@/lib/formatting/number"
import {
  budgetUse,
  change,
  type Kpis,
  type PeriodSummary,
  type Totals,
} from "./aggregate"
import { formatShortDate } from "./dates"
import type { ReportTexts } from "./insights"

export interface ReportLogo {
  dataUrl: string
  format: "PNG" | "JPEG"
  width: number
  height: number
}

export interface ReportSettings {
  clientName: string
  campaignName: string
  periodLabel: string
  comparisonLabel: string
  budget: number | null
  agencyName: string
  logo: ReportLogo | null
  currency: Currency
}

export interface ReportModel {
  settings: ReportSettings
  current: PeriodSummary
  previous: PeriodSummary | null
  texts: ReportTexts
}

export type ChartMetric = "cost" | "clicks" | "conversions" | "roas"

export const CHART_TITLE: Record<ChartMetric, string> = {
  cost: "Koszt",
  clicks: "Kliknięcia",
  conversions: "Konwersje",
  roas: "ROAS (%)",
}

export interface ChartSeries {
  mode: "daily" | "campaign" | "periods"
  labels: string[]
  values: (number | null)[]
}

const metricOf = (totals: Totals, kpis: Kpis, metric: ChartMetric): number | null =>
  metric === "roas" ? (kpis.roas.ok ? kpis.roas.value : null) : totals[metric]

/**
 * Data for one chart, using the richest breakdown available: by day, then by campaign,
 * then the two periods side by side. Null when there is nothing meaningful to draw.
 */
export function chartSeries(model: ReportModel, metric: ChartMetric): ChartSeries | null {
  const { current, previous, settings } = model
  let series: ChartSeries | null = null
  if (current.daily && current.daily.length > 1) {
    series = {
      mode: "daily",
      labels: current.daily.map((d) => formatShortDate(d.key)),
      values: current.daily.map((d) => metricOf(d.totals, d.kpis, metric)),
    }
  } else if (current.campaigns && current.campaigns.length > 1) {
    series = {
      mode: "campaign",
      labels: current.campaigns.map((c) => c.key),
      values: current.campaigns.map((c) => metricOf(c.totals, c.kpis, metric)),
    }
  } else if (previous) {
    series = {
      mode: "periods",
      labels: [
        settings.comparisonLabel || "Poprzedni okres",
        settings.periodLabel || "Bieżący okres",
      ],
      values: [
        metricOf(previous.totals, previous.kpis, metric),
        metricOf(current.totals, current.kpis, metric),
      ],
    }
  }
  if (!series || series.values.every((v) => v === null)) return null
  return series
}

export type KpiKey =
  | "cost"
  | "impressions"
  | "clicks"
  | "conversions"
  | "conversionValue"
  | "ctr"
  | "cpc"
  | "cpa"
  | "roas"
  | "budgetUse"

export interface KpiLine {
  key: KpiKey
  label: string
  kind: "currency" | "count" | "percent"
  value: number | null
  previous: number | null
  change: number | null
  /** Whether a rise is good (green), bad (red) or neither. */
  better: "higher" | "lower" | null
}

/** Every KPI in the report, with the comparison period when available. */
export function kpiLines(model: ReportModel): KpiLine[] {
  const { current: c, previous: p, settings } = model
  const val = (r: { ok: boolean; value?: number }) => (r.ok ? (r.value as number) : null)
  const use = budgetUse(c.totals.cost, settings.budget)

  const lines: Omit<KpiLine, "change">[] = [
    {
      key: "cost",
      label: "Koszt",
      kind: "currency",
      value: c.totals.cost,
      previous: p?.totals.cost ?? null,
      better: null,
    },
    {
      key: "conversions",
      label: "Konwersje",
      kind: "count",
      value: c.totals.conversions,
      previous: p?.totals.conversions ?? null,
      better: "higher",
    },
    {
      key: "cpa",
      label: "CPA",
      kind: "currency",
      value: val(c.kpis.cpa),
      previous: p ? val(p.kpis.cpa) : null,
      better: "lower",
    },
    {
      key: "roas",
      label: "ROAS",
      kind: "percent",
      value: val(c.kpis.roas),
      previous: p ? val(p.kpis.roas) : null,
      better: "higher",
    },
    {
      key: "conversionValue",
      label: "Wartość konwersji",
      kind: "currency",
      value: c.totals.conversionValue,
      previous: p?.totals.conversionValue ?? null,
      better: "higher",
    },
    {
      key: "clicks",
      label: "Kliknięcia",
      kind: "count",
      value: c.totals.clicks,
      previous: p?.totals.clicks ?? null,
      better: "higher",
    },
    {
      key: "impressions",
      label: "Wyświetlenia",
      kind: "count",
      value: c.totals.impressions,
      previous: p?.totals.impressions ?? null,
      better: "higher",
    },
    {
      key: "ctr",
      label: "CTR",
      kind: "percent",
      value: val(c.kpis.ctr),
      previous: p ? val(p.kpis.ctr) : null,
      better: "higher",
    },
    {
      key: "cpc",
      label: "CPC",
      kind: "currency",
      value: val(c.kpis.cpc),
      previous: p ? val(p.kpis.cpc) : null,
      better: "lower",
    },
    {
      key: "budgetUse",
      label: "Wykorzystanie budżetu",
      kind: "percent",
      value: val(use),
      previous: null,
      better: null,
    },
  ]
  return lines
    .filter((l) => l.value !== null)
    .map((l) => ({ ...l, change: change(l.value, l.previous) }))
}

export const EMPTY_SETTINGS: ReportSettings = {
  clientName: "",
  campaignName: "",
  periodLabel: "",
  comparisonLabel: "",
  budget: null,
  agencyName: "",
  logo: null,
  currency: "PLN",
}
