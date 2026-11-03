import Papa from "papaparse"
import { isTotalsCell } from "@/lib/csv/keyword-import"
import { parseReportNumber } from "@/lib/csv/numbers"
import { stripDiacritics } from "@/lib/keywords/normalize"
import { parseReportDate } from "./dates"

export const METRICS = [
  "impressions",
  "clicks",
  "cost",
  "conversions",
  "conversionValue",
] as const
export type Metric = (typeof METRICS)[number]
export type ReportField = "date" | "campaign" | Metric

export const FIELD_LABEL: Record<ReportField, string> = {
  date: "Data",
  campaign: "Kampania",
  impressions: "Wyświetlenia",
  clicks: "Kliknięcia",
  cost: "Koszt",
  conversions: "Konwersje",
  conversionValue: "Wartość konwersji",
}

/** Header names in Google Ads exports (Polish and English UI), without diacritics, lower case. */
const HEADERS: Record<ReportField, string[]> = {
  date: ["day", "date", "dzien", "data", "week", "tydzien", "month", "miesiac"],
  campaign: ["campaign", "kampania", "campaign name", "nazwa kampanii"],
  impressions: ["impr.", "impressions", "wysw.", "wyswietlenia"],
  clicks: ["clicks", "klikniecia"],
  cost: ["cost", "koszt"],
  conversions: ["conversions", "conv.", "konwersje", "konw."],
  conversionValue: [
    "conv. value",
    "conversion value",
    "conversions value",
    "wartosc konw.",
    "wartosc konwersji",
    "wartosc konw",
  ],
}

const normalizeHeader = (h: string) =>
  stripDiacritics(h.trim().toLocaleLowerCase("pl-PL")).replace(/\s+/g, " ")

export type Mapping = Partial<Record<ReportField, number>>

export interface RawTable {
  rows: string[][]
  headerRow: number
  columns: string[]
  /** Columns matched automatically; the user confirms or changes them. */
  suggested: Mapping
}

/**
 * Parses a report file and finds the header row: the first of the top rows with at least two
 * recognised metric names (report exports start with a title and a date line).
 */
export function readReportTable(text: string): RawTable | null {
  const { data } = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" })
  const rows = data.map((row) => row.map((cell) => String(cell ?? "")))
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const suggested = suggestMapping(rows[r])
    const metricCount = METRICS.filter((m) => suggested[m] !== undefined).length
    if (metricCount >= 2) return { rows, headerRow: r, columns: rows[r], suggested }
  }
  return null
}

export function suggestMapping(header: string[]): Mapping {
  const normalized = header.map(normalizeHeader)
  const mapping: Mapping = {}
  for (const field of Object.keys(HEADERS) as ReportField[]) {
    const index = normalized.findIndex((h) => HEADERS[field].includes(h))
    if (index !== -1) mapping[field] = index
  }
  return mapping
}

export interface ReportRow {
  /** ISO date, when the data is daily (or weekly, monthly). */
  date: string | null
  campaign: string | null
  impressions: number | null
  clicks: number | null
  cost: number | null
  conversions: number | null
  conversionValue: number | null
}

export interface MappedData {
  rows: ReportRow[]
  /** Data rows that could not be read, with the reason; never dropped silently. */
  problems: { line: number; reason: string }[]
  skippedTotals: number
}

/** Converts table rows using the confirmed mapping. Totals rows are skipped and counted. */
export function mapRows(table: RawTable, mapping: Mapping): MappedData {
  const rows: ReportRow[] = []
  const problems: MappedData["problems"] = []
  let skippedTotals = 0

  table.rows.slice(table.headerRow + 1).forEach((cells, i) => {
    const line = table.headerRow + i + 2
    const cell = (field: ReportField) =>
      mapping[field] === undefined ? undefined : (cells[mapping[field]!] ?? "")

    if (cells.some((c, index) => index <= 1 && isTotalsCell(c))) {
      skippedTotals++
      return
    }

    const rawDate = cell("date")
    const date = rawDate === undefined ? null : parseReportDate(rawDate)
    if (rawDate !== undefined && rawDate.trim() && date === null) {
      problems.push({ line, reason: `Nieczytelna data: „${rawDate.trim()}”.` })
      return
    }

    const values = {} as Record<Metric, number | null>
    for (const metric of METRICS) {
      const raw = cell(metric)
      values[metric] = raw === undefined ? null : parseReportNumber(raw)
      if (
        raw !== undefined &&
        raw.trim() &&
        !/^-+$/.test(raw.trim()) &&
        values[metric] === null
      ) {
        problems.push({
          line,
          reason: `Nieczytelna wartość w kolumnie ${FIELD_LABEL[metric]}: „${raw.trim()}”.`,
        })
        return
      }
      if (values[metric] !== null && values[metric]! < 0) {
        problems.push({
          line,
          reason: `Ujemna wartość w kolumnie ${FIELD_LABEL[metric]}.`,
        })
        return
      }
    }
    if (METRICS.every((m) => values[m] === null)) return

    rows.push({ date, campaign: cell("campaign")?.trim() || null, ...values })
  })

  return { rows, problems, skippedTotals }
}

/** What the mapping still lacks for a useful report. */
export function mappingProblems(mapping: Mapping): string[] {
  const problems: string[] = []
  if (mapping.cost === undefined && mapping.clicks === undefined) {
    problems.push("Przypisz co najmniej kolumnę z kosztem albo z kliknięciami.")
  }
  const used = Object.values(mapping)
  if (new Set(used).size !== used.length) {
    problems.push("Ta sama kolumna jest przypisana do dwóch pól.")
  }
  return problems
}
