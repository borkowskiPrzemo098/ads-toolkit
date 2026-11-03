import { describe, expect, it } from "vitest"
import {
  analyzeProfitability,
  breakEvenRoas,
  EMPTY_PROFITABILITY_INPUT,
  maxCpa,
  type ProfitabilityInput,
} from "@/lib/calculations/profitability"
import type { CalcResult } from "@/types/calculation"

const v = (r: CalcResult) => {
  if (!r.ok) throw new Error(`expected a value, got: ${r.reason}`)
  return r.value
}

describe("breakEvenRoas", () => {
  it.each([
    [25, 400],
    [50, 200],
    [100, 100],
    [40, 250],
  ])("margin %d%% → %d%%", (margin, expected) => {
    const result = breakEvenRoas(margin)
    expect(result.ok && result.value).toBeCloseTo(expected, 10)
  })

  it("rejects zero, negative and >100% margins", () => {
    expect(breakEvenRoas(0).ok).toBe(false)
    expect(breakEvenRoas(-10).ok).toBe(false)
    expect(breakEvenRoas(120).ok).toBe(false)
    expect(breakEvenRoas(Number.NaN).ok).toBe(false)
  })
})

describe("maxCpa", () => {
  it("multiplies order value by margin", () => {
    const result = maxCpa(200, 30)
    expect(result.ok && result.value).toBeCloseTo(60, 10)
  })

  it("subtracts other per-conversion costs", () => {
    const result = maxCpa(200, 30, 15)
    expect(result.ok && result.value).toBeCloseTo(45, 10)
  })

  it("can be negative when other costs exceed margin, without failing", () => {
    const result = maxCpa(100, 10, 20)
    expect(result).toEqual({ ok: true, value: -10 })
  })

  it("rejects missing or invalid inputs", () => {
    expect(maxCpa(0, 30).ok).toBe(false)
    expect(maxCpa(100, 0).ok).toBe(false)
    expect(maxCpa(100, 30, -5).ok).toBe(false)
  })
})

/*
 * Reference campaign, checked by hand:
 *   spend 2000, impressions 50 000, clicks 1000, conversions 40, revenue 12 000,
 *   margin 30%, extra costs 300, product cost 180 per conversion.
 *   CTR 2%, CPC 2, CR 4%, CPA 50, AOV 300, ROAS 600%
 *   profit after ads   = 12 000 × 0.3 − 2000 − 300            = 1300
 *   profit after goods = 12 000 − 180 × 40 − 2000 − 300         = 2500
 *   total costs        = 7200 + 2000 + 300                      = 9500
 *   ROI                = 2500 / 9500                            = 26.3158%
 *   break-even ROAS 333.33%, break-even CPA 90, max CPA 90 − 300/40 = 82.5
 */
const REFERENCE: ProfitabilityInput = {
  adSpend: 2000,
  impressions: 50000,
  clicks: 1000,
  conversions: 40,
  revenue: 12000,
  avgOrderValue: null,
  marginPercent: 30,
  extraCosts: 300,
  productCostPerConversion: 180,
}

describe("analyzeProfitability: reference campaign", () => {
  const r = analyzeProfitability(REFERENCE)

  it("computes traffic metrics", () => {
    expect(v(r.ctr)).toBeCloseTo(2, 10)
    expect(v(r.cpc)).toBeCloseTo(2, 10)
    expect(v(r.conversionRate)).toBeCloseTo(4, 10)
    expect(v(r.cpa)).toBeCloseTo(50, 10)
  })

  it("derives average order value from revenue", () => {
    expect(v(r.avgOrderValue)).toBeCloseTo(300, 10)
    expect(r.avgOrderValueDerived).toBe(true)
    expect(r.revenueDerived).toBe(false)
  })

  it("keeps ROAS and ROI apart", () => {
    expect(v(r.roas)).toBeCloseTo(600, 10)
    expect(v(r.roi)).toBeCloseTo((2500 / 9500) * 100, 10)
  })

  it("computes both profit lines and prefers product cost for net profit", () => {
    expect(v(r.profitAfterAds)).toBeCloseTo(1300, 10)
    expect(v(r.profitAfterProductCost)).toBeCloseTo(2500, 10)
    expect(r.netProfitBasis).toBe("product-cost")
    expect(v(r.netProfit)).toBeCloseTo(2500, 10)
    expect(v(r.costOfGoods)).toBeCloseTo(7200, 10)
    expect(v(r.totalCosts)).toBeCloseTo(9500, 10)
    expect(r.status).toBe("profit")
  })

  it("computes break-even thresholds", () => {
    expect(v(r.breakEvenRoas)).toBeCloseTo(1000 / 3, 10)
    expect(v(r.breakEvenCpa)).toBeCloseTo(90, 10)
    expect(v(r.maxCpa)).toBeCloseTo(82.5, 10)
  })

  it("never reports revenue as profit", () => {
    expect(v(r.netProfit)).not.toBe(v(r.revenue))
  })
})

