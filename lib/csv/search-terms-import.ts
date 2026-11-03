import type { SearchTerm } from "@/lib/calculations/negative-keywords"
import { stripDiacritics } from "@/lib/keywords/normalize"
import { dataRows, type ParsedTable } from "./keyword-import"
import { parseReportNumber } from "./numbers"

type Metric = "clicks" | "impressions" | "cost" | "conversions"

/** Metric headers in Google Ads exports, Polish and English, without diacritics. */
const METRIC_HEADERS: Record<Metric, string[]> = {
  clicks: ["clicks", "klikniecia"],
  impressions: ["impr.", "impressions", "wysw.", "wyswietlenia"],
  cost: ["cost", "koszt"],
  conversions: ["conversions", "conv.", "konwersje", "konw."],
}

export const METRIC_LABEL: Record<Metric, string> = {
  clicks: "Kliknięcia",
  impressions: "Wyświetlenia",
  cost: "Koszt",
  conversions: "Konwersje",
}

export type MetricColumns = Partial<Record<Metric, number>>

/** Finds metric columns in the header row. Works only when the file has a header. */
export function detectMetricColumns(table: ParsedTable): MetricColumns {
  if (table.headerRow === null) return {}
  const headers = table.rows[table.headerRow].map((h) =>
    stripDiacritics(h.trim().toLocaleLowerCase("pl-PL"))
  )
  const columns: MetricColumns = {}
  for (const metric of Object.keys(METRIC_HEADERS) as Metric[]) {
    const index = headers.findIndex((h) => METRIC_HEADERS[metric].includes(h))
    if (index !== -1) columns[metric] = index
  }
  return columns
}

/** Search terms with their metrics, one per data row, totals rows skipped. */
export function searchTermsFromTable(
  table: ParsedTable,
  termColumn: number,
  metrics: MetricColumns
): SearchTerm[] {
  const metric = (row: string[], key: Metric) =>
    metrics[key] === undefined ? null : parseReportNumber(row[metrics[key]!])

  return dataRows(table, termColumn).map((row) => ({
    term: row[termColumn] ?? "",
    clicks: metric(row, "clicks"),
    impressions: metric(row, "impressions"),
    cost: metric(row, "cost"),
    conversions: metric(row, "conversions"),
  }))
}
