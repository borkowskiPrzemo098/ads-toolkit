import { calcFail, calcOk, type CalcResult } from "@/types/calculation"

/** Planning assumptions after parsing. `null` means the field is empty. */
export interface BudgetInput {
  budget: number | null
  cpc: number | null
  conversionRatePercent: number | null
  avgOrderValue: number | null
  marginPercent: number | null
  days: number | null
}

export const EMPTY_BUDGET_INPUT: BudgetInput = {
  budget: null,
  cpc: null,
  conversionRatePercent: null,
  avgOrderValue: null,
  marginPercent: null,
  days: null,
}

export type ScenarioId = "pessimistic" | "realistic" | "optimistic"

/** Percentage changes applied to the user's base assumptions. All editable in the UI. */
export interface ScenarioAdjustment {
  cpcChangePercent: number
  conversionRateChangePercent: number
  avgOrderValueChangePercent: number
}

export const DEFAULT_SCENARIOS: Record<ScenarioId, ScenarioAdjustment> = {
  pessimistic: {
    cpcChangePercent: 20,
    conversionRateChangePercent: -25,
    avgOrderValueChangePercent: -10,
  },
  realistic: {
    cpcChangePercent: 0,
    conversionRateChangePercent: 0,
    avgOrderValueChangePercent: 0,
  },
  optimistic: {
    cpcChangePercent: -10,
    conversionRateChangePercent: 20,
    avgOrderValueChangePercent: 5,
  },
}

export const NO_ADJUSTMENT = DEFAULT_SCENARIOS.realistic

export interface BudgetForecast {
  /** Effective assumptions after the scenario adjustment. */
  cpc: CalcResult
  conversionRate: CalcResult
  avgOrderValue: CalcResult
  clicks: CalcResult
  conversions: CalcResult
  revenue: CalcResult
  cpa: CalcResult
  roas: CalcResult
  /** Revenue × margin − budget. */
  profit: CalcResult
  dailyBudget: CalcResult
  weeklyBudget: CalcResult
  /** Highest CPC at which the plan still breaks even: CR × AOV × margin. */
  breakEvenCpc: CalcResult
}

const MSG = {
  budget: "Podaj budżet.",
  cpc: "Podaj średni CPC.",
  cr: "Podaj współczynnik konwersji.",
  aov: "Podaj średnią wartość zamówienia.",
  margin: "Podaj marżę, aby policzyć zysk.",
  days: "Podaj liczbę dni kampanii.",
} as const

const has = (v: number | null): v is number => v !== null && Number.isFinite(v)
const adjust = (value: number, changePercent: number) => value * (1 + changePercent / 100)

function adjusted(
  value: number | null,
  changePercent: number,
  missing: string,
  label: string
): CalcResult {
  if (!has(value)) return calcFail(missing)
  const result = adjust(value, changePercent)
  return result < 0
    ? calcFail(`${label} po zmianie scenariusza wychodzi ujemny.`)
    : calcOk(result)
}

export function forecastBudget(
  input: BudgetInput,
  scenario: ScenarioAdjustment = NO_ADJUSTMENT
): BudgetForecast {
  const { budget, days, marginPercent } = input

  const cpc = adjusted(input.cpc, scenario.cpcChangePercent, MSG.cpc, "CPC")
  const conversionRate = adjusted(
    input.conversionRatePercent,
    scenario.conversionRateChangePercent,
    MSG.cr,
    "Współczynnik konwersji"
  )
  const avgOrderValue = adjusted(
    input.avgOrderValue,
    scenario.avgOrderValueChangePercent,
    MSG.aov,
    "Średnia wartość zamówienia"
  )
  if (conversionRate.ok && conversionRate.value > 100) {
    Object.assign(conversionRate, calcFail("Współczynnik konwersji przekracza 100%."))
  }

  let clicks: CalcResult
  if (!has(budget)) clicks = calcFail(MSG.budget)
  else if (!cpc.ok) clicks = cpc
  else if (cpc.value === 0)
    clicks = calcFail("CPC równy 0 nie pozwala policzyć kliknięć.")
  else clicks = calcOk(budget / cpc.value)

  const conversions = !clicks.ok
    ? clicks
    : !conversionRate.ok
      ? conversionRate
      : calcOk(clicks.value * (conversionRate.value / 100))

  const revenue = !conversions.ok
    ? conversions
    : !avgOrderValue.ok
      ? avgOrderValue
      : calcOk(conversions.value * avgOrderValue.value)

  const cpa = !conversions.ok
    ? conversions
    : conversions.value === 0
      ? calcFail("Przy tych założeniach nie będzie konwersji.")
      : calcOk(budget! / conversions.value)

  const roas = !revenue.ok
    ? revenue
    : budget === 0
      ? calcFail("Budżet wynosi 0.")
      : calcOk((revenue.value / budget!) * 100)

  const marginValid = has(marginPercent) && marginPercent >= 0 && marginPercent <= 100
  const profit = !revenue.ok
    ? revenue
    : !marginValid
      ? calcFail(MSG.margin)
      : calcOk(revenue.value * (marginPercent / 100) - budget!)

  let dailyBudget: CalcResult
  if (!has(budget)) dailyBudget = calcFail(MSG.budget)
  else if (!has(days)) dailyBudget = calcFail(MSG.days)
  else if (days <= 0) dailyBudget = calcFail("Kampania musi trwać co najmniej 1 dzień.")
  else dailyBudget = calcOk(budget / days)

  const weeklyBudget = dailyBudget.ok ? calcOk(dailyBudget.value * 7) : dailyBudget

  const breakEvenCpc = !conversionRate.ok
    ? conversionRate
    : !avgOrderValue.ok
      ? avgOrderValue
      : !marginValid
        ? calcFail(MSG.margin)
        : calcOk(
            (conversionRate.value / 100) * avgOrderValue.value * (marginPercent / 100)
          )

  return {
    cpc,
    conversionRate,
    avgOrderValue,
    clicks,
    conversions,
    revenue,
    cpa,
    roas,
    profit,
    dailyBudget,
    weeklyBudget,
    breakEvenCpc,
  }
}

