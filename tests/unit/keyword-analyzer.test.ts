import { describe, expect, it } from "vitest"
import {
  analyzeKeywords,
  MAX_KEYWORDS,
  splitKeywordText,
} from "@/lib/calculations/keyword-analyzer"
import {
  nearDuplicateKey,
  normalizeKeyword,
  stem,
  stripDiacritics,
} from "@/lib/keywords/normalize"

describe("normalizeKeyword", () => {
  it.each([
    ["  Buty   Damskie ", "buty damskie"],
    ["[buty damskie]", "buty damskie"],
    ['"buty damskie"', "buty damskie"],
    ["+buty +damskie", "buty damskie"],
    ["BUTY\tDAMSKIE.", "buty damskie"],
    ["Łódź ŻÓŁTA", "łódź żółta"],
    ["   ", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeKeyword(input)).toBe(expected)
  })

  it("keeps meaningful inner punctuation and numbers", () => {
    expect(normalizeKeyword("iPhone 15 pro-max")).toBe("iphone 15 pro-max")
    expect(normalizeKeyword("sklep.pl")).toBe("sklep.pl")
  })
})

describe("stemming and near-duplicate keys", () => {
  it("folds diacritics", () => {
    expect(stripDiacritics("zażółć gęślą jaźń")).toBe("zazolc gesla jazn")
  })

  it.each([
    ["buty", "but"],
    ["butów", "but"],
    ["damskie", "damsk"],
    ["damskich", "damsk"],
    ["obuwniczy", "obuwnicz"],
    ["obuwniczym", "obuwnicz"],
    ["tanim", "tan"],
    ["klientowi", "klient"],
    ["iphone15", "iphone15"],
    ["kot", "kot"],
  ])("stem(%j) = %j", (word, expected) => {
    expect(stem(word)).toBe(expected)
  })

  it("matches word order, inflection, diacritics and stopwords", () => {
    const key = nearDuplicateKey("buty damskie")
    expect(nearDuplicateKey("damskie buty")).toBe(key)
    expect(nearDuplicateKey("butów damskich")).toBe(key)
    expect(nearDuplicateKey("buty dla damskie")).toBe(key)
    expect(nearDuplicateKey("buty męskie")).not.toBe(key)
  })
})

describe("splitKeywordText", () => {
  it("splits lines and keeps the first spreadsheet column", () => {
    expect(splitKeywordText("buty\nkurtki\r\nczapki\t1200")).toEqual([
      "buty",
      "kurtki",
      "czapki",
    ])
  })

  it("falls back to semicolons or commas on a single line", () => {
    expect(splitKeywordText("buty; kurtki")).toEqual(["buty", " kurtki"])
    expect(splitKeywordText("buty, kurtki")).toEqual(["buty", " kurtki"])
  })

  it("respects an explicit separator", () => {
    expect(splitKeywordText("a,b\nc", "comma")).toEqual(["a", "b\nc"])
    expect(splitKeywordText("a\tb", "tab")).toEqual(["a", "b"])
  })
})

describe("analyzeKeywords: duplicates and data integrity", () => {
  const input = [
    "buty damskie",
    "",
    "Buty  Damskie",
    "damskie buty",
    "butów damskich",
    "buty męskie",
    "   ",
  ]
  const { rows, stats } = analyzeKeywords(input)

  it("keeps one row per non-empty entry, in input order", () => {
    expect(rows.map((r) => r.id)).toEqual([0, 2, 3, 4, 5])
    expect(rows.map((r) => r.original)).toEqual([
      "buty damskie",
      "Buty  Damskie",
      "damskie buty",
      "butów damskich",
      "buty męskie",
    ])
    expect(stats.entries).toBe(7)
    expect(stats.empty).toBe(2)
    expect(stats.analyzed).toBe(5)
  })

  it("marks exact and near duplicates, pointing at the first occurrence", () => {
    expect(rows.map((r) => r.status)).toEqual([
      "unique",
      "duplicate",
      "near-duplicate",
      "near-duplicate",
      "unique",
    ])
    expect(rows[1].duplicateOf).toBe(0)
    expect(rows[2].duplicateOf).toBe(0)
    expect(rows[3].action).toContain("buty damskie")
    expect(stats.unique).toBe(4)
    expect(stats.duplicates).toBe(1)
    expect(stats.nearDuplicates).toBe(2)
  })

  it("reports entries over the limit instead of dropping them silently", () => {
    const many = Array.from({ length: MAX_KEYWORDS + 3 }, (_, i) => `fraza ${i}`)
    const result = analyzeKeywords(many)
    expect(result.stats.analyzed).toBe(MAX_KEYWORDS)
    expect(result.stats.overLimit).toBe(3)
  })
})

