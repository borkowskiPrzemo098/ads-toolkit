import { describe, expect, it } from "vitest"
import { analyzeProfitability } from "@/lib/calculations/profitability"
import { guardFormula, toCsv } from "@/lib/export/csv"
import { datedFilename } from "@/lib/export/download"
import { profitabilityCsvRows, profitabilityReport } from "@/lib/export/profitability"
import { profitabilityNotes, profitabilityVerdict } from "@/lib/export/profitability-text"
import { formatDelta } from "@/lib/formatting/metric"

const nbsp = (s: string) => s.replace(/[  ]/g, " ")

describe("CSV", () => {
  it("uses BOM, semicolons, CRLF and comma decimals", () => {
    expect(
      toCsv([
        ["a", 1.5],
        ["b", -2],
      ])
    ).toBe("﻿a;1,50\r\nb;-2,00")
  })

  it.each([
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+48 600", "'+48 600"],
    ["-cmd", "'-cmd"],
    ["@import", "'@import"],
    ["\tx", "'\tx"],
    ["zwykły tekst", "zwykły tekst"],
  ])("guards formula injection: %j", (input, expected) => {
    expect(guardFormula(input)).toBe(expected)
  })

  it("does not guard negative numbers it formats itself", () => {
    expect(toCsv([[-1100]])).toBe("﻿-1100,00")
  })

  it("quotes cells with separators, quotes and newlines", () => {
    expect(toCsv([['Kampania "A"; test', "x\ny"]])).toBe('﻿"Kampania ""A""; test";"x\ny"')
  })

  it("renders empty cells for null", () => {
    expect(toCsv([[null, undefined, "x"]])).toBe("﻿;;x")
  })
})

describe("datedFilename", () => {
  it("uses the local date", () => {
    expect(datedFilename("rentownosc", "csv", new Date(2026, 0, 5))).toBe(
      "rentownosc-2026-01-05.csv"
    )
  })
})

describe("formatDelta", () => {
  it("formats currency and percentage-point differences with signs", () => {
    expect(nbsp(formatDelta(100, 220.5, "currency", "PLN"))).toBe("+120,50 zł")
    expect(formatDelta(5.5, 2.3, "percent", "PLN")).toBe("−3,2 p.p.")
    expect(formatDelta(1, 1, "percent", "PLN")).toBe("0,0 p.p.")
  })
})

const base = {
  adSpend: 2000,
  impressions: null,
  clicks: 1000,
  conversions: 40,
  revenue: 12000,
  avgOrderValue: null,
  marginPercent: 30,
  extraCosts: 300,
  productCostPerConversion: null,
}

describe("profitability export", () => {
  const a = analyzeProfitability(base)
  const b = analyzeProfitability({ ...base, revenue: 4000 })

  it("builds a single-campaign CSV with reasons for missing metrics", () => {
    const rows = profitabilityCsvRows([{ name: "Kampania A", result: a }], "PLN")
    expect(rows[0]).toEqual(["Wskaźnik", "Jednostka", "Wartość", "Uwagi", "Wzór"])
    const ctr = rows.find((r) => r[0] === "CTR")!
    expect(ctr[2]).toBeNull()
    expect(String(ctr[3])).toContain("wyświetlenia")
    const net = rows.find((r) => r[0] === "Zysk netto kampanii")!
    expect(net[2]).toBeCloseTo(1300, 10)
  })

  it("builds a comparison CSV with B − A", () => {
    const rows = profitabilityCsvRows(
      [
        { name: "A", result: a },
        { name: "B", result: b },
      ],
      "EUR"
    )
    const revenue = rows.find((r) => r[0] === "Przychód")!
    expect(revenue.slice(1, 5)).toEqual(["EUR", 12000, 4000, -8000])
  })

  it("builds a PDF model with a verdict and data-based notes", () => {
    const report = profitabilityReport([{ name: "Kampania A", result: a }], "PLN")
    expect(report.summary?.tone).toBe("positive")
    expect(report.tables.map((t) => t.heading)).toHaveLength(4)
    expect(report.notes?.some((n) => n.includes("powyżej progu"))).toBe(true)
  })
})

describe("verdict and notes", () => {
  it("states a loss with the absolute amount", () => {
    const r = analyzeProfitability({ ...base, revenue: 4000 })
    const verdict = profitabilityVerdict(r, "PLN")!
    expect(verdict.tone).toBe("negative")
    expect(nbsp(verdict.text)).toBe("Kampania traci: 1100,00 zł straty netto.")
    expect(profitabilityNotes(r, "PLN").some((n) => n.includes("poniżej progu"))).toBe(
      true
    )
  })

  it("returns no verdict without enough data", () => {
    const r = analyzeProfitability({ ...base, marginPercent: null })
    expect(profitabilityVerdict(r, "PLN")).toBeNull()
  })
})
