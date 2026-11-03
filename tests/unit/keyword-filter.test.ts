import { describe, expect, it } from "vitest"
import { analyzeKeywords } from "@/lib/calculations/keyword-analyzer"
import { DEFAULT_FILTERS, filterKeywordRows, parseQuery } from "@/lib/keywords/filter"

const { rows } = analyzeKeywords([
  "buty damskie",
  "tanie buty",
  "kurtka zimowa męska",
  "buty damskie",
  "jak wiązać buty",
  "kurtki",
])

const keywords = (filters: Partial<typeof DEFAULT_FILTERS>) =>
  filterKeywordRows(rows, { ...DEFAULT_FILTERS, ...filters }).map((r) => r.keyword)

describe("parseQuery", () => {
  it("splits include and exclude terms, folding case and diacritics", () => {
    expect(parseQuery("Buty, -TANIE,  , wiązać")).toEqual({
      include: ["buty", "wiazac"],
      exclude: ["tanie"],
    })
  })
})

describe("filterKeywordRows", () => {
  it("returns everything in input order by default", () => {
    expect(keywords({})).toHaveLength(6)
    expect(keywords({})[0]).toBe("buty damskie")
  })

  it("searches with include and exclude terms, ignoring diacritics", () => {
    expect(keywords({ query: "buty, -tanie" })).toEqual([
      "buty damskie",
      "buty damskie",
      "jak wiązać buty",
    ])
    expect(keywords({ query: "meska" })).toEqual(["kurtka zimowa męska"])
  })

  it("filters by category, length, status and topic", () => {
    expect(keywords({ category: "price" })).toEqual(["tanie buty"])
    expect(keywords({ length: "short" })).toEqual(["kurtki"])
    expect(keywords({ status: "issues" })).toEqual(["buty damskie"])
    expect(keywords({ status: "clean" })).toHaveLength(5)
    expect(keywords({ topic: "buty" })).toHaveLength(4)
  })

  it("sorts without mutating the source rows", () => {
    const before = rows.map((r) => r.id)
    expect(keywords({ sort: "alpha" })[0]).toBe("buty damskie")
    expect(keywords({ sort: "words-desc" })[0]).toBe("kurtka zimowa męska")
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})

describe("keyword export", () => {
  it("exports every row with labels and guards formulas", async () => {
    const { keywordCsvRows, keywordPlainList } =
      await import("@/lib/export/keyword-analyzer")
    const { toCsv } = await import("@/lib/export/csv")
    const result = analyzeKeywords(["=HYPERLINK(1)", "buty damskie", "buty damskie"])
    const csvRows = keywordCsvRows(result.rows)
    expect(csvRows).toHaveLength(4)
    expect(csvRows[3][8]).toBe("Duplikat")
    expect(csvRows[3][9]).toBe("buty damskie")
    expect(toCsv(csvRows)).toContain(";'=HYPERLINK(1);")
    expect(keywordPlainList(result.rows.slice(1, 2))).toBe("buty damskie")
  })
})
