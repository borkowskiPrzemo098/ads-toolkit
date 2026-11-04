import { stripDiacritics } from "@/lib/keywords/normalize"
import { parseReportDate } from "@/lib/reports/dates"
import type { Field, Mapping } from "./columns"
import type { ReportType } from "./detect"
import { isNoData, parseCellNumber, type ReportAnalysis } from "./import"
import { emptyMetrics, METRICS, type Metric, type Metrics } from "./metrics"
import type { SheetTable } from "./parse"

/*
 * The normalised layer. Raw rows stay untouched in SheetTable; records here hold cleaned
 * dimension values and numbers, plus the source line for every value shown later.
 */

export type Device = "desktop" | "mobile" | "tablet" | "tv" | "other"
export type MatchType = "exact" | "phrase" | "broad"
export type CampaignStatus = "enabled" | "paused" | "removed"

export interface Dimensions {
  customerId?: string
  account?: string
  campaignId?: string
  campaign?: string
  campaignType?: string
  campaignStatus?: CampaignStatus
  adGroupId?: string
  adGroup?: string
  adId?: string
  adType?: string
  adStrength?: string
  headline?: string
  keywordId?: string
  keyword?: string
  matchType?: MatchType
  /** "(close variant)" in the search terms report. */
  closeVariant?: boolean
  searchTerm?: string
  landingPage?: string
  conversionAction?: string
  device?: Device
  location?: string
  /** ISO day "YYYY-MM-DD". */
  date?: string
  week?: string
  month?: string
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek?: number
  /** 0–23. */
  hour?: number
}

export interface NormalizedRecord {
  /** 1-based line in the source file, for "where does this number come from". */
  line: number
  dims: Dimensions
  metrics: Metrics
}

export interface NormalizedReport {
  id: string
  name: string
  type: ReportType
  period: ReportAnalysis["period"]
  records: NormalizedRecord[]
  /** ISO code from a currency column or symbols in the cost cells ("zł", "€"); null = unknown. */
  currency: string | null
  /** Values that could not be normalised (unknown device names etc.), with counts. */
  unrecognised: { field: Field; value: string; count: number }[]
}

/** Most cells have single spaces only; the regex replace runs only when needed. */
const MULTI_SPACE = /\s{2,}|[\t\n\r\u00a0]/
const clean = (v: string | undefined) => {
  const t = (v ?? "").trim()
  return MULTI_SPACE.test(t) ? t.replace(/\s+/g, " ") : t
}
/**
 * Case- and diacritics-insensitive key. Cached: campaign names, match types and devices repeat
 * on every row, and stripping diacritics 200 000 times is the slowest part of normalising.
 */
const keyCache = new Map<string, string>()
const key = (v: string) => {
  let k = keyCache.get(v)
  if (k === undefined) {
    k = stripDiacritics(v.toLocaleLowerCase("pl-PL")).replace(/\s+/g, " ").trim()
    if (keyCache.size > 50_000) keyCache.clear()
    keyCache.set(v, k)
  }
  return k
}

/** "123-456-7890" and "1234567890" are the same customer; IDs keep digits only. */
export const normalizeId = (v: string) => {
  const digits = v.replace(/\D/g, "")
  return digits || undefined
}

const DEVICES: [RegExp, Device][] = [
  [/^(computers?|desktop|komputer)/, "desktop"],
  [/^(mobile|telefon|smartfon|mobile phones?)/, "mobile"],
  [/^(tablet)/, "tablet"],
  [/^(tv|connected tv|ekrany? (tv|telewizor)|telewizor)/, "tv"],
  [/^(other|inne|pozostale)/, "other"],
]

export function normalizeDevice(v: string): Device | null {
  const k = key(v)
  for (const [re, d] of DEVICES) if (re.test(k)) return d
  return null
}

export function normalizeMatchType(
  v: string
): { type: MatchType; closeVariant: boolean } | null {
  const k = key(v)
  const closeVariant = /close variant|wariant/.test(k)
  if (/^(exact|scisle|dopasowanie scisle)/.test(k)) return { type: "exact", closeVariant }
  if (/^(phrase|do wyrazenia|dopasowanie do wyrazenia)/.test(k))
    return { type: "phrase", closeVariant }
  if (/^(broad|przyblizone|dopasowanie przyblizone)/.test(k))
    return { type: "broad", closeVariant }
  return null
}

export function normalizeStatus(v: string): CampaignStatus | null {
  const k = key(v)
  if (/^(enabled|eligible|wlaczon|aktywn|kwalifikuj)/.test(k)) return "enabled"
  if (/^(paused|wstrzyman)/.test(k)) return "paused"
  if (/^(removed|usunie)/.test(k)) return "removed"
  return null
}

const DAYS: Record<string, number> = {
  poniedzialek: 1,
  monday: 1,
  wtorek: 2,
  tuesday: 2,
  sroda: 3,
  wednesday: 3,
  czwartek: 4,
  thursday: 4,
  piatek: 5,
  friday: 5,
  sobota: 6,
  saturday: 6,
  niedziela: 7,
  sunday: 7,
}