describe("analyzeKeywords: heuristic categories", () => {
  const categoryOf = (keyword: string, brands: string[] = []) =>
    analyzeKeywords([keyword], { brands }).rows[0]

  it.each([
    ["kup buty do biegania", "transactional", "purchase"],
    ["sklep z butami online", "transactional", "purchase"],
    ["buty do biegania cena", "price", "purchase"],
    ["tanie buty damskie", "price", "purchase"],
    ["ile kosztuje dentysta", "price", "purchase"],
    ["dentysta warszawa", "location", "purchase"],
    ["fryzjer w pobliżu", "location", "purchase"],
    ["jak wyczyścić buty zamszowe", "informational", "informational"],
    ["co to jest seo", "informational", "informational"],
    ["najlepsze buty do biegania", "research", "research"],
    ["buty nike opinie", "research", "research"],
    ["allegro buty", "navigational", "navigational"],
    ["zalando.pl", "navigational", "navigational"],
    ["buty", "generic", "unknown"],
    ["buty do biegania damskie", "product", "unknown"],
  ])("%j → %s", (keyword, category, intent) => {
    const row = categoryOf(keyword)
    expect(row.category).toBe(category)
    expect(row.intent).toBe(intent)
  })

  it("does not mistake look-alike words for signals", () => {
    expect(categoryOf("centrum handlowe mapa").category).not.toBe("price")
    expect(categoryOf("taniec towarzyski kurs").category).not.toBe("price")
  })

  it("detects brands from the user's list, including inflection-free phrases", () => {
    const row = categoryOf("buty Nike Air", ["Nike"])
    expect(row.category).toBe("brand")
    expect(row.tags).toContain("brand")
    expect(categoryOf("buty nikeless", ["Nike"]).category).not.toBe("brand")
  })

  it("keeps every matched tag, the primary one first by priority", () => {
    const row = categoryOf("tanie buty warszawa sklep")
    expect(row.category).toBe("price")
    expect(row.tags).toEqual(
      expect.arrayContaining(["price", "location", "transactional"])
    )
  })

  it("flags single words as very general", () => {
    expect(categoryOf("buty").generic).toBe(true)
    expect(categoryOf("buty damskie").generic).toBe(false)
  })
})

describe("analyzeKeywords: groups", () => {
  const { rows, topics, stats } = analyzeKeywords([
    "buty damskie",
    "tanie buty",
    "buty do biegania",
    "kurtka zimowa",
    "kurtki zimowe damskie",
    "kup kurtkę",
    "jak",
    "buty do biegania",
  ])

  it("groups by the most common subject word, ignoring modifiers", () => {
    const names = topics.map((t) => t.name)
    expect(names[0]).toBe("buty")
    expect(topics[0].rowIds).toEqual([0, 1, 2, 7])
    expect(rows.find((r) => r.keyword === "kup kurtkę")!.topic).not.toBe("kup")
  })

  it("never names a group after a function word", () => {
    const result = analyzeKeywords(["co to jest membrana gore-tex"])
    expect(result.rows[0].topic).toBe("membrana")
  })

  it("puts phrases without a subject in a last group", () => {
    expect(topics.at(-1)!.name).toBe("Bez wyraźnego tematu")
    expect(rows.find((r) => r.keyword === "jak")!.topic).toBe("Bez wyraźnego tematu")
  })

  it("counts length groups and categories without duplicates", () => {
    // 7 unique phrases: "jak" has 1 word, the rest 2–3; the repeated one is not counted.
    expect(stats.byLength).toEqual({ short: 1, medium: 6, long: 0 })
    const total = Object.values(stats.byCategory).reduce((a, b) => a + (b ?? 0), 0)
    expect(total).toBe(stats.unique)
  })

  it("handles a large list quickly", () => {
    const heads = ["buty", "kurtka", "czapka", "plecak", "torba"]
    const mods = ["tanie", "damskie", "męskie", "warszawa", "opinie", "sklep", "zimowe"]
    const big = Array.from(
      { length: 20_000 },
      (_, i) => `${heads[i % 5]} ${mods[i % 7]} model ${i % 3000}`
    )
    const start = performance.now()
    const result = analyzeKeywords(big)
    expect(performance.now() - start).toBeLessThan(3000)
    expect(result.rows).toHaveLength(20_000)
  })
})
