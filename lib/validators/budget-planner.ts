import type { BudgetInput, ScenarioAdjustment } from "@/lib/calculations/budget-planner"
import { parseNumericForm, type NumericRule } from "./numeric-form"

export type BudgetField = keyof BudgetInput
export type BudgetForm = Record<BudgetField, string>

export const EMPTY_BUDGET_FORM: BudgetForm = {
  budget: "",
  cpc: "",
  conversionRatePercent: "",
  avgOrderValue: "",
  marginPercent: "",
  // A default period, not data: daily and weekly budgets need it.
  days: "30",
}

const RULES: Partial<Record<BudgetField, NumericRule>> = {
  cpc: { greaterThan: 0 },
  conversionRatePercent: {
    max: 100,
    maxMessage: "Współczynnik konwersji nie może przekraczać 100%.",
  },
  marginPercent: { max: 100, maxMessage: "Marża nie może przekraczać 100%." },
  days: { integer: true, greaterThan: 0, max: 366, maxMessage: "Maksymalnie 366 dni." },
}

export function validateBudgetForm(form: BudgetForm) {
  const { values, errors } = parseNumericForm(form, RULES)
  return { input: values as BudgetInput, errors }
}

export type ScenarioField = keyof ScenarioAdjustment
export type ScenarioForm = Record<ScenarioField, string>

const SCENARIO_RULE: NumericRule = {
  min: -100,
  max: 500,
  maxMessage: "Maksymalnie +500%.",
}

export function scenarioToForm(s: ScenarioAdjustment): ScenarioForm {
  return {
    cpcChangePercent: String(s.cpcChangePercent),
    conversionRateChangePercent: String(s.conversionRateChangePercent),
    avgOrderValueChangePercent: String(s.avgOrderValueChangePercent),
  }
}

/** Empty or invalid scenario fields count as 0% change; the error is still reported. */
export function validateScenarioForm(form: ScenarioForm) {
  const { values, errors } = parseNumericForm(form, {
    cpcChangePercent: SCENARIO_RULE,
    conversionRateChangePercent: SCENARIO_RULE,
    avgOrderValueChangePercent: SCENARIO_RULE,
  })
  const adjustment: ScenarioAdjustment = {
    cpcChangePercent: values.cpcChangePercent ?? 0,
    conversionRateChangePercent: values.conversionRateChangePercent ?? 0,
    avgOrderValueChangePercent: values.avgOrderValueChangePercent ?? 0,
  }
  return { adjustment, errors }
}
