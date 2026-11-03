import { describe, expect, it } from "vitest"
import {
  analyzeAbTest,
  minimumDetectableRelative,
  newcombeInterval,
  sampleSizePerVariant,
  twoProportionZ,
  wilsonInterval,
  type VariantInput,
} from "@/lib/calculations/ab-test"
import { abCsvRows, abReport } from "@/lib/export/ab-test"
import { abTestNotes, formatPValue, verdictText } from "@/lib/export/ab-test-text"
import { normalCdf, twoSidedP } from "@/lib/stats/normal"
import { validateVariantForm } from "@/lib/validators/ab-test"
import type { CalcResult } from "@/types/calculation"

const v = (r: CalcResult) => {
  if (!r.ok) throw new Error(r.reason)
  return r.value
}
const variant = (
  visitors: number | null,
  conversions: number | null,
  cost: number | null = null
): VariantInput => ({
  visitors,
  conversions,
  cost,
})

describe("normal distribution", () => {
  it.each([
    [0, 0.5],
    [1, 0.841344746],
    [1.959963985, 0.975],
    [-2.575829304, 0.005],
    [3, 0.998650102],
  ])("Φ(%d) = %d", (z, expected) => {
    expect(normalCdf(z)).toBeCloseTo(expected, 6)
  })

  it("gives two-sided p-values", () => {
    expect(twoSidedP(1.959963985)).toBeCloseTo(0.05, 6)
    expect(twoSidedP(-1.959963985)).toBeCloseTo(0.05, 6)
    // The erf approximation is accurate to ~1e-7, not to the last bit.
    expect(twoSidedP(0)).toBeCloseTo(1, 6)
  })
})

/*
 * Independent reference values, computed by hand from the textbook formulas and matching
 * statsmodels.proportions_ztest / published Wilson tables:
 *   50/1000 vs 75/1000: pooled 0.0625, SE 0.010825, z 2.3094, p 0.0209
 *   20/500 vs 25/500:   pooled 0.045,  SE 0.013111, z 0.7627, p 0.4456
 *   Wilson 95% for 50/1000: [0.0381, 0.0653]
 *   Newcombe 95% for the first pair: [0.0037, 0.0466]
 *   Fleiss sample size 5% → 6%, 80% power: 8158 per variant
 */
describe("two-proportion z-test", () => {
  it("matches reference example 1 (significant)", () => {
    const r = twoProportionZ(50, 1000, 75, 1000)!
    expect(r.z).toBeCloseTo(2.3094, 3)
    expect(r.pValue).toBeCloseTo(0.0209, 3)
  })

  it("matches reference example 2 (not significant)", () => {
    const r = twoProportionZ(20, 500, 25, 500)!
    expect(r.z).toBeCloseTo(0.7627, 3)
    expect(r.pValue).toBeCloseTo(0.4456, 3)
  })

  it("is symmetric and undefined when nobody or everybody converts", () => {
    expect(twoProportionZ(75, 1000, 50, 1000)!.z).toBeCloseTo(-2.3094, 3)
    expect(twoProportionZ(0, 100, 0, 100)).toBeNull()
    expect(twoProportionZ(100, 100, 50, 50)).toBeNull()
  })
})

describe("intervals", () => {
  it("Wilson interval matches the reference", () => {
    const ci = wilsonInterval(50, 1000)
    expect(ci.low).toBeCloseTo(0.0381, 4)
    expect(ci.high).toBeCloseTo(0.0653, 4)
  })

  it("Wilson interval stays inside [0, 1] for 0% and 100%", () => {
    const zero = wilsonInterval(0, 20)
    expect(zero.low).toBe(0)
    expect(zero.high).toBeGreaterThan(0.1)
    const all = wilsonInterval(20, 20)
    expect(all.high).toBe(1)
    expect(all.low).toBeLessThan(0.9)
  })

  it("Newcombe interval for the difference matches the reference", () => {
    const ci = newcombeInterval(50, 1000, 75, 1000)
    expect(ci.low).toBeCloseTo(0.0037, 3)
    expect(ci.high).toBeCloseTo(0.0466, 3)
  })
})

describe("planning", () => {
  it("sample size matches Fleiss' formula", () => {
    expect(sampleSizePerVariant(0.05, 0.06)).toBe(8158)
    expect(sampleSizePerVariant(0.05, 0.05)).toBeNull()
  })

  it("minimum detectable effect shrinks with more traffic", () => {
    expect(minimumDetectableRelative(0.05, 10000)).toBeCloseTo(17.27, 1)
    expect(minimumDetectableRelative(0.05, 40000)!).toBeCloseTo(17.27 / 2, 1)
    expect(minimumDetectableRelative(0, 1000)).toBeNull()
  })
})

