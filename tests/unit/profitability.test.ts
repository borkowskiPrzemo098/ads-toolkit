import { describe, expect, it } from "vitest"
import { breakEvenRoas, maxCpa } from "@/lib/calculations/profitability"

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
