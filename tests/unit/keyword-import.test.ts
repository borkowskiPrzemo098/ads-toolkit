import { describe, expect, it } from "vitest"
import { keywordColumnValues, parseKeywordTable } from "@/lib/csv/keyword-import"
import { decodeText } from "@/lib/csv/read-file"

const utf16le = (text: string) => {
  const bytes = new Uint8Array(2 + text.length * 2)
  bytes[0] = 0xff
  bytes[1] = 0xfe
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[2 + i * 2] = code & 0xff
    bytes[3 + i * 2] = code >> 8
  }
  return bytes
}

describe("decodeText", () => {
  it("decodes UTF-8 with and without BOM", () => {
    const plain = new TextEncoder().encode("buty żółte")
    expect(decodeText(plain)).toBe("buty żółte")
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...plain]))).toBe("buty żółte")
  })

  it("decodes UTF-16 LE from Keyword Planner", () => {
    expect(decodeText(utf16le("Keyword\tAvg. monthly searches\nbuty łódź\t100"))).toBe(
      "Keyword\tAvg. monthly searches\nbuty łódź\t100"
    )
  })
})

describe("parseKeywordTable", () => {
  it("finds the header below report title lines (Keyword Planner, tab-separated)", () => {
    const text = [
      "Keyword Stats 2026-11-01 at 10_00_00",
      "1 listopada 2025 - 31 października 2026",
      "Keyword\tCurrency\tAvg. monthly searches",
      "buty damskie\tPLN\t9900",
      "buty męskie\tPLN\t5400",
    ].join("\n")
    const table = parseKeywordTable(text)
    expect(table.headerRow).toBe(2)
    expect(table.keywordColumn).toBe(0)
    expect(keywordColumnValues(table, 0)).toEqual(["buty damskie", "buty męskie"])
  })

  it("recognises Polish Google Ads headers and skips totals", () => {
    const text = [
      "Raport wyszukiwanych haseł",
      '"Wyszukiwane hasło","Kampania","Kliknięcia"',
      '"buty, damskie","Buty",12',
      '"tanie buty","Buty",4',
      '"Razem: konto","",16',
    ].join("\n")
    const table = parseKeywordTable(text)
    expect(table.keywordColumn).toBe(0)
    expect(keywordColumnValues(table, 0)).toEqual(["buty, damskie", "tanie buty"])
  })

  it("falls back to the first column without a header", () => {
    const table = parseKeywordTable("buty;10\nkurtki;5")
    expect(table.headerRow).toBeNull()
    expect(table.columnNames).toEqual(["Kolumna 1", "Kolumna 2"])
    expect(keywordColumnValues(table, 0)).toEqual(["buty", "kurtki"])
    expect(keywordColumnValues(table, 1)).toEqual(["10", "5"])
  })
})
