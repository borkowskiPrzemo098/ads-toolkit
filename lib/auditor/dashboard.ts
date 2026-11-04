import { REPORT_TYPES } from "./detect"
import type { AuditDataset, CampaignEntity } from "./join"
import { addInto, emptyMetrics, kpisOf, type Kpis, type Metrics } from "./metrics"
import type {
  CampaignStatus,
  Device,
  NormalizedRecord,
  NormalizedReport,
} from "./normalize"

/*
 * Dashboard model. Every number on the dashboard comes from ONE report: the highest-level
 * report that can answer the active filters (a device filter needs a device report, a period
 * filter needs a date column). Detailed reports are never summed with the account totals.
 */

export interface DashboardFilters {
  campaign: string | null
  campaignType: string | null
  campaignStatus: CampaignStatus | null
  device: Device | null
  location: string | null
  /** ISO dates, inclusive; only applied when the source report has a date column. */
  from: string | null
  to: string | null
}

export const NO_FILTERS: DashboardFilters = {
  campaign: null,
  campaignType: null,
  campaignStatus: null,
  device: null,
  location: null,
  from: null,
  to: null,
}

export const DEVICE_LABEL: Record<Device, string> = {
  desktop: "Komputery",
  mobile: "Telefony",
  tablet: "Tablety",
  tv: "Ekrany TV",
  other: "Inne",
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  enabled: "Włączone",
  paused: "Wstrzymane",
  removed: "Usunięte",
}

export interface FilterOptions {
  campaigns: { value: string; label: string }[]
  campaignTypes: string[]
  statuses: CampaignStatus[]
  devices: Device[]
  locations: string[]
  /** Day range covered by reports with a date column; null = no daily data. */
  dates: { from: string; to: string } | null
}

const uniqueSorted = <T extends string>(values: (T | undefined)[]) =>
  [...new Set(values.filter((v): v is T => !!v))].sort((a, b) => a.localeCompare(b, "pl"))

export function filterOptions(data: AuditDataset): FilterOptions {
  const records = data.reports.flatMap((r) => r.records)
  const dates = records
    .map((r) => r.dims.date)
    .filter((d): d is string => !!d)
    .sort()
  return {
    campaigns: data.campaigns.map((c) => ({ value: c.key, label: c.name })),
    campaignTypes: uniqueSorted(data.campaigns.map((c) => c.type)),
    statuses: uniqueSorted(
      data.campaigns.map((c) => c.status as CampaignStatus | undefined)
    ),
    devices: uniqueSorted(records.map((r) => r.dims.device)),
    locations: uniqueSorted(records.map((r) => r.dims.location)),
    dates: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  }
}

interface Row {
  record: NormalizedRecord
  campaign: CampaignEntity | null
}

const rowsOf = (data: AuditDataset, report: NormalizedReport): Row[] => {
  const keys = data.campaignKeyOf.get(report.id) ?? []
  const byKey = new Map(data.campaigns.map((c) => [c.key, c]))
  return report.records.map((record, i) => ({
    record,
    campaign: keys[i] ? (byKey.get(keys[i]!) ?? null) : null,
  }))
}

const hasCost = (r: NormalizedReport) => r.records.some((x) => x.metrics.cost !== null)
const hasDim = (r: NormalizedReport, dim: keyof NormalizedRecord["dims"]) =>
  r.records.some((x) => x.dims[dim] !== undefined)

/** Dimensions a report must have to answer the filters (campaign attributes come via joins). */
function needs(f: DashboardFilters): (keyof NormalizedRecord["dims"])[] {
  const n: (keyof NormalizedRecord["dims"])[] = []
  if (f.device) n.push("device")
  if (f.location) n.push("location")
  if (f.from || f.to) n.push("date")
  return n
}

/**
 * Report for the numbers: the totals report when it can answer the filters, otherwise the
 * highest-level report that can. Campaign, type and status filters need campaign-joined rows.
 */
export function pickSource(
  data: AuditDataset,
  f: DashboardFilters,
  extra: (keyof NormalizedRecord["dims"])[] = []
): NormalizedReport | null {
  const required = [...needs(f), ...extra]
  const campaignFilter = f.campaign || f.campaignType || f.campaignStatus
  const candidates = data.reports.filter(
    (r) =>
      hasCost(r) &&
      required.every((d) => hasDim(r, d)) &&
      (!campaignFilter || (data.campaignKeyOf.get(r.id) ?? []).some(Boolean))
  )
  const order = (r: NormalizedReport) =>
    (r === data.primary ? -1 : 0) * 100 + REPORT_TYPES[r.type].level
  return (
    [...candidates].sort(
      (a, b) => order(a) - order(b) || b.records.length - a.records.length
    )[0] ?? null
  )
}

function matches(row: Row, f: DashboardFilters): boolean {
  const d = row.record.dims
  if (f.campaign && row.campaign?.key !== f.campaign) return false
  if (f.campaignType && row.campaign?.type !== f.campaignType) return false
  if (f.campaignStatus && row.campaign?.status !== f.campaignStatus) return false
  if (f.device && d.device !== f.device) return false
  if (f.location && d.location !== f.location) return false
  if (f.from && (!d.date || d.date < f.from)) return false
  if (f.to && (!d.date || d.date > f.to)) return false
  return true
}

