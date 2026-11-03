import { describe, expect, it } from "vitest"
import { parseKeywordTable } from "@/lib/csv/keyword-import"
import { parseReportNumber } from "@/lib/csv/numbers"
import { detectMetricColumns, searchTermsFromTable } from "@/lib/csv/search-terms-import"

describe("parseReportNumber", () => {
  it.each([
    ["12", 12],
    ["1 234,56", 1234.56],
    ["1 234,56 zł", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234,5", 1234.5],
    ["12,5%", 12.5],
    ["1,234", 1234],
    ["0,00", 0],
    ["−5,50", -5.5],
    ["€3.20", 3.2],
  ])("%j → %d", (cell, expected) => {
    expect(parseReportNumber(cell)).toBe(expected)
  })

  it.each(["", "--", " -- ", "abc", null, undefined])("%j → null", (cell) => {
    expect(parseReportNumber(cell)).toBeNull()
  })
})

describe("search terms report import", () => {
  const text = [
    "Raport wyszukiwanych haseł",
    "1 października 2026 - 31 października 2026",
    "Wyszukiwane hasło,Typ dopasowania,Kliknięcia,Wyśw.,Koszt,Konwersje",
    'praca w sklepie,Do wyrażenia,4,120,"6,20",0',
    'buty damskie,Ścisłe,30,900,"45,10","3,00"',
    'Razem: konto,,34,1020,"51,30","3,00"',
  ].join("\n")
  const table = parseKeywordTable(text)

  it("finds the term column and metric columns", () => {
    expect(table.keywordColumn).toBe(0)
    expect(detectMetricColumns(table)).toEqual({
      clicks: 2,
      impressions: 3,
      cost: 4,
      conversions: 5,
    })
  })

  it("reads terms with metrics and skips the totals row", () => {
    const terms = searchTermsFromTable(table, 0, detectMetricColumns(table))
    expect(terms).toEqual([
      { term: "praca w sklepie", clicks: 4, impressions: 120, cost: 6.2, conversions: 0 },
      { term: "buty damskie", clicks: 30, impressions: 900, cost: 45.1, conversions: 3 },
    ])
  })

  it("returns null metrics for a plain list", () => {
    const plain = parseKeywordTable("praca\nbuty")
    expect(detectMetricColumns(plain)).toEqual({})
    expect(searchTermsFromTable(plain, 0, {})[0]).toEqual({
      term: "praca",
      clicks: null,
      impressions: null,
      cost: null,
      conversions: null,
    })
  })
})
