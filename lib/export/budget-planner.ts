import { FORECAST_METRICS, SCENARIOS } from "@/constants/budget-planner"
import type {
  BudgetForecast,
  BudgetInput,
  ScenarioAdjustment,
  ScenarioId,
} from "@/lib/calculations/budget-planner"
import { formatMetric } from "@/lib/formatting/metric"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Currency,
} from "@/lib/formatting/number"
import type { TableReport } from "@/lib/pdf/table-report"
import type { CsvCell } from "./csv"

export interface SavedVariant {
  id: string
  name: string
  input: BudgetInput
  /** Realistic-scenario forecast at the time of saving. */
  forecast: BudgetForecast
}

export interface BudgetExport {
  input: BudgetInput
  scenarios: Record<ScenarioId, ScenarioAdjustment>
  forecasts: Record<ScenarioId, BudgetForecast>
  variants: SavedVariant[]
  notes: string[]
  currency: Currency
}

const value = (r: { ok: boolean; value?: number }) => (r.ok ? (r.value as number) : null)

const ASSUMPTIONS: {
  key: keyof BudgetInput
  label: string
  unit: "currency" | "%" | "dni"
}[] = [
  { key: "budget", label: "Budżet kampanii", unit: "currency" },
  { key: "days", label: "Liczba dni", unit: "dni" },
  { key: "cpc", label: "Średni CPC", unit: "currency" },
  { key: "conversionRatePercent", label: "Współczynnik konwersji", unit: "%" },
  { key: "avgOrderValue", label: "Średnia wartość zamówienia", unit: "currency" },
  { key: "marginPercent", label: "Marża", unit: "%" },
]

const ADJUSTMENTS: { key: keyof ScenarioAdjustment; label: string }[] = [
  { key: "cpcChangePercent", label: "Zmiana CPC (%)" },
  { key: "conversionRateChangePercent", label: "Zmiana konwersji (%)" },
  { key: "avgOrderValueChangePercent", label: "Zmiana wartości zamówienia (%)" },
]

export function budgetCsvRows(data: BudgetExport): CsvCell[][] {
  const { input, scenarios, forecasts, variants, currency } = data
  const unit = (u: string) => (u === "currency" ? currency : u)
  const rows: CsvCell[][] = [["Założenia"], ["Parametr", "Wartość", "Jednostka"]]

  for (const a of ASSUMPTIONS) rows.push([a.label, input[a.key], unit(a.unit)])

  rows.push([], ["Scenariusze"], ["Wskaźnik", ...SCENARIOS.map((s) => s.label)])
  for (const a of ADJUSTMENTS)
    rows.push([a.label, ...SCENARIOS.map((s) => scenarios[s.id][a.key])])
  for (const m of FORECAST_METRICS) {
    rows.push([m.label, ...SCENARIOS.map((s) => value(forecasts[s.id][m.key]))])
  }
  rows.push(
    ["Budżet dzienny", ...SCENARIOS.map((s) => value(forecasts[s.id].dailyBudget))],
    ["Budżet tygodniowy", ...SCENARIOS.map((s) => value(forecasts[s.id].weeklyBudget))]
  )

  if (variants.length) {
    rows.push(
      [],
      ["Zapisane warianty (scenariusz realistyczny)"],
      [
        "Wariant",
        "Budżet",
        "CPC",
        "Konwersja (%)",
        "Kliknięcia",
        "Konwersje",
        "Przychód",
        "Zysk",
        "ROAS (%)",
      ]
    )
    for (const v of variants) {
      rows.push([
        v.name,
        v.input.budget,
        v.input.cpc,
        v.input.conversionRatePercent,
        value(v.forecast.clicks),
        value(v.forecast.conversions),
        value(v.forecast.revenue),
        value(v.forecast.profit),
        value(v.forecast.roas),
      ])
    }
  }
  return rows
}

export function budgetReport(data: BudgetExport): TableReport {
  const { input, scenarios, forecasts, variants, notes, currency } = data
  const missing = "Brak danych"
  const money = (v: number) => formatCurrency(v, currency)
  const signed = (v: number) => `${v > 0 ? "+" : ""}${formatPercent(v, 0)}`

  const assumptionValue = (key: keyof BudgetInput, unit: string) => {
    const v = input[key]
    if (v === null) return missing
    if (unit === "currency") return money(v)
    if (unit === "%") return formatPercent(v, 1)
    return formatNumber(v)
  }

  const tables: TableReport["tables"] = [
    {
      heading: "Założenia",
      columns: ["Parametr", "Wartość"],
      rows: ASSUMPTIONS.map((a) => [a.label, assumptionValue(a.key, a.unit)]),
    },
    {
      heading: "Prognoza w trzech scenariuszach",
      columns: ["Wskaźnik", ...SCENARIOS.map((s) => s.label)],
      rows: [
        ...ADJUSTMENTS.map((a) => [
          a.label.replace(" (%)", ""),
          ...SCENARIOS.map((s) => signed(scenarios[s.id][a.key])),
        ]),
        ...FORECAST_METRICS.map((m) => [
          m.label,
          ...SCENARIOS.map(
            (s) => formatMetric(forecasts[s.id][m.key], m.kind, currency) ?? missing
          ),
        ]),
      ],
    },
    {
      heading: "Rozkład budżetu",
      columns: ["Okres", "Kwota"],
      rows: [
        [
          "Budżet dzienny",
          formatMetric(forecasts.realistic.dailyBudget, "currency", currency) ?? missing,
        ],
        [
          "Budżet tygodniowy",
          formatMetric(forecasts.realistic.weeklyBudget, "currency", currency) ?? missing,
        ],
      ],
    },
  ]

  if (variants.length) {
    tables.push({
      heading: "Zapisane warianty (scenariusz realistyczny)",
      columns: ["Wariant", "Budżet", "Zysk", "ROAS"],
      rows: variants.map((v) => [
        v.name,
        v.input.budget === null ? missing : money(v.input.budget),
        formatMetric(v.forecast.profit, "currency", currency) ?? missing,
        formatMetric(v.forecast.roas, "percent", currency) ?? missing,
      ]),
    })
  }

  const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date())
  return {
    title: "Plan budżetu Google Ads",
    subtitle: `Prognoza, nie gwarancja wyniku · waluta ${currency} · ${date}`,
    tables,
    notes,
  }
}
