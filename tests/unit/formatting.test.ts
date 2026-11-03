import { describe, expect, it } from "vitest"
import { formatCurrency, formatPercent, parseDecimal } from "@/lib/formatting/number"

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ")

describe("parseDecimal", () => {
  it.each([
    ["25", 25],
    ["25,5", 25.5],
    ["25.5", 25.5],
    ["1 234,50", 1234.5],
    ["30%", 30],
    [" 7 ", 7],
  ])("%j → %d", (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(["", "  ", "abc", "1,2,3", "12a", "--1"])("%j → null", (input) => {
    expect(parseDecimal(input)).toBeNull()
  })
})

describe("formatters", () => {
  it("formats PLN and EUR in Polish locale", () => {
    // Polish CLDR groups thousands only from 5 digits up.
    expect(nbsp(formatCurrency(1234.5))).toBe("1234,50 zł")
    expect(nbsp(formatCurrency(12345.5))).toBe("12 345,50 zł")
    expect(nbsp(formatCurrency(10, "EUR"))).toBe("10,00 €")
  })

  it("uses a typographic minus and never prints negative zero", () => {
    expect(nbsp(formatCurrency(-1100))).toBe("−1100,00 zł")
    expect(formatPercent(-57.89)).toBe("−57,9%")
    expect(nbsp(formatCurrency(-0.001))).toBe("0,00 zł")
  })

  it("formats percentages with a comma", () => {
    expect(formatPercent(412.5)).toBe("412,5%")
  })
})
