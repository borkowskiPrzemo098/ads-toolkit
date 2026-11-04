import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { fieldForHeader, normalizeHeader, suggestMapping } from "@/lib/auditor/columns"
import { detectReportType } from "@/lib/auditor/detect"
import {
  analyzeReport,
  findHeaderRow,
  parseCellNumber,
  periodFromPreamble,
  plural,
  recordCount,
  sameContent,
} from "@/lib/auditor/import"
import { detectDelimiter, ImportError, parseSheet } from "@/lib/auditor/parse"

const FIXTURES = join(__dirname, "../fixtures/auditor")
const load = (name: string) =>
  parseSheet(new Uint8Array(readFileSync(join(FIXTURES, name))))
const analyze = async (name: string) => {
  const table = await load(name)
  return { table, analysis: analyzeReport(table, { fileName: name }) }
}
const messages = (a: { issues: { message: string }[] }) =>
  a.issues.map((i) => i.message).join("\n")

describe("column dictionary", () => {
  it.each([
    ["Koszt/konw.", "costPerConversion"],
    ["Cost / conv.", "costPerConversion"],
    ["Śr. CPC", "avgCpc"],
    ["Avg. CPC", "avgCpc"],
    ["Wyśw.", "impressions"],
    ["Impr.", "impressions"],
    ["Wartość konw.", "conversionValue"],
    ["Conv. value", "conversionValue"],
    ["Wartość konw./koszt", "roas"],
    ["Wyszukiwane hasło", "searchTerm"],
    ["Search term", "searchTerm"],
    ["Search keyword", "keyword"],
    ["Miasto (lokalizacja użytkownika)", "location"],
    ["Country/Territory (User location)", "location"],
    ["Hour of the day", "hour"],
    ["Dzień tygodnia", "dayOfWeek"],
    ["Identyfikator kampanii", "campaignId"],
    ["Ad group ID", "adGroupId"],
  ])("%s → %s", (header, field) => {
    expect(fieldForHeader(header)).toBe(field)
  })

  it("normalises case, diacritics and punctuation", () => {
    expect(normalizeHeader("  Koszt / Konw. ")).toBe("koszt/konw")
    expect(fieldForHeader("Nieznana kolumna")).toBeNull()
  })

  it("keeps the first column when two headers name the same field", () => {
    expect(suggestMapping(["Region", "Miasto", "Koszt"])).toEqual({
      location: 0,
      cost: 2,
    })
  })
})

describe("report type detection", () => {
  it("prefers the most granular dimension", () => {
    const mapping = suggestMapping([
      "Search term",
      "Campaign",
      "Search keyword",
      "Clicks",
      "Cost",
    ])
    expect(detectReportType(mapping).type).toBe("searchTerm")
    expect(
      detectReportType(suggestMapping(["Kampania", "Urządzenie", "Koszt"])).type
    ).toBe("device")
    expect(detectReportType(suggestMapping(["Kampania", "Koszt"])).type).toBe("campaign")
  })

  it("recognises ads without IDs and schedules without hours", () => {
    expect(detectReportType(suggestMapping(["Ad type", "Headline 1", "Cost"])).type).toBe(
      "ad"
    )
    expect(detectReportType(suggestMapping(["Dzień tygodnia", "Koszt"])).type).toBe(
      "schedule"
    )
  })

  it("returns null for unknown columns", () => {
    expect(detectReportType(suggestMapping(["Imię", "Nazwisko"])).type).toBeNull()
  })
})

describe("parsing", () => {
  it("detects comma, semicolon and tab separators, respecting quotes", () => {
    expect(detectDelimiter('a,b,c\n"1 234,56",2,3\n4,5,6')).toBe(",")
    expect(detectDelimiter("a;b;c\n1,5;2;3")).toBe(";")
    expect(detectDelimiter("a\tb\tc\n1,5\t2\t3")).toBe("\t")
  })

  it("reads XLSX numbers as canonical numbers, CSV numbers in any locale", () => {
    expect(parseCellNumber("41.666667", "xlsx")).toBeCloseTo(41.666667)
    expect(parseCellNumber("1 234,56 zł", "csv")).toBe(1234.56)
    expect(parseCellNumber("1,234.56", "csv")).toBe(1234.56)
    expect(parseCellNumber("--", "csv")).toBeNull()
  })

  it("rejects empty files and unknown binary content", async () => {
    await expect(load("pusty.csv")).rejects.toBeInstanceOf(ImportError)
    await expect(
      parseSheet(new Uint8Array([0x00, 0x01, 0x02, 0x00, 0x41]))
    ).rejects.toThrow("binarny")
  })

  it("finds the period line above the header", () => {
    expect(
      periodFromPreamble([["Raport"], ["1 października 2026 - 31 października 2026"]])
    ).toEqual({ from: "2026-10-01", to: "2026-10-31" })
    expect(periodFromPreamble([["October 1, 2026 - October 31, 2026"]])).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    })
  })
})

