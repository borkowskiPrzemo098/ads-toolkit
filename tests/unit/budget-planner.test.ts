import { describe, expect, it } from "vitest"
import {
  budgetRange,
  cpcElasticity,
  DEFAULT_SCENARIOS,
  EMPTY_BUDGET_INPUT,
  forecastBudget,
  optimalBudget,
  simulateBudgets,
  type BudgetInput,
} from "@/lib/calculations/budget-planner"
import type { CalcResult } from "@/types/calculation"

const v = (r: CalcResult) => {
  if (!r.ok) throw new Error(`expected a value, got: ${r.reason}`)
  return r.value
}

/*
 * Reference plan, checked by hand:
 *   budget 3000, CPC 1.50, CR 2%, AOV 250, margin 40%, 30 days
 *   clicks 2000, conversions 40, revenue 10 000, CPA 75, ROAS 333.33%
 *   profit = 10 000 × 0.4 − 3000 = 1000; daily 100, weekly 700
 *   break-even CPC = 0.02 × 250 × 0.4 = 2.00
 */
const PLAN: BudgetInput = {
  budget: 3000,
  cpc: 1.5,
  conversionRatePercent: 2,
  avgOrderValue: 250,
  marginPercent: 40,
  days: 30,
}

describe("forecastBudget: reference plan", () => {
  const f = forecastBudget(PLAN)

  it("forecasts traffic and sales", () => {
    expect(v(f.clicks)).toBeCloseTo(2000, 10)
    expect(v(f.conversions)).toBeCloseTo(40, 10)
    expect(v(f.revenue)).toBeCloseTo(10000, 10)
  })

  it("forecasts cost and return", () => {
    expect(v(f.cpa)).toBeCloseTo(75, 10)
    expect(v(f.roas)).toBeCloseTo(1000 / 3, 10)
    expect(v(f.profit)).toBeCloseTo(1000, 10)
    expect(v(f.breakEvenCpc)).toBeCloseTo(2, 10)
  })

  it("splits the budget into days and weeks", () => {
    expect(v(f.dailyBudget)).toBeCloseTo(100, 10)
    expect(v(f.weeklyBudget)).toBeCloseTo(700, 10)
  })
})

describe("forecastBudget: scenarios", () => {
  it("applies the pessimistic adjustments", () => {
    // CPC 1.80, CR 1.5%, AOV 225 → clicks 1666.67, conv 25, revenue 5625, profit −750
    const f = forecastBudget(PLAN, DEFAULT_SCENARIOS.pessimistic)
    expect(v(f.cpc)).toBeCloseTo(1.8, 10)
    expect(v(f.conversionRate)).toBeCloseTo(1.5, 10)
    expect(v(f.clicks)).toBeCloseTo(3000 / 1.8, 8)
    expect(v(f.conversions)).toBeCloseTo(25, 8)
    expect(v(f.revenue)).toBeCloseTo(5625, 8)
    expect(v(f.profit)).toBeCloseTo(-750, 8)
  })

  it("leaves the realistic scenario equal to the base plan", () => {
    expect(forecastBudget(PLAN, DEFAULT_SCENARIOS.realistic)).toEqual(
      forecastBudget(PLAN)
    )
  })

  it("rejects adjustments that make a value negative or CR above 100%", () => {
    const negative = forecastBudget(PLAN, {
      cpcChangePercent: -120,
      conversionRateChangePercent: 0,
      avgOrderValueChangePercent: 0,
    })
    expect(negative.cpc.ok).toBe(false)
    expect(negative.clicks.ok).toBe(false)

    const tooHigh = forecastBudget(
      { ...PLAN, conversionRatePercent: 90 },
      {
        cpcChangePercent: 0,
        conversionRateChangePercent: 20,
        avgOrderValueChangePercent: 0,
      }
    )
    expect(tooHigh.conversionRate.ok).toBe(false)
  })
})

describe("forecastBudget: missing and edge values", () => {
  it("explains every metric for an empty form", () => {
    const f = forecastBudget(EMPTY_BUDGET_INPUT)
    for (const [key, metric] of Object.entries(f)) {
      expect(metric.ok, key).toBe(false)
    }
  })

  it("forecasts traffic without margin but not profit", () => {
    const f = forecastBudget({ ...PLAN, marginPercent: null })
    expect(f.revenue.ok).toBe(true)
    expect(f.profit.ok).toBe(false)
    expect(f.breakEvenCpc.ok).toBe(false)
  })

  it("handles zero CPC, zero conversion rate and zero budget", () => {
    expect(forecastBudget({ ...PLAN, cpc: 0 }).clicks.ok).toBe(false)
    const noConversions = forecastBudget({ ...PLAN, conversionRatePercent: 0 })
    expect(v(noConversions.conversions)).toBe(0)
    expect(noConversions.cpa.ok).toBe(false)
    const zeroBudget = forecastBudget({ ...PLAN, budget: 0 })
    expect(v(zeroBudget.clicks)).toBe(0)
    expect(zeroBudget.roas.ok).toBe(false)
  })

  it("needs days only for daily and weekly budgets", () => {
    const f = forecastBudget({ ...PLAN, days: null })
    expect(f.dailyBudget.ok).toBe(false)
    expect(f.profit.ok).toBe(true)
  })
})

