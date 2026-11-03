import { PROFITABILITY_GROUPS, type MetricDef } from "@/constants/profitability"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { formatDelta, formatMetric } from "@/lib/formatting/metric"
import type { Currency } from "@/lib/formatting/number"
import type { TableReport } from "@/lib/pdf/table-report"
import type { CsvCell } from "./csv"
import { profitabilityNotes, profitabilityVerdict } from "./profitability-text"

export interface CampaignExport {
  name: string
  result: ProfitabilityResult
}

const unitOf = (metric: MetricDef, currency: Currency) =>
  metric.kind === "currency" ? currency : "%"

const reasonOf = (r: ProfitabilityResult[MetricDef["key"]]) => (r.ok ? "" : r.reason)

/** One row per metric. With two campaigns: values side by side plus B − A. */
export function profitabilityCsvRows(
  campaigns: CampaignExport[],
  currency: Currency
): CsvCell[][] {
  const [a, b] = campaigns
  const header: CsvCell[] = b
    ? ["Wskaźnik", "Jednostka", a.name, b.name, "Różnica (B − A)", "Wzór"]
    : ["Wskaźnik", "Jednostka", "Wartość", "Uwagi", "Wzór"]

  const rows: CsvCell[][] = [header]
  for (const group of PROFITABILITY_GROUPS) {
    for (const metric of group.metrics) {
      const ra = a.result[metric.key]
      const unit = unitOf(metric, currency)
      if (!b) {
        rows.push([
          metric.label,
          unit,
          ra.ok ? ra.value : null,
          reasonOf(ra),
          metric.help,
        ])
        continue
      }
      const rb = b.result[metric.key]
      rows.push([
        metric.label,
        unit,
        ra.ok ? ra.value : null,
        rb.ok ? rb.value : null,
        ra.ok && rb.ok ? rb.value - ra.value : null,
        metric.help,
      ])
    }
  }
  return rows
}

export function profitabilityReport(
  campaigns: CampaignExport[],
  currency: Currency
): TableReport {
  const [a, b] = campaigns
  const missing = "Brak danych"
  const cell = (r: ProfitabilityResult[MetricDef["key"]], metric: MetricDef) =>
    formatMetric(r, metric.kind, currency) ?? missing

  const tables = PROFITABILITY_GROUPS.map((group) => ({
    heading: group.title,
    columns: b ? ["Wskaźnik", a.name, b.name, "Różnica"] : ["Wskaźnik", "Wartość"],
    rows: group.metrics.map((metric) => {
      const ra = a.result[metric.key]
      if (!b) return [metric.label, cell(ra, metric)]
      const rb = b.result[metric.key]
      return [
        metric.label,
        cell(ra, metric),
        cell(rb, metric),
        ra.ok && rb.ok ? formatDelta(ra.value, rb.value, metric.kind, currency) : "—",
      ]
    }),
  }))

  const verdict = profitabilityVerdict(a.result, currency)
  const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date())

  return {
    title: b ? "Porównanie rentowności kampanii" : "Rentowność kampanii",
    subtitle: `${b ? `${a.name} i ${b.name}` : a.name} · waluta ${currency} · ${date}`,
    summary: !b && verdict ? verdict : undefined,
    tables,
    notes: [
      ...profitabilityNotes(a.result, currency).map((n) => (b ? `${a.name}: ${n}` : n)),
      ...(b ? profitabilityNotes(b.result, currency).map((n) => `${b.name}: ${n}`) : []),
      "ROAS pokazuje przychód na złotówkę reklamy, ROI zysk względem wszystkich kosztów. Przychód nie jest zyskiem.",
      "Niepodane koszty dodatkowe przyjmujemy jako 0. Wyniki zależą od jakości danych wejściowych.",
    ],
  }
}
