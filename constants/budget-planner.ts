import type { BudgetForecast, ScenarioId } from "@/lib/calculations/budget-planner"
import type { BudgetField, ScenarioField } from "@/lib/validators/budget-planner"
import type { MetricKind } from "@/lib/formatting/metric"
import type { FieldDef } from "./profitability"

export const BUDGET_FIELDS: (Omit<FieldDef, "key"> & { key: BudgetField })[] = [
  {
    key: "budget",
    label: "Budżet kampanii",
    unit: "currency",
    placeholder: "np. 3000",
    hint: "Na cały okres podany niżej, np. miesiąc.",
  },
  { key: "days", label: "Liczba dni", unit: null, placeholder: "30" },
  { key: "cpc", label: "Średni CPC", unit: "currency", placeholder: "np. 1,50" },
  {
    key: "conversionRatePercent",
    label: "Współczynnik konwersji",
    unit: "%",
    placeholder: "np. 2",
  },
  {
    key: "avgOrderValue",
    label: "Średnia wartość zamówienia",
    unit: "currency",
    placeholder: "np. 250",
  },
  {
    key: "marginPercent",
    label: "Marża",
    unit: "%",
    placeholder: "np. 40",
    hint: "Bez marży policzymy ruch i przychód, ale nie zysk.",
  },
]

export interface ScenarioMeta {
  id: ScenarioId
  label: string
  /** Validated as a set against the card surface (dataviz validator, dark mode, all pairs). */
  color: string
  /** Secondary encoding so scenarios never rely on colour alone. */
  dash?: string
}

export const SCENARIOS: ScenarioMeta[] = [
  { id: "pessimistic", label: "Ostrożny", color: "#d55181", dash: "6 4" },
  { id: "realistic", label: "Realistyczny", color: "#7c6cff" },
  { id: "optimistic", label: "Optymistyczny", color: "#c98500", dash: "2 4" },
]

export const SCENARIO_FIELDS: { key: ScenarioField; label: string }[] = [
  { key: "cpcChangePercent", label: "Zmiana CPC" },
  { key: "conversionRateChangePercent", label: "Zmiana konwersji" },
  { key: "avgOrderValueChangePercent", label: "Zmiana wartości zamówienia" },
]

type ForecastKey = keyof BudgetForecast

export interface ForecastMetric {
  key: ForecastKey
  label: string
  kind: MetricKind
}

/** Rows of the scenario table and of exports, in reading order. */
export const FORECAST_METRICS: ForecastMetric[] = [
  { key: "clicks", label: "Kliknięcia", kind: "count" },
  { key: "conversions", label: "Konwersje", kind: "decimal" },
  { key: "revenue", label: "Przychód", kind: "currency" },
  { key: "profit", label: "Zysk po reklamie", kind: "currency" },
  { key: "roas", label: "ROAS", kind: "percent" },
  { key: "cpa", label: "CPA", kind: "currency" },
  { key: "cpc", label: "CPC", kind: "currency" },
  { key: "conversionRate", label: "Współczynnik konwersji", kind: "percent" },
]