describe("budget simulation", () => {
  it("converts CPC growth per doubling to elasticity", () => {
    expect(cpcElasticity(0)).toBe(0)
    expect(cpcElasticity(100)).toBeCloseTo(1, 10)
    expect(Math.pow(2, cpcElasticity(10))).toBeCloseTo(1.1, 10)
  })

  it("matches the base forecast at the base budget", () => {
    const [point] = simulateBudgets(PLAN, DEFAULT_SCENARIOS.realistic, 10, [3000])!
    expect(point.clicks).toBeCloseTo(2000, 8)
    expect(point.profit).toBeCloseTo(1000, 8)
  })

  it("raises CPC by the given share when the budget doubles", () => {
    const [point] = simulateBudgets(PLAN, DEFAULT_SCENARIOS.realistic, 10, [6000])!
    expect(point.cpc).toBeCloseTo(1.65, 10)
  })

  it("is linear with a constant CPC", () => {
    const points = simulateBudgets(
      PLAN,
      DEFAULT_SCENARIOS.realistic,
      0,
      [1000, 2000, 4000]
    )!
    expect(points.map((p) => p.profit)).toEqual(
      [1000 / 3, 2000 / 3, 4000 / 3].map((x) => expect.closeTo(x, 8))
    )
  })

  it("returns null for an incomplete plan", () => {
    expect(
      simulateBudgets({ ...PLAN, cpc: null }, DEFAULT_SCENARIOS.realistic, 10, [1])
    ).toBeNull()
    expect(
      simulateBudgets(
        { ...PLAN, marginPercent: null },
        DEFAULT_SCENARIOS.realistic,
        10,
        [1]
      )
    ).toBeNull()
  })

  it("builds a sorted range that contains the base budget", () => {
    const range = budgetRange(3000, 10)
    expect(range).toContain(3000)
    expect(range[0]).toBeCloseTo(600, 10)
    expect(range.at(-1)).toBeCloseTo(9000, 10)
    expect([...range].sort((a, b) => a - b)).toEqual(range)
  })
})

describe("optimalBudget", () => {
  it("finds the profit-maximising budget", () => {
    const result = optimalBudget(PLAN, DEFAULT_SCENARIOS.realistic, 10)
    expect(result?.kind).toBe("optimum")
    if (result?.kind !== "optimum") return
    const [left, best, right] = simulateBudgets(PLAN, DEFAULT_SCENARIOS.realistic, 10, [
      result.budget * 0.99,
      result.budget,
      result.budget * 1.01,
    ])!
    expect(best.profit).toBeGreaterThan(left.profit)
    expect(best.profit).toBeGreaterThan(right.profit)
    expect(best.profit).toBeCloseTo(result.profit, 8)
  })

  it("reports unbounded growth for a constant, profitable CPC", () => {
    expect(optimalBudget(PLAN, DEFAULT_SCENARIOS.realistic, 0)).toEqual({
      kind: "unbounded",
    })
  })

  it("reports no profitable budget when CPC exceeds break-even CPC at any spend", () => {
    expect(optimalBudget({ ...PLAN, cpc: 2.5 }, DEFAULT_SCENARIOS.realistic, 0)).toEqual({
      kind: "none",
    })
  })

  it("finds a smaller budget when clicks get cheaper at lower spend", () => {
    // CPC 2.50 > break-even 2.00 at 3000 zł, but CPC falls as the budget shrinks.
    const result = optimalBudget({ ...PLAN, cpc: 2.5 }, DEFAULT_SCENARIOS.realistic, 10)
    expect(result?.kind).toBe("optimum")
    if (result?.kind === "optimum") expect(result.budget).toBeLessThan(3000)
  })

  it("is null for an incomplete plan", () => {
    expect(optimalBudget(EMPTY_BUDGET_INPUT, DEFAULT_SCENARIOS.realistic, 10)).toBeNull()
  })
})
