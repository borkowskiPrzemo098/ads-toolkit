import { describe, expect, it } from "vitest"
import { DEFAULT_SCENARIOS } from "@/lib/calculations/budget-planner"
import {
  EMPTY_BUDGET_FORM,
  scenarioToForm,
  validateBudgetForm,
  validateScenarioForm,
} from "@/lib/validators/budget-planner"
import { parseNumericForm } from "@/lib/validators/numeric-form"

describe("parseNumericForm", () => {
  it("applies min, greaterThan, integer and max rules in order", () => {
    const { values, errors } = parseNumericForm(
      { a: "-1", b: "0", c: "2,5", d: "150", e: "", f: "7" },
      {
        b: { greaterThan: 0 },
        c: { integer: true },
        d: { max: 100, maxMessage: "za dużo" },
        f: { integer: true, max: 10 },
      }
    )
    expect(errors).toEqual({
      a: "Wartość nie może być ujemna.",
      b: "Wartość musi być większa niż 0.",
      c: "Wpisz liczbę całkowitą.",
      d: "za dużo",
    })
    expect(values).toEqual({ a: null, b: null, c: null, d: null, e: null, f: 7 })
  })

  it("accepts negatives when min allows it", () => {
    const { values } = parseNumericForm({ x: "−25" }, { x: { min: -100 } })
    expect(values.x).toBe(-25)
  })
})

describe("validateBudgetForm", () => {
  it("starts with a 30-day period and nothing else", () => {
    const { input, errors } = validateBudgetForm(EMPTY_BUDGET_FORM)
    expect(errors).toEqual({})
    expect(input).toEqual({
      budget: null,
      cpc: null,
      conversionRatePercent: null,
      avgOrderValue: null,
      marginPercent: null,
      days: 30,
    })
  })

  it("rejects zero CPC, fractional days and rates above 100%", () => {
    const { errors } = validateBudgetForm({
      ...EMPTY_BUDGET_FORM,
      cpc: "0",
      days: "7,5",
      conversionRatePercent: "120",
      marginPercent: "101",
    })
    expect(Object.keys(errors).sort()).toEqual(
      ["conversionRatePercent", "cpc", "days", "marginPercent"].sort()
    )
  })
})

describe("validateScenarioForm", () => {
  it("round-trips default scenarios", () => {
    for (const scenario of Object.values(DEFAULT_SCENARIOS)) {
      expect(validateScenarioForm(scenarioToForm(scenario)).adjustment).toEqual(scenario)
    }
  })

  it("treats invalid fields as 0% and reports them", () => {
    const { adjustment, errors } = validateScenarioForm({
      cpcChangePercent: "-150",
      conversionRateChangePercent: "abc",
      avgOrderValueChangePercent: "",
    })
    expect(adjustment).toEqual({
      cpcChangePercent: 0,
      conversionRateChangePercent: 0,
      avgOrderValueChangePercent: 0,
    })
    expect(Object.keys(errors).sort()).toEqual([
      "conversionRateChangePercent",
      "cpcChangePercent",
    ])
  })
})