export function normalizeDayOfWeek(v: string): number | null {
  return DAYS[key(v)] ?? null
}

/** "0", "13", "13:00", "1 PM", "12 AM" → 0–23. */
export function normalizeHour(v: string): number | null {
  const k = key(v)
  const m = k.match(/^(\d{1,2})(?::00)?\s*(am|pm)?$/)
  if (!m) return null
  let h = Number(m[1])
  if (m[2] === "pm" && h < 12) h += 12
  if (m[2] === "am" && h === 12) h = 0
  return h >= 0 && h <= 23 ? h : null
}

/** URLs compare without protocol, "www." and trailing slash; the original stays in the label. */
export const urlKey = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")

export function normalizeReport(
  id: string,
  name: string,
  table: SheetTable,
  analysis: ReportAnalysis,
  skipDuplicates: boolean
): NormalizedReport {
  if (!analysis.type) throw new Error("Report type required before normalisation")
  const m: Mapping = analysis.mapping
  const skip = skipDuplicates ? new Set(analysis.duplicates) : null
  const unrecognised = new Map<string, { field: Field; value: string; count: number }>()
  const miss = (field: Field, value: string) => {
    const k = `${field}\u0001${value}`
    const entry = unrecognised.get(k) ?? { field, value, count: 0 }
    entry.count++
    unrecognised.set(k, entry)
  }

  const records: NormalizedRecord[] = []
  for (const r of analysis.dataRows) {
    if (skip?.has(r)) continue
    const row = table.rows[r]
    const cell = (f: Field) => (m[f] === undefined ? undefined : clean(row[m[f]!]))
    const dims: Dimensions = {}
    const text = (f: keyof Dimensions & Field) => {
      const v = cell(f)
      if (v) (dims as Record<string, unknown>)[f] = v
    }
    for (const f of [
      "account",
      "campaign",
      "campaignType",
      "adGroup",
      "adType",
      "adStrength",
      "headline",
      "keyword",
      "searchTerm",
      "landingPage",
      "conversionAction",
      "location",
      "week",
      "month",
    ] as const)
      text(f)
    for (const f of [
      "customerId",
      "campaignId",
      "adGroupId",
      "adId",
      "keywordId",
    ] as const) {
      const v = cell(f)
      const id = v ? normalizeId(v) : undefined
      if (id) dims[f] = id
    }
    const device = cell("device")
    if (device) {
      const d = normalizeDevice(device)
      if (d) dims.device = d
      else {
        dims.device = "other"
        miss("device", device)
      }
    }
    const match = cell("matchType")
    if (match) {
      const mt = normalizeMatchType(match)
      if (mt) {
        dims.matchType = mt.type
        if (mt.closeVariant) dims.closeVariant = true
      } else miss("matchType", match)
    }
    const status = cell("campaignStatus")
    if (status) {
      const s = normalizeStatus(status)
      if (s) dims.campaignStatus = s
      else miss("campaignStatus", status)
    }
    const date = cell("date")
    if (date) {
      const d = parseReportDate(
        /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : date
      )
      if (d) dims.date = d
    }
    const day = cell("dayOfWeek")
    if (day) {
      const d = normalizeDayOfWeek(day)
      if (d) dims.dayOfWeek = d
      else miss("dayOfWeek", day)
    }
    const hour = cell("hour")
    if (hour) {
      const h = normalizeHour(hour)
      if (h !== null) dims.hour = h
      else miss("hour", hour)
    }
    const metrics = emptyMetrics()
    for (const metric of METRICS as readonly Metric[]) {
      const c = cell(metric)
      if (c === undefined) continue
      // Empty or "--" means no activity (0). A cell that is not a number was already
      // reported at import and stays out of the sums.
      metrics[metric] = isNoData(c) ? 0 : parseCellNumber(c, table.format)
    }
    records.push({ line: r + 1, dims, metrics })
  }

  return {
    id,
    name,
    type: analysis.type,
    currency: detectCurrency(table, analysis),
    period: analysis.period,
    records,
    unrecognised: [...unrecognised.values()].sort((a, b) => b.count - a.count),
  }
}

/** Names compare case- and diacritics-insensitively ("Buty – Search" = "buty – search"). */
export const nameKey = key

const SYMBOLS: [RegExp, string][] = [
  [/zł|pln/i, "PLN"],
  [/€|eur/i, "EUR"],
  [/\$|usd/i, "USD"],
  [/£|gbp/i, "GBP"],
]

/** Currency of a report: its currency column, else symbols printed in the cost column. */
export function detectCurrency(
  table: SheetTable,
  analysis: ReportAnalysis
): string | null {
  const rows = analysis.dataRows.slice(0, 200).map((r) => table.rows[r])
  const col = analysis.mapping.currency
  if (col !== undefined) {
    const codes = new Set(
      rows.map((row) => clean(row[col]).toUpperCase()).filter(Boolean)
    )
    if (codes.size === 1) return [...codes][0]
  }
  const cost = analysis.mapping.cost
  if (cost === undefined) return null
  for (const [re, code] of SYMBOLS)
    if (rows.some((row) => re.test(row[cost] ?? ""))) return code
  return null
}
