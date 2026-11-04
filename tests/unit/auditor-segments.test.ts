import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { runAudit } from "@/lib/auditor/audit"
import { analyzeReport } from "@/lib/auditor/import"
import { classifyTerm, intentContext } from "@/lib/auditor/intent"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport, type NormalizedReport } from "@/lib/auditor/normalize"
import { parseSheet } from "@/lib/auditor/parse"

const FIXTURES = join(__dirname, "../fixtures/auditor")
async function report(name: string): Promise<NormalizedReport> {
  const table = await parseSheet(new Uint8Array(readFileSync(join(FIXTURES, name))))
  return normalizeReport(
    name,
    name,
    table,
    analyzeReport(table, { fileName: name }),
    false
  )
}
const OFFER = intentContext("buty, obuwie, nike, asics", "biegam", "decathlon")
const audit = async (names: string[], intent = OFFER) =>
  runAudit(
    buildDataset(await Promise.all(names.map(report))),
    { cpa: null, roas: null },
    intent
  )
const rules = (r: Awaited<ReturnType<typeof audit>>, prefix: string) =>
  r.findings.filter((f) => f.rule.startsWith(prefix))

describe("search term intent (heuristic)", () => {
  it.each([
    ["buty do biegania cena", "purchase", null],
    ["kup buty nike", "purchase", null],
    ["opinie buty asics", "commercial", null],
    ["buty do biegania damskie", "commercial", null],
    ["jak wyczyścić buty zamszowe", "informational", "howto"],
    ["praca sklep obuwniczy", "unrelated", "jobs"],
    ["buty za darmo", "uncertain", "free"],
    ["biegam pl", "navigational", null],
    ["decathlon buty", "navigational", null],
    ["kurtka zimowa damska", "unrelated", null],
    ["buty używane olx", "navigational", "used"],
  ])("%s → %s", (term, intent, unwanted) => {
    const r = classifyTerm(term, OFFER)
    expect(r.intent).toBe(intent)
    expect(r.unwanted).toBe(unwanted)
  })

  it("offer words win over dictionaries", () => {
    const repairShop = intentContext("naprawa, serwis, buty", "", "")
    expect(classifyTerm("naprawa butów kraków", repairShop).unwanted).toBeNull()
  })

  it("without offer words nothing is called unrelated", () => {
    expect(classifyTerm("kurtka zimowa", intentContext("", "", "")).intent).toBe(
      "uncertain"
    )
  })
})

/*
 * hasla-audyt.csv, by hand: clicks 1589, cost 1635,70, conversions 57 → conversion rate
 * 3,587%, CPA 28,70; zero conversions means something from 83 clicks
 * (ln 0,05 ÷ ln(1 − 0,035872) = 82,004, rounded up).
 */
describe("search terms", () => {
  it("suggests: exclude only with enough clicks, watch for small samples, add good terms", async () => {
    const r = await audit(["hasla-audyt.csv"])
    const s = r.searchTerms!
    expect(s.minClicks).toBe(83)
    const by = (t: string) => s.rows.find((x) => x.term === t)!
    expect(by("buty sportowe tanie").suggestion).toBe("exclude")
    expect(by("praca sklep obuwniczy").suggestion).toBe("watch")
    expect(by("praca sklep obuwniczy").reason).toContain(
      "za mało, by zalecić wykluczenie"
    )
    expect(by("buty używane olx").suggestion).toBe("watch")
    expect(by("nike pegasus 41 rozmiar 42").suggestion).toBe("add")
    expect(by("buty do biegania damskie cena").suggestion).toBe("add")
    // Already a keyword: not suggested again.
    expect(by("buty do biegania").suggestion).toBeNull()
    expect(by("buty do biegania").isKeyword).toBe(true)
  })

  it("findings: unwanted categories, unrelated, costly term, new keywords", async () => {
    const r = await audit(["hasla-audyt.csv"])
    const s1 = rules(r, "S1")
      .map((f) => f.title)
      .sort()
    expect(s1).toEqual([
      "Zapytania o „darmowe” bez konwersji",
      "Zapytania o „instrukcje i poradniki” bez konwersji",
      "Zapytania o „praca” bez konwersji",
      "Zapytania o „używane” bez konwersji",
    ])
    expect(rules(r, "S1").find((f) => f.title.includes("praca"))!.subject).toBe("2 haseł")
    expect(rules(r, "S3").map((f) => f.evidence[0].label)).toEqual([
      "kurtka zimowa damska",
    ])
    const [s4] = rules(r, "S4")
    expect(rules(r, "S4")).toHaveLength(1)
    expect(s4.subject).toBe("buty sportowe tanie")
    expect(s4.severity).toBe("high")
    expect(rules(r, "S5")[0].subject).toBe("2 haseł")
  })

  it("asks for offer words instead of guessing unrelated terms", async () => {
    const r = await audit(["hasla-audyt.csv"], intentContext("", "", ""))
    expect(rules(r, "S3")).toEqual([])
    expect(r.notes.join(" ")).toContain("Podaj słowa opisujące ofertę")
  })
})