/**
 * Converts "CPC rises by p% when the budget doubles" into the elasticity e in
 * CPC(b) = CPC₀ × (b / b₀)^e. p = 0 means a constant CPC.
 */
export function cpcElasticity(cpcGrowthPerDoublingPercent: number): number {
  return Math.log2(1 + cpcGrowthPerDoublingPercent / 100)
}

export interface SimulationPoint {
  budget: number
  cpc: number
  clicks: number
  conversions: number
  revenue: number
  profit: number
}

/**
 * Forecast at other budget levels. Spending more usually buys pricier clicks, so CPC grows
 * with budget according to the elasticity assumption. Returns null when the base plan is
 * incomplete.
 */
export function simulateBudgets(
  input: BudgetInput,
  scenario: ScenarioAdjustment,
  cpcGrowthPerDoublingPercent: number,
  budgets: number[]
): SimulationPoint[] | null {
  const base = forecastBudget(input, scenario)
  if (!base.cpc.ok || !base.conversionRate.ok || !base.avgOrderValue.ok) return null
  if (!has(input.budget) || input.budget <= 0 || base.cpc.value <= 0) return null
  if (!has(input.marginPercent)) return null

  const e = cpcElasticity(cpcGrowthPerDoublingPercent)
  const b0 = input.budget
  const cpc0 = base.cpc.value
  const margin = input.marginPercent / 100
  const cr = base.conversionRate.value / 100
  const aov = base.avgOrderValue.value

  return budgets.map((budget) => {
    const cpc = cpc0 * Math.pow(budget / b0, e)
    const clicks = budget > 0 ? budget / cpc : 0
    const conversions = clicks * cr
    const revenue = conversions * aov
    return {
      budget,
      cpc,
      clicks,
      conversions,
      revenue,
      profit: revenue * margin - budget,
    }
  })
}

/** Evenly spaced budgets from `fromShare` to `toShare` of the base budget, base included. */
export function budgetRange(
  base: number,
  steps = 25,
  fromShare = 0.2,
  toShare = 3
): number[] {
  const values = Array.from(
    { length: steps },
    (_, i) => base * (fromShare + ((toShare - fromShare) * i) / (steps - 1))
  )
  if (!values.some((v) => Math.abs(v - base) < 1e-9)) values.push(base)
  return values.sort((a, b) => a - b)
}

export type OptimalBudget =
  | { kind: "optimum"; budget: number; profit: number }
  /** Constant CPC and profitable clicks: profit grows with every złoty in this model. */
  | { kind: "unbounded" }
  /** Every click loses money: the best budget is zero. */
  | { kind: "none" }

/**
 * Budget that maximises profit = R × b^(1−e) − b, where R = CR × AOV × margin × b₀^e / CPC₀.
 * Setting the derivative to zero gives b* = ((1 − e) × R)^(1/e).
 */
export function optimalBudget(
  input: BudgetInput,
  scenario: ScenarioAdjustment,
  cpcGrowthPerDoublingPercent: number
): OptimalBudget | null {
  const point = simulateBudgets(input, scenario, cpcGrowthPerDoublingPercent, [
    input.budget ?? 0,
  ])
  if (!point) return null

  const base = forecastBudget(input, scenario)
  const valuePerClick =
    (base.conversionRate.ok ? base.conversionRate.value / 100 : 0) *
    (base.avgOrderValue.ok ? base.avgOrderValue.value : 0) *
    (input.marginPercent! / 100)
  const cpc0 = base.cpc.ok ? base.cpc.value : 0
  const e = cpcElasticity(cpcGrowthPerDoublingPercent)

  if (valuePerClick <= 0 || cpc0 <= 0) return { kind: "none" }
  if (e <= 0) return valuePerClick > cpc0 ? { kind: "unbounded" } : { kind: "none" }

  const b0 = input.budget!
  const r = (valuePerClick * Math.pow(b0, e)) / cpc0
  const budget = Math.pow((1 - e) * r, 1 / e)
  const [best] = simulateBudgets(input, scenario, cpcGrowthPerDoublingPercent, [budget])!
  return best.profit <= 0
    ? { kind: "none" }
    : { kind: "optimum", budget, profit: best.profit }
}