describe("analyzeProfitability: margin only", () => {
  const r = analyzeProfitability({ ...REFERENCE, productCostPerConversion: null })

  it("uses margin for net profit and cost of goods", () => {
    expect(r.netProfitBasis).toBe("margin")
    expect(v(r.netProfit)).toBeCloseTo(1300, 10)
    expect(v(r.costOfGoods)).toBeCloseTo(8400, 10)
    expect(v(r.totalCosts)).toBeCloseTo(10700, 10)
    expect(v(r.roi)).toBeCloseTo((1300 / 10700) * 100, 10)
    expect(r.profitAfterProductCost.ok).toBe(false)
  })
})

describe("analyzeProfitability: status", () => {
  it("reports a loss", () => {
    const r = analyzeProfitability({
      ...REFERENCE,
      revenue: 4000,
      productCostPerConversion: null,
    })
    expect(v(r.netProfit)).toBeCloseTo(4000 * 0.3 - 2300, 10)
    expect(r.status).toBe("loss")
  })

  it("reports break-even within 0.5% of revenue", () => {
    const r = analyzeProfitability({
      ...REFERENCE,
      revenue: 20000 / 3,
      extraCosts: null,
      productCostPerConversion: null,
    })
    expect(v(r.netProfit)).toBeCloseTo(0, 6)
    expect(r.status).toBe("breakeven")
  })

  it("is unknown without enough data", () => {
    expect(analyzeProfitability(EMPTY_PROFITABILITY_INPUT).status).toBeNull()
  })
})

describe("analyzeProfitability: missing and zero values", () => {
  it("explains every metric when the form is empty", () => {
    const r = analyzeProfitability(EMPTY_PROFITABILITY_INPUT)
    for (const key of [
      "ctr",
      "cpc",
      "conversionRate",
      "cpa",
      "revenue",
      "avgOrderValue",
      "roas",
      "profitAfterAds",
      "profitAfterProductCost",
      "netProfit",
      "totalCosts",
      "roi",
      "breakEvenRoas",
      "breakEvenCpa",
      "maxCpa",
    ] as const) {
      const metric = r[key]
      expect(metric.ok, key).toBe(false)
      if (!metric.ok) expect(metric.reason.length, key).toBeGreaterThan(5)
    }
  })

  it("does not divide by zero clicks, conversions or spend", () => {
    const r = analyzeProfitability({
      ...REFERENCE,
      adSpend: 0,
      clicks: 0,
      conversions: 0,
      impressions: 0,
    })
    expect(r.cpc.ok).toBe(false)
    expect(r.cpa.ok).toBe(false)
    expect(r.ctr.ok).toBe(false)
    expect(r.conversionRate.ok).toBe(false)
    expect(r.roas.ok).toBe(false)
    expect(r.avgOrderValue.ok).toBe(false)
    for (const metric of Object.values(r)) {
      if (metric && typeof metric === "object" && "ok" in metric && metric.ok) {
        expect(Number.isFinite(metric.value)).toBe(true)
      }
    }
  })

  it("flags more clicks than impressions instead of returning CTR above 100%", () => {
    const r = analyzeProfitability({ ...REFERENCE, impressions: 500 })
    expect(r.ctr.ok).toBe(false)
  })

  it("derives revenue from order value × conversions", () => {
    const r = analyzeProfitability({ ...REFERENCE, revenue: null, avgOrderValue: 250 })
    expect(v(r.revenue)).toBe(10000)
    expect(r.revenueDerived).toBe(true)
    expect(v(r.roas)).toBeCloseTo(500, 10)
  })

  it("treats missing extra costs as zero", () => {
    const r = analyzeProfitability({
      ...REFERENCE,
      extraCosts: null,
      productCostPerConversion: null,
    })
    expect(v(r.profitAfterAds)).toBeCloseTo(1600, 10)
    expect(v(r.maxCpa)).toBeCloseTo(90, 10)
  })

  it("rejects a margin above 100%", () => {
    const r = analyzeProfitability({ ...REFERENCE, marginPercent: 150 })
    expect(r.profitAfterAds.ok).toBe(false)
    expect(r.breakEvenRoas.ok).toBe(false)
    expect(r.breakEvenCpa.ok).toBe(false)
  })
})
