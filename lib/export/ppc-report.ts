import type { Breakdown } from "@/lib/reports/aggregate"
import { kpiLines, type ReportModel } from "@/lib/reports/model"
import type { CsvCell } from "./csv"

const breakdownRows = (
  title: string,
  keyLabel: string,
  list: Breakdown<string>[]
): CsvCell[][] => [
  [],
  [title],
  [
    keyLabel,
    "Wyświetlenia",
    "Kliknięcia",
    "Koszt",
    "Konwersje",
    "Wartość konwersji",
    "CPA",
    "ROAS (%)",
  ],
  ...list.map((b) => [
    b.key,
    b.totals.impressions,
    b.totals.clicks,
    b.totals.cost,
    b.totals.conversions,
    b.totals.conversionValue,
    b.kpis.cpa.ok ? b.kpis.cpa.value : null,
    b.kpis.roas.ok ? b.kpis.roas.value : null,
  ]),
]

/** Everything in the report as data: settings, KPIs, breakdowns and the edited texts. */
export function ppcCsvRows(model: ReportModel): CsvCell[][] {
  const { settings, current, texts } = model
  const rows: CsvCell[][] = [
    ["Klient", settings.clientName],
    ["Kampania", settings.campaignName],
    ["Okres", settings.periodLabel],
    ["Okres porównawczy", model.previous ? settings.comparisonLabel : ""],
    ["Waluta", settings.currency],
    [],
    ["Wskaźnik", "Bieżący okres", "Poprzedni okres", "Zmiana (%)"],
    ...kpiLines(model).map((l) => [l.label, l.value, l.previous, l.change]),
  ]
  if (current.daily) rows.push(...breakdownRows("Dane dzienne", "Data", current.daily))
  if (current.campaigns)
    rows.push(...breakdownRows("Kampanie", "Kampania", current.campaigns))
  rows.push(
    [],
    ["Podsumowanie", texts.summary],
    ...texts.observations.map((t) => ["Obserwacja", t]),
    ...texts.conclusions.map((t) => ["Wniosek", t]),
    ...texts.recommendations.map((t) => ["Rekomendacja", t])
  )
  return rows
}