export interface Point {
  /** ISO day, or the Monday of the week when aggregated weekly. */
  date: string
  metrics: Metrics
  kpis: Kpis
}

export interface CampaignRow {
  key: string
  name: string
  metrics: Metrics
  kpis: Kpis
  /** Share of the filtered cost, 0–1; null without cost. */
  costShare: number | null
}

export type Unavailable = { reason: string }

export interface DashboardModel {
  source: NormalizedReport | null
  /** Set when no report can answer the filters at all. */
  unavailable: string | null
  /** Why the main source is not the totals report (e.g. a device filter). */
  sourceNote: string | null
  records: number
  totals: Metrics
  kpis: Kpis
  series:
    | { source: NormalizedReport; granularity: "day" | "week"; points: Point[] }
    | Unavailable
  campaigns: { source: NormalizedReport; rows: CampaignRow[] } | Unavailable
}

/** Weekly points above this many days, so a quarter stays readable. */
export const DAILY_LIMIT = 62

const monday = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  const shift = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - shift)
  return d.toISOString().slice(0, 10)
}

export function buildDashboard(data: AuditDataset, f: DashboardFilters): DashboardModel {
  const source = pickSource(data, f)
  const rows = source ? rowsOf(data, source).filter((r) => matches(r, f)) : []
  const totals = rows.reduce((acc, r) => addInto(acc, r.record.metrics), emptyMetrics())

  let sourceNote: string | null = null
  if (source && source !== data.primary)
    sourceNote = `Przy tych filtrach liczby pochodzą z raportu „${source.name}” (${REPORT_TYPES[source.type].label.toLowerCase()}), bo raport z sumami konta nie ma potrzebnych kolumn.`

  // Time series: the best report with a date column that also answers the filters.
  const timeSource = pickSource(data, f, ["date"])
  let series: DashboardModel["series"]
  if (!timeSource) {
    const anyDaily = data.reports.some((r) => hasCost(r) && hasDim(r, "date"))
    series = {
      reason: anyDaily
        ? "Raporty z datą dnia nie mają kolumn potrzebnych do wybranych filtrów (np. urządzenia), więc wykresów w czasie nie można pokazać dla tego zawężenia."
        : "Żaden raport nie ma kolumny z datą dnia. W Google Ads dodaj segment „Dzień” (Segment → Czas → Dzień) i wyeksportuj raport ponownie.",
    }
  } else {
    const byDay = new Map<string, Metrics>()
    for (const r of rowsOf(data, timeSource)) {
      if (!r.record.dims.date || !matches(r, f)) continue
      const day = r.record.dims.date
      byDay.set(day, addInto(byDay.get(day) ?? emptyMetrics(), r.record.metrics))
    }
    const days = [...byDay.keys()].sort()
    const weekly = days.length > DAILY_LIMIT
    const grouped = new Map<string, Metrics>()
    for (const day of days) {
      const k = weekly ? monday(day) : day
      grouped.set(k, addInto(grouped.get(k) ?? emptyMetrics(), byDay.get(day)!))
    }
    series = {
      source: timeSource,
      granularity: weekly ? "week" : "day",
      points: [...grouped].map(([date, metrics]) => ({
        date,
        metrics,
        kpis: kpisOf(metrics),
      })),
    }
  }

  // Campaign breakdown from the same source as the totals, so the bars add up to the KPIs.
  let campaigns: DashboardModel["campaigns"]
  if (!source || !rows.some((r) => r.campaign)) {
    campaigns = {
      reason: "Raport, z którego pochodzą liczby, nie ma kolumny z kampanią.",
    }
  } else {
    const byCampaign = new Map<string, { entity: CampaignEntity; metrics: Metrics }>()
    for (const r of rows) {
      if (!r.campaign) continue
      const entry = byCampaign.get(r.campaign.key) ?? {
        entity: r.campaign,
        metrics: emptyMetrics(),
      }
      addInto(entry.metrics, r.record.metrics)
      byCampaign.set(r.campaign.key, entry)
    }
    campaigns = {
      source,
      rows: [...byCampaign.values()]
        .map(({ entity, metrics }) => ({
          key: entity.key,
          name: entity.name,
          metrics,
          kpis: kpisOf(metrics),
          costShare:
            totals.cost && metrics.cost !== null ? metrics.cost / totals.cost : null,
        }))
        .sort(
          (a, b) =>
            (b.metrics.cost ?? 0) - (a.metrics.cost ?? 0) ||
            a.name.localeCompare(b.name, "pl")
        ),
    }
  }

  const missing = needs(f).filter(
    (d) => !data.reports.some((r) => hasCost(r) && hasDim(r, d))
  )
  const unavailable = source
    ? null
    : missing.length
      ? `Żaden raport z kosztem nie ma kolumny: ${missing.map((d) => DIM_LABEL[d] ?? d).join(", ")}.`
      : "Żaden raport nie zawiera jednocześnie wszystkich wybranych wymiarów (np. urządzenia i lokalizacji). Zawęź filtry."

  return {
    source,
    unavailable,
    sourceNote,
    records: rows.length,
    totals,
    kpis: kpisOf(totals),
    series,
    campaigns,
  }
}

const DIM_LABEL: Partial<Record<keyof NormalizedRecord["dims"], string>> = {
  device: "urządzenie",
  location: "lokalizacja",
  date: "data (dzień)",
}

export const isUnavailable = (x: object): x is Unavailable => "reason" in x
