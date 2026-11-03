import { describe, expect, it } from "vitest"
import {
  buildNegativeList,
  formatNegative,
  mergeTerms,
  suggestNegatives,
  type SearchTerm,
  type SuggestionDecision,
} from "@/lib/calculations/negative-keywords"

const t = (
  term: string,
  cost: number | null = null,
  conversions: number | null = null
): SearchTerm => ({
  term,
  clicks: cost === null ? null : 1,
  impressions: null,
  cost,
  conversions,
})

const byForm = (analysis: ReturnType<typeof suggestNegatives>, form: string) =>
  analysis.suggestions.find((s) => s.forms.includes(form))

describe("mergeTerms", () => {
  it("normalises, merges duplicates and sums metrics", () => {
    const { terms, empty } = mergeTerms([
      t("Buty Praca", 2, 0),
      t("buty  praca", 3, 1),
      t("  "),
    ])
    expect(empty).toBe(1)
    expect(terms).toHaveLength(1)
    expect(terms[0]).toMatchObject({
      term: "buty praca",
      occurrences: 2,
      cost: 5,
      conversions: 1,
    })
  })

  it("keeps metrics null when the input has none", () => {
    expect(mergeTerms([t("a"), t("a")]).terms[0].cost).toBeNull()
  })
})

describe("suggestNegatives: dictionaries", () => {
  const analysis = suggestNegatives([
    t("praca w sklepie obuwniczym"),
    t("sklep obuwniczy pracy"),
    t("buty za darmo"),
    t("darmowe buty"),
    t("buty używane olx"),
    t("naprawa butów warszawa"),
    t("jak wyczyścić buty zamszowe"),
    t("buty do biegania damskie"),
  ])

  it.each([
    ["praca", "jobs"],
    ["za darmo", "free"],
    ["darmowe", "free"],
    ["używane", "used"],
    ["olx", "used"],
    ["naprawa", "repair"],
    ["jak", "howto"],
  ])("suggests %j as %s", (form, category) => {
    expect(byForm(analysis, form)?.category).toBe(category)
  })

  it("groups inflected forms into one suggestion and keeps every form", () => {
    const jobs = byForm(analysis, "praca")!
    expect(jobs.forms).toEqual(["praca", "pracy"])
    expect(jobs.termIndexes).toEqual([0, 1])
  })

  it("keeps diacritics in the suggested form", () => {
    expect(byForm(analysis, "używane")).toBeDefined()
  })

  it("leaves clean terms alone", () => {
    expect(analysis.stats.matchedTerms).toBe(7)
    expect(analysis.stats.uniqueTerms).toBe(8)
  })
})

describe("suggestNegatives: user lists", () => {
  it("never suggests offer words, even when a dictionary matches", () => {
    const analysis = suggestNegatives([t("naprawa butów"), t("serwis butów kraków")], {
      offerWords: ["naprawa", "serwis"],
    })
    expect(analysis.suggestions.filter((s) => s.category === "repair")).toEqual([])
  })

  it("matches competitors and custom words as whole phrases, diacritics-insensitive", () => {
    const analysis = suggestNegatives(
      [
        t("buty ccc promocja"),
        t("buty deichmann"),
        t("buty hurtownia"),
        t("cccp historia"),
      ],
      { competitors: ["CCC", "Deichmann"], customWords: ["hurtownia"] }
    )
    expect(byForm(analysis, "ccc")?.category).toBe("competitor")
    expect(byForm(analysis, "ccc")?.termIndexes).toEqual([0])
    expect(byForm(analysis, "deichmann")?.category).toBe("competitor")
    expect(byForm(analysis, "hurtownia")?.category).toBe("custom")
  })

  it("suggests unrelated words only from terms without offer words", () => {
    const analysis = suggestNegatives(
      [
        t("buty damskie"),
        t("kurtka damska zimowa"),
        t("buty zimowe"),
        t("plecak szkolny"),
      ],
      { offerWords: ["buty"] }
    )
    const unrelated = analysis.suggestions
      .filter((s) => s.category === "unrelated")
      .map((s) => s.forms[0])
    expect(unrelated.sort()).toEqual(["kurtka", "plecak", "szkolny"])
    // "damska" and "zimowa" also appear in related terms, so they are not suggested.
  })

  it("recognises inflected offer words in search terms", () => {
    const analysis = suggestNegatives(
      [t("praca w sklepie obuwniczym"), t("kurtka zimowa")],
      {
        offerWords: ["obuwniczy"],
      }
    )
    const unrelated = analysis.suggestions.filter((s) => s.category === "unrelated")
    expect(unrelated.flatMap((s) => s.forms).sort()).toEqual(["kurtka", "zimowa"])
  })

  it("does not suggest unrelated words without an offer list", () => {
    const analysis = suggestNegatives([t("kurtka zimowa")])
    expect(analysis.suggestions).toEqual([])
  })
})

