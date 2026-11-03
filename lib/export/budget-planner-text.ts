import type {
  BudgetForecast,
  OptimalBudget,
  ScenarioId,
} from "@/lib/calculations/budget-planner"
import { formatCurrency, formatPercent, type Currency } from "@/lib/formatting/number"

export const FORECAST_DISCLAIMER =
  "To prognoza oparta na Twoich założeniach, nie gwarancja wyniku. Rzeczywiste wyniki zależą od aukcji, konkurencji, sezonowości i strony docelowej."

/** Google Ads may spend up to 2× the daily budget on a day, capped at 30.4× per month. */
export const DAILY_BUDGET_NOTE =
  "Google Ads ustawiasz jako budżet dzienny. W pojedynczym dniu system może wydać do dwóch budżetów dziennych, ale w miesiącu nie więcej niż budżet dzienny × 30,4."

export function budgetPlannerNotes(
  forecasts: Record<ScenarioId, BudgetForecast>,
  optimum: OptimalBudget | null,
  cpcGrowthPerDoubling: number,
  currency: Currency
): string[] {
  const notes: string[] = []
  const money = (v: number) => formatCurrency(v, currency)
  const base = forecasts.realistic

  if (base.cpc.ok && base.breakEvenCpc.ok) {
    const { value: cpc } = base.cpc
    const { value: limit } = base.breakEvenCpc
    notes.push(
      cpc > limit
        ? `Średni CPC ${money(cpc)} jest wyższy niż opłacalny maksymalny CPC ${money(limit)}. Przy tych założeniach każde kliknięcie przynosi stratę.`
        : `Średni CPC ${money(cpc)} jest poniżej opłacalnego maksimum ${money(limit)} (zapas ${formatPercent(((limit - cpc) / limit) * 100, 0)}).`
    )
  }

  const pessimistic = forecasts.pessimistic.profit
  if (
    base.profit.ok &&
    pessimistic.ok &&
    base.profit.value > 0 &&
    pessimistic.value < 0
  ) {
    notes.push(
      `W scenariuszu ostrożnym plan traci ${money(-pessimistic.value)}. Jeśli to ryzyko jest za duże, zacznij od mniejszego budżetu i zwiększaj go po pierwszych danych.`
    )
  }

  if (optimum?.kind === "optimum") {
    notes.push(
      // Rounded: the optimum is a model estimate, not a precise figure.
      `Przy założeniu, że CPC rośnie o ${formatPercent(cpcGrowthPerDoubling, 0)} po podwojeniu budżetu, najwyższy zysk (około ${formatCurrency(Math.round(optimum.profit / 10) * 10, currency, 0)}) daje budżet około ${formatCurrency(Math.round(optimum.budget / 100) * 100, currency, 0)}.`
    )
  } else if (optimum?.kind === "unbounded") {
    notes.push(
      "Przy stałym CPC każde dodatkowe kliknięcie jest opłacalne, więc model nie wskazuje optimum. W praktyce CPC rośnie wraz z budżetem; ustaw to założenie przy wykresie."
    )
  } else if (optimum?.kind === "none") {
    notes.push("Przy tych założeniach żaden budżet nie przynosi zysku.")
  }

  return notes
}
