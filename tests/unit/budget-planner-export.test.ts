import { describe, expect, it } from "vitest"
import {
  DEFAULT_SCENARIOS,
  forecastBudget,
  optimalBudget,
  type BudgetInput,
  type ScenarioId,
} from "@/lib/calculations/budget-planner"
import {
  budgetCsvRows,
  budgetReport,
  type BudgetExport,
} from "@/lib/export/budget-planner"
import { budgetPlannerNotes } from "@/lib/export/budget-planner-text"

const PLAN: BudgetInput = {
  budget: 3000,
  cpc: 1.5,
  conversionRatePercent: 2,
  avgOrderValue: 250,
  marginPercent: 40,
  days: 30,
}

const forecastsFor = (input: BudgetInput) =>
  Object.fromEntries(
    (Object.keys(DEFAULT_SCENARIOS) as ScenarioId[]).map((id) => [
      id,
      forecastBudget(input, DEFAULT_SCENARIOS[id]),
    ])
  ) as BudgetExport["forecasts"]

const exportFor = (input: BudgetInput, variants: BudgetExport["variants"] = []) => ({
  input,
  scenarios: DEFAULT_SCENARIOS,
  forecasts: forecastsFor(input),
  variants,
  notes: [],
  currency: "PLN" as const,
})

describe("budget planner notes", () => {
  it("compares CPC with break-even CPC and flags pessimistic losses", () => {
    const notes = budgetPlannerNotes(
      forecastsFor(PLAN),
      optimalBudget(PLAN, DEFAULT_SCENARIOS.realistic, 10),
      10,
      "PLN"
    )
    expect(notes[0]).toContain("poniżej opłacalnego maksimum")
    expect(notes.some((n) => n.includes("scenariuszu ostrożnym plan traci"))).toBe(true)
    expect(notes.some((n) => n.includes("najwyższy zysk"))).toBe(true)
  })

  it("warns when CPC is above break-even", () => {
    const input = { ...PLAN, cpc: 2.5 }
    const notes = budgetPlannerNotes(forecastsFor(input), null, 10, "PLN")
    expect(notes[0]).toContain("każde kliknięcie przynosi stratę")
  })

  it("explains the constant-CPC case without inventing an optimum", () => {
    const notes = budgetPlannerNotes(forecastsFor(PLAN), { kind: "unbounded" }, 0, "PLN")
    expect(notes.at(-1)).toContain("nie wskazuje optimum")
  })
})

describe("budget planner export", () => {
  it("writes assumptions, adjustments and all three scenarios to CSV", () => {
    const rows = budgetCsvRows(exportFor(PLAN))
    expect(rows).toContainEqual(["Budżet kampanii", 3000, "PLN"])
    expect(rows).toContainEqual(["Zmiana CPC (%)", 20, 0, -10])
    const clicks = rows.find((r) => r[0] === "Kliknięcia")!
    expect(clicks[2]).toBeCloseTo(2000, 8)
  })

  it("adds saved variants when present", () => {
    const variant = {
      id: "1",
      name: "Wariant 5000 zł",
      input: { ...PLAN, budget: 5000 },
      forecast: forecastBudget({ ...PLAN, budget: 5000 }),
    }
    const rows = budgetCsvRows(exportFor(PLAN, [variant]))
    const row = rows.find((r) => r[0] === "Wariant 5000 zł")!
    expect(row[7]).toBeCloseTo(10000 * (5 / 3) * 0.4 - 5000, 6)
    expect(budgetReport(exportFor(PLAN, [variant])).tables).toHaveLength(4)
  })

  it("labels the PDF as a forecast and marks missing data", () => {
    const report = budgetReport(exportFor({ ...PLAN, marginPercent: null }))
    expect(report.subtitle).toContain("Prognoza, nie gwarancja")
    const scenarioTable = report.tables[1]
    expect(scenarioTable.rows.find((r) => r[0] === "Zysk po reklamie")).toEqual([
      "Zysk po reklamie",
      "Brak danych",
      "Brak danych",
      "Brak danych",
    ])
  })
})