describe("suggestNegatives: metrics", () => {
  it("sums cost and conversions per suggestion and sorts by cost", () => {
    const analysis = suggestNegatives([
      t("praca kierowca", 10, 0),
      t("buty za darmo", 25, 0),
      t("pracy szukam", 5, 1),
    ])
    expect(analysis.stats.hasMetrics).toBe(true)
    expect(analysis.suggestions[0].category).toBe("free")
    const jobs = byForm(analysis, "praca")!
    expect(jobs.cost).toBe(15)
    expect(jobs.conversions).toBe(1)
  })
})

describe("buildNegativeList", () => {
  const analysis = suggestNegatives([
    t("praca w sklepie"),
    t("pracy szukam od zaraz"),
    t("buty za darmo"),
    t("jak (wyczyścić) buty"),
  ])
  const idOf = (form: string) => byForm(analysis, form)!.id
  const accept = (ids: string[], matchType: SuggestionDecision["matchType"] = null) =>
    Object.fromEntries(ids.map((id) => [id, { status: "accepted" as const, matchType }]))

  it("exports nothing until the user accepts something", () => {
    expect(buildNegativeList(analysis, {}, "broad").entries).toEqual([])
    const pendingAndRejected = {
      [idOf("praca")]: { status: "pending" as const, matchType: null },
      [idOf("za darmo")]: { status: "rejected" as const, matchType: null },
    }
    expect(buildNegativeList(analysis, pendingAndRejected, "broad").entries).toEqual([])
  })

  it("exports every word form for broad and phrase match", () => {
    const list = buildNegativeList(analysis, accept([idOf("praca")]), "phrase")
    expect(list.entries.map((e) => e.formatted)).toEqual(['"praca"', '"pracy"'])
  })

  it("exports whole search terms for exact match", () => {
    const list = buildNegativeList(analysis, accept([idOf("praca")], "exact"), "broad")
    expect(list.entries.map((e) => e.formatted)).toEqual([
      "[praca w sklepie]",
      "[pracy szukam od zaraz]",
    ])
  })

  it("leaves out entries Google Ads would reject and says why", () => {
    const list = buildNegativeList(analysis, accept([idOf("jak")], "exact"), "broad")
    expect(list.entries).toEqual([])
    expect(list.rejected[0].reason).toContain("niedozwolone")

    const long = suggestNegatives([t("praca " + "słowo ".repeat(12))])
    const longList = buildNegativeList(
      long,
      accept([long.suggestions[0].id], "exact"),
      "broad"
    )
    expect(longList.rejected[0].reason).toContain("10 słów")
  })

  it("removes duplicates across suggestions", () => {
    const overlap = suggestNegatives([t("buty za darmo")], { customWords: ["za darmo"] })
    const list = buildNegativeList(
      overlap,
      accept(overlap.suggestions.map((s) => s.id)),
      "broad"
    )
    expect(list.entries.map((e) => e.formatted)).toEqual(["za darmo"])
    expect(list.duplicatesRemoved).toBe(1)
  })

  it("formats match types the way Google Ads expects", () => {
    expect(formatNegative("praca", "broad")).toBe("praca")
    expect(formatNegative("praca", "phrase")).toBe('"praca"')
    expect(formatNegative("praca", "exact")).toBe("[praca]")
  })
})

describe("negative keyword export", () => {
  it("exports only accepted entries with context", async () => {
    const { negativeCsvRows, negativePlainList } =
      await import("@/lib/export/negative-keywords")
    const analysis = suggestNegatives([
      t("praca kierowca", 4, 0),
      t("buty za darmo", 2, 0),
    ])
    const jobs = analysis.suggestions.find((s) => s.category === "jobs")!
    const list = buildNegativeList(
      analysis,
      { [jobs.id]: { status: "accepted", matchType: "phrase" } },
      "broad"
    )
    expect(negativePlainList(list)).toBe('"praca"')
    expect(negativeCsvRows(list, analysis)[1]).toEqual([
      "praca",
      '"praca"',
      "Do wyrażenia",
      "Praca i zatrudnienie",
      1,
      4,
      0,
    ])
  })
})