describe("devices", () => {
  it("mobile with high CPA, desktop with the most value, tablet too small", async () => {
    const r = await audit(["urzadzenia-audyt.csv"])
    const [d1] = rules(r, "D1")
    expect(d1.subject).toBe("Telefony")
    expect(d1.severity).toBe("high")
    expect(d1.action).toContain("aplikacja niczego nie zmienia")
    const [d3] = rules(r, "D3")
    expect(d3.subject).toBe("Komputery")
    expect(d3.kind).toBe("opportunity")
    expect(rules(r, "D0")[0].subject).toBe("Tablety")
    expect(r.devices!.segments.map((s) => s.label)).toEqual([
      "Telefony",
      "Komputery",
      "Tablety",
    ])
  })
})

describe("locations", () => {
  it("Kraków expensive, Warszawa dominant and valuable, Opole too small", async () => {
    const r = await audit(["lokalizacje-audyt.csv"])
    expect(rules(r, "L1").map((f) => f.subject)).toEqual(["Kraków"])
    expect(rules(r, "L1")[0].severity).toBe("medium")
    expect(rules(r, "L3")[0].subject).toBe("Warszawa")
    expect(rules(r, "L4")[0].subject).toBe("Warszawa")
    expect(rules(r, "L0")[0].subject).toBe("Opole")
  })
})

describe("hours and days", () => {
  it("nights worst, evenings best; equal weekdays give no finding", async () => {
    const r = await audit(["godziny-audyt.csv"])
    const s = r.schedule!
    expect(s.weeks).toBe(4)
    expect(s.days).toHaveLength(7)
    expect(s.hours).toHaveLength(24)
    const [worst] = r.findings.filter((f) => f.id === "schedule:worst:Godzina")
    expect(worst.subject).toBe("0:00–0:59, 1:00–1:59, 2:00–2:59")
    const [best] = r.findings.filter((f) => f.id === "schedule:best:Godzina")
    expect(best.subject).toBe("18:00–18:59, 19:00–19:59, 20:00–20:59")
    expect(r.findings.some((f) => f.id.includes("Dzień tygodnia"))).toBe(false)
    expect(r.notes.join(" ")).not.toContain("wstępne")
  })

  it("a short period makes conclusions preliminary", async () => {
    const r = await audit(["godziny-srednik.csv"])
    expect(r.notes.join(" ")).toContain("wstępne")
  })
})

describe("search term decisions", () => {
  it("only marked terms reach the exports, in Google Ads syntax", async () => {
    const { decisionsCsv, listFor, plainList } =
      await import("@/lib/auditor/term-decisions")
    const r = await audit(["hasla-audyt.csv"])
    const rows = r.searchTerms!.rows
    const key = (t: string) => rows.find((x) => x.term === t)!.key
    const decisions = {
      [key("buty sportowe tanie")]: {
        decision: "exclude" as const,
        match: "exact" as const,
      },
      [key("praca sklep obuwniczy")]: {
        decision: "exclude" as const,
        match: "phrase" as const,
      },
      [key("nike pegasus 41 rozmiar 42")]: {
        decision: "add" as const,
        match: "exact" as const,
      },
      [key("buty do biegania")]: {
        decision: "relevant" as const,
        match: "exact" as const,
      },
    }
    const exclusions = listFor(rows, decisions, "exclude")
    expect(plainList(exclusions)).toBe('[buty sportowe tanie]\r\n"praca sklep obuwniczy"')
    expect(plainList(listFor(rows, decisions, "add"))).toBe(
      "[nike pegasus 41 rozmiar 42]"
    )
    const csv = decisionsCsv(exclusions, "Wykluczenie")
    expect(csv).toContain("buty sportowe tanie;Ścisłe;[buty sportowe tanie]")
    // Nothing is suggested into the list without a decision.
    expect(listFor(rows, {}, "exclude")).toEqual([])
  })
})