describe("analyzeAbTest: verdicts", () => {
  it("reports a significant difference with rates, diffs and CPA", () => {
    const r = analyzeAbTest(variant(1000, 50, 500), variant(1000, 75, 525))
    expect(r.verdict).toBe("significant")
    expect(v(r.a.rate)).toBeCloseTo(5, 10)
    expect(v(r.b.rate)).toBeCloseTo(7.5, 10)
    expect(v(r.absoluteDiff)).toBeCloseTo(0.025, 10)
    expect(v(r.relativeDiff)).toBeCloseTo(50, 10)
    expect(v(r.a.cpa)).toBeCloseTo(10, 10)
    expect(v(r.b.cpa)).toBeCloseTo(7, 10)
    expect(v(r.b.costPerVisit)).toBeCloseTo(0.525, 10)
    expect(r.borderline).toBe(false)
  })

  it("asks for more data when the trend may become significant", () => {
    // p ≈ 0.10 with a reachable sample.
    const r = analyzeAbTest(variant(2000, 100), variant(2000, 122))
    expect(r.pValue!).toBeGreaterThan(0.05)
    expect(r.pValue!).toBeLessThan(0.2)
    expect(r.verdict).toBe("keep-testing")
    expect(r.requiredPerVariant!).toBeGreaterThan(2000)
  })

  it("reports no significant difference when the effect is tiny and the sample large", () => {
    const r = analyzeAbTest(variant(20000, 1000), variant(20000, 1005))
    expect(r.pValue!).toBeGreaterThan(0.2)
    expect(r.verdict).toBe("not-significant")
    expect(r.requiredPerVariant!).toBeGreaterThan(20000 * 3)
  })

  it("does not call a higher rate a winner without enough data", () => {
    const r = analyzeAbTest(variant(40, 2), variant(40, 6))
    expect(v(r.b.rate)).toBeGreaterThan(v(r.a.rate))
    expect(r.verdict).toBe("insufficient")
    expect(r.insufficientReason).toContain("Za mało danych")
  })
})

describe("analyzeAbTest: edge cases", () => {
  it("handles missing data, zero visits and impossible counts", () => {
    expect(
      analyzeAbTest(variant(null, null), variant(100, 5)).insufficientReason
    ).toContain("wariantu A")
    expect(analyzeAbTest(variant(0, 0), variant(100, 5)).insufficientReason).toContain(
      "nie ma wizyt"
    )
    expect(
      analyzeAbTest(variant(100, 120), variant(100, 5)).insufficientReason
    ).toContain("więcej konwersji niż wizyt")
  })

  it("handles no conversions at all and zero conversions in A", () => {
    const none = analyzeAbTest(variant(1000, 0), variant(1000, 0))
    expect(none.verdict).toBe("insufficient")
    expect(none.insufficientReason).toContain("Żaden wariant")

    const zeroA = analyzeAbTest(variant(1000, 0, 100), variant(1000, 20, 100))
    expect(zeroA.relativeDiff.ok).toBe(false)
    expect(zeroA.a.cpa.ok).toBe(false)
    expect(zeroA.absoluteDiff.ok).toBe(true)
  })

  it("flags a traffic split far from 50/50", () => {
    expect(analyzeAbTest(variant(1000, 50), variant(1500, 75)).sampleRatioMismatch).toBe(
      true
    )
    expect(analyzeAbTest(variant(1000, 50), variant(1040, 52)).sampleRatioMismatch).toBe(
      false
    )
  })

  it("explains CPA without cost and keeps the test working", () => {
    const r = analyzeAbTest(variant(1000, 50), variant(1000, 75))
    expect(r.a.cpa.ok).toBe(false)
    expect(r.verdict).toBe("significant")
  })
})

describe("A/B texts and export", () => {
  const sig = analyzeAbTest(variant(1000, 50, 500), variant(1000, 75, 525))

  it("formats p-values and explains a significant result without hype", () => {
    expect(formatPValue(0.02092)).toBe("p = 0,021")
    expect(formatPValue(0.0004)).toBe("p < 0,001")
    const text = verdictText(sig)
    expect(text).toContain("Wariant B ma wyższy współczynnik konwersji niż Wariant A")
    expect(verdictText(sig, { a: "Stary baner", b: "Nowy baner" })).toContain(
      "Nowy baner ma wyższy współczynnik konwersji niż Stary baner"
    )
    expect(text).toContain("p = 0,021")
    expect(abTestNotes(sig).join(" ")).toContain("porównaj też koszt konwersji")
  })

  it("asks to continue the test instead of picking a winner", () => {
    const r = analyzeAbTest(variant(2000, 100), variant(2000, 122))
    expect(verdictText(r)).toContain("Kontynuuj test")
    expect(verdictText(r)).toMatch(/około [\d\s\u00a0]+ wizyt na wariant/)
  })

  it("does not claim the variants are equal when nothing was detected", () => {
    const r = analyzeAbTest(variant(20000, 1000), variant(20000, 1005))
    expect(verdictText(r)).toContain("nie dowodzi, że warianty działają tak samo")
  })

  it("validates whole-number counts", () => {
    const { input, errors } = validateVariantForm({
      visitors: "1000",
      conversions: "12,5",
      cost: "250,50",
    })
    expect(errors.conversions).toBeDefined()
    expect(input).toEqual({ visitors: 1000, conversions: null, cost: 250.5 })
  })

  it("builds CSV and PDF models", () => {
    const data = {
      names: { a: "Wariant A", b: "Wariant B" },
      inputs: { a: variant(1000, 50, 500), b: variant(1000, 75, 525) },
      result: sig,
      currency: "PLN" as const,
    }
    const rows = abCsvRows(data)
    expect(rows.find((r) => r[0] === "Współczynnik konwersji (%)")).toEqual([
      "Współczynnik konwersji (%)",
      5,
      7.5,
    ])
    expect(rows.find((r) => r[0] === "Werdykt")?.[1]).toBe(
      "Wykryto istotną statystycznie różnicę"
    )
    const report = abReport(data)
    expect(report.summary?.tone).toBe("positive")
    expect(report.notes?.at(-1)).toContain("Wilsona")
  })
})
