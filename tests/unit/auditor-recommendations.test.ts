import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { runAudit } from "@/lib/auditor/audit"
import { analyzeReport } from "@/lib/auditor/import"
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
const audit = async (...names: string[]) =>
  runAudit(buildDataset(await Promise.all(names.map(report))), { cpa: null, roas: null })

describe("recommendations", () => {
  it("seven groups in the spec order; high-severity problems are urgent", async () => {
    const r = await audit("kampanie-audyt.csv", "slowa-kluczowe-audyt.csv")
    const groups = Object.fromEntries(
      r.recommendations.map((g) => [g.id, g.items.map((i) => i.problem)])
    )
    expect(r.recommendations.map((g) => g.id)).toEqual([
      "urgent",
      "conversion",
      "value",
      "exclusions",
      "monitor",
    ])
    expect(groups.urgent.sort()).toEqual(
      [
        "Bardzo wysoki CPA słowa kluczowego: kurtka zimowa [do wyrażenia]",
        "Niski ROAS: Remarketing – Display",
        "Słowo kluczowe z kosztem bez konwersji: buty sportowe [przybliżone]",
        "Wysoki koszt przy małej liczbie konwersji: Kurtki – Search",
      ].sort()
    )
    expect(groups.exclusions).toEqual([
      "To samo słowo kluczowe w kilku grupach reklam: buty do biegania",
    ])
    expect(groups.value).toHaveLength(5)
    expect(groups.monitor).toHaveLength(2)
  })

  it("each recommendation: problem, evidence, interpretation, action, priority, confidence", async () => {
    const r = await audit("kampanie-audyt.csv")
    const rec = r.recommendations[0].items[0]
    expect(rec.problem).toBe("Wysoki koszt przy małej liczbie konwersji: Kurtki – Search")
    expect(rec.evidence.length).toBeGreaterThan(2)
    expect(rec.interpretation).toContain("Kampania odpowiada za 47% kosztu konta")
    expect(rec.interpretation).toContain("Możliwe przyczyny")
    expect(rec.action).toContain("Ograniczenie budżetu rozważ dopiero po tej weryfikacji")
    expect(rec.priority).toBe("Wysoki")
    expect(rec.confidenceLabel).toBe("Wysoka")
  })
})

describe("efficiency index", () => {
  /*
   * By hand: campaigns with problems Kurtki 5000 + Display 1600 + Skarpety 300 = 6900 of
   * 10 558 → 35. Keywords: 1080 + 3000 + 300 + 1350 = 5730 of 6983 → 18. Cost control:
   * 1080 zł without conversions of 10 558 → 90. Overall (35 + 18 + 90) / 3 = 47,7 → 48.
   */
  it("scores assessed areas only and shows completeness", async () => {
    const { index } = await audit("kampanie-audyt.csv", "slowa-kluczowe-audyt.csv")
    const score = Object.fromEntries(index.areas.map((a) => [a.area, a.score]))
    expect(score).toEqual({
      campaigns: 35,
      keywords: 18,
      traffic: null,
      devices: null,
      locations: null,
      ads: null,
      costControl: 90,
    })
    expect(index.overall).toBe(48)
    expect(index.assessed).toBe(3)
    expect(index.completeness).toBeCloseTo(3 / 7)
    expect(index.areas.find((a) => a.area === "devices")!.basis).toBe(
      "Brak raportu urządzeń z konwersjami."
    )
    expect(index.areas.find((a) => a.area === "costControl")!.basis).toContain(
      "10% kosztu konta"
    )
  })

  it("missing data is not counted as a bad score", async () => {
    // A device report alone also serves as the totals report (it has a campaign column).
    const { index } = await audit("urzadzenia-audyt.csv")
    expect(index.areas.filter((a) => a.score !== null).map((a) => a.area)).toEqual([
      "campaigns",
      "devices",
    ])
    const scores = index.areas.filter((a) => a.score !== null).map((a) => a.score!)
    expect(index.overall).toBe(Math.round((scores[0] + scores[1]) / 2))
    const { index: none } = await audit("konwersje.csv")
    expect(none.overall).toBeNull()
    expect(none.assessed).toBe(0)
  })

  it("ads: a poor-rated ad lowers the ads score", async () => {
    const r = await audit("reklamy-en.xlsx")
    expect(r.findings.filter((f) => f.rule === "G1").map((f) => f.subject)).toEqual([
      "1 reklama",
    ])
    // 910 of 2410 spent on the poor ad → 62.
    expect(r.index.areas.find((a) => a.area === "ads")!.score).toBe(62)
    expect(r.notes.join(" ")).toContain(
      "nie oceniamy skuteczności pojedynczych nagłówków"
    )
  })
})