describe("realistic exports", () => {
  it("Polish campaign report: header after title rows, two totals rows skipped", async () => {
    const { table, analysis } = await analyze("kampanie-pl.csv")
    expect(table.delimiter).toBe(",")
    expect(findHeaderRow(table.rows)).toBe(2)
    expect(analysis.type).toBe("campaign")
    expect(analysis.dataRows).toHaveLength(4)
    expect(analysis.skipped.totals).toHaveLength(2)
    expect(analysis.mapping.campaignId).toBe(3)
    expect(analysis.period).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      source: "nagłówek pliku",
    })
    expect(analysis.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(messages(analysis)).toContain("Pominięto 2 wiersze podsumowania")
  })

  it("English search terms report with US numbers", async () => {
    const { table, analysis } = await analyze("search-terms-en.csv")
    expect(analysis.type).toBe("searchTerm")
    expect(analysis.dataRows).toHaveLength(5)
    const costCol = analysis.mapping.cost!
    expect(parseCellNumber(table.rows[analysis.dataRows[0]][costCol], "csv")).toBe(296.4)
    expect(analysis.missingRequired).toEqual([])
  })

  it("UTF-16 tab keyword export: Polish letters, repeated header and duplicate row", async () => {
    const { table, analysis } = await analyze("slowa-kluczowe-utf16.csv")
    expect(table.encoding).toBe("utf-16")
    expect(table.delimiter).toBe("\t")
    expect(analysis.columns[0]).toBe("Słowo kluczowe")
    expect(analysis.type).toBe("keyword")
    expect(analysis.skipped.repeatedHeaders).toHaveLength(1)
    expect(analysis.duplicates).toHaveLength(1)
    expect(recordCount(analysis, false)).toBe(4)
    expect(recordCount(analysis, true)).toBe(3)
    expect(messages(analysis)).toContain("identyczny")
  })

  it("XLSX device report keeps fractional conversions", async () => {
    const { table, analysis } = await analyze("urzadzenia.xlsx")
    expect(table.format).toBe("xlsx")
    expect(analysis.type).toBe("device")
    const conv = analysis.mapping.conversions!
    expect(parseCellNumber(table.rows[analysis.dataRows[0]][conv], "xlsx")).toBeCloseTo(
      52.333333
    )
    expect(analysis.dataRows).toHaveLength(3)
  })

  it.each([
    ["godziny-srednik.csv", "schedule"],
    ["lokalizacje.csv", "location"],
    ["reklamy-en.xlsx", "ad"],
    ["strony-docelowe.csv", "landingPage"],
    ["konwersje.csv", "conversion"],
    ["grupy-reklam.csv", "adGroup"],
  ])("%s is a %s report", async (name, type) => {
    const { analysis } = await analyze(name)
    expect(analysis.type).toBe(type)
    expect(analysis.issues.filter((i) => i.severity === "error")).toEqual([])
  })

  it("semicolon file re-saved in Excel", async () => {
    const { table } = await analyze("godziny-srednik.csv")
    expect(table.delimiter).toBe(";")
  })

  it("reports missing required columns, non-numbers and negative clicks", async () => {
    const { analysis } = await analyze("brak-kosztu.csv")
    expect(analysis.type).toBe("campaign")
    expect(analysis.missingRequired).toEqual(["cost"])
    const text = messages(analysis)
    expect(text).toContain("Brakuje kolumn potrzebnych do analizy: Koszt")
    expect(text).toContain("nie jest liczbą")
    expect(text).toContain("ujemne")
  })

  it("unknown columns: no header found, the user must map", async () => {
    const { analysis } = await analyze("nieznany.csv")
    expect(analysis.type).toBeNull()
    expect(analysis.issues[0].severity).toBe("error")
  })

  it("a user mapping and type override are respected", async () => {
    const table = await load("kampanie-pl.csv")
    const analysis = analyzeReport(table, {
      mapping: { campaign: 1, cost: 8, clicks: 5 },
      type: "campaign",
    })
    expect(analysis.mapping).toEqual({ campaign: 1, cost: 8, clicks: 5 })
    expect(analysis.missingUseful).toContain("conversions")
  })

  it("detects the same file imported twice", async () => {
    expect(
      sameContent(await load("lokalizacje.csv"), await load("lokalizacje.csv"))
    ).toBe(true)
    expect(sameContent(await load("lokalizacje.csv"), await load("konwersje.csv"))).toBe(
      false
    )
  })
})

describe("plural", () => {
  it("follows Polish rules", () => {
    expect(
      [1, 2, 5, 12, 22, 25].map((n) => plural(n, "wiersz", "wiersze", "wierszy"))
    ).toEqual(["wiersz", "wiersze", "wierszy", "wierszy", "wiersze", "wierszy"])
  })
})

describe("chart exports", () => {
  it("the chart download (date + one metric) gets a hint where the table download is", async () => {
    const text = [
      "Data,Wyśw.",
      '"śr., 28 paź 2026",20 658',
      '"czw., 29 paź 2026",19 006',
    ].join("\n")
    const table = await parseSheet(new TextEncoder().encode(text))
    const analysis = analyzeReport(table, { fileName: "Wykres_z_serią_czasową.csv" })
    expect(analysis.type).toBeNull()
    expect(analysis.issues[0].message).toContain("To eksport wykresu")
    expect(analysis.period).toEqual({
      from: "2026-10-28",
      to: "2026-10-29",
      source: "kolumna",
    })
  })
})
