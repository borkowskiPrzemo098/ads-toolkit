import { describe, expect, it } from "vitest"
import {
  EMPTY_PROFITABILITY_FORM,
  validateProfitabilityForm,
} from "@/lib/validators/profitability"

const form = (patch: Partial<typeof EMPTY_PROFITABILITY_FORM>) => ({
  ...EMPTY_PROFITABILITY_FORM,
  ...patch,
})

describe("validateProfitabilityForm", () => {
  it("parses Polish and English decimals and leaves empty fields null", () => {
    const { input, errors } = validateProfitabilityForm(
      form({ adSpend: "1 250,50", marginPercent: "30%", revenue: "5000.5" })
    )
    expect(errors).toEqual({})
    expect(input.adSpend).toBe(1250.5)
    expect(input.marginPercent).toBe(30)
    expect(input.revenue).toBe(5000.5)
    expect(input.clicks).toBeNull()
  })

  it("rejects text, negatives, fractional clicks and margin above 100%", () => {
    const { input, errors } = validateProfitabilityForm(
      form({ adSpend: "abc", revenue: "-5", clicks: "10,5", marginPercent: "120" })
    )
    expect(Object.keys(errors).sort()).toEqual(
      ["adSpend", "clicks", "marginPercent", "revenue"].sort()
    )
    expect(input.adSpend).toBeNull()
    expect(input.clicks).toBeNull()
  })

  it("allows fractional conversions from attribution models", () => {
    const { errors, input } = validateProfitabilityForm(form({ conversions: "12,4" }))
    expect(errors).toEqual({})
    expect(input.conversions).toBe(12.4)
  })

  it("warns about inconsistent data without blocking it", () => {
    const { warnings, errors } = validateProfitabilityForm(
      form({ clicks: "10", conversions: "20", revenue: "1000", avgOrderValue: "100" })
    )
    expect(errors).toEqual({})
    expect(warnings).toHaveLength(2)
  })
})
