import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { runAudit, type AuditTargets } from "@/lib/auditor/audit"
import { analyzeReport } from "@/lib/auditor/import"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport, type NormalizedReport } from "@/lib/auditor/normalize"
import { parseSheet } from "@/lib/auditor/parse"
import { binomialCdf, clicksToJudge, median, pHigher, pLower } from "@/lib/auditor/stats"

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
const audit = async (
  names: string[],
  targets: AuditTargets = { cpa: null, roas: null }
) => runAudit(buildDataset(await Promise.all(names.map(report))), targets)
const by = (r: Awaited<ReturnType<typeof audit>>, rule: string) =>
  r.findings.filter((f) => f.rule === rule)

describe("sample statistics", () => {
  it("binomial CDF matches hand values", () => {
    // P(X ≤ 0 | n = 10, p = 0,1) = 0,9^10
    expect(binomialCdf(0, 10, 0.1)).toBeCloseTo(0.9 ** 10, 10)
    // P(X ≤ 1 | 3, 0,5) = (1 + 3) / 8
    expect(binomialCdf(1, 3, 0.5)).toBeCloseTo(0.5, 10)
    expect(binomialCdf(5, 5, 0.3)).toBe(1)
    expect(pLower(0, 100, 0.03)).toBeCloseTo(0.97 ** 100, 10)
    expect(pHigher(3, 3, 0.5)).toBeCloseTo(0.125, 10)
  })

  it("clicks needed before zero conversions means something", () => {
    expect(clicksToJudge(0.03)).toBe(99)
    expect(clicksToJudge(0.01)).toBe(299)
    expect(clicksToJudge(0)).toBe(Infinity)
  })

  it("median", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

/*
 * kampanie-audyt.csv, by hand: clicks 8062, cost 10 558 zł, conversions 317, value 57 500 zł
 * → conversion rate 3,93%, CPA 33,31 zł, ROAS 544,6%.
 */
describe("campaign rules on kampanie-audyt.csv", () => {
  it("A1: 47% of cost and 8% of conversions, high severity, with an estimate", async () => {
    const r = await audit(["kampanie-audyt.csv"])
    const [a1] = by(r, "A1")
    expect(by(r, "A1")).toHaveLength(1)
    expect(a1.subject).toBe("Kurtki – Search")
    expect(a1.severity).toBe("high")
    expect(a1.confidence).toBe("high")
    expect(a1.situation).toBe(
      "Kampania odpowiada za 47% kosztu konta, ale tylko za 8% konwersji."
    )
    // 5000 zł at the account CPA (10 558 / 317) ≈ 150,1 conversions.
    expect(a1.impact).toContain("ok. 150,1 konwersji zamiast 25")
    expect(a1.source).toMatchObject({
      report: "kampanie-audyt.csv",
      dimension: "Kampania",
    })
    expect(a1.source.period).toBe("1 października 2026 – 31 października 2026")
  })

  it("A3: low ROAS only where cost is material and no other rule fired", async () => {
    const r = await audit(["kampanie-audyt.csv"])
    expect(by(r, "A3").map((f) => f.subject)).toEqual(["Remarketing – Display"])
    expect(by(r, "A3")[0].evidence.find((e) => e.label === "ROAS")!.value).toBe(
      "150% (konto: 545%)"
    )
  })

  it("A6: low CTR compared within the same campaign type only", async () => {
    const r = await audit(["kampanie-audyt.csv"])
    // Display's 0,2% CTR is not compared with Search; Skarpety's 0,3% is.
    expect(by(r, "A6").map((f) => f.subject)).toEqual(["Skarpety – Search"])
  })

  it("A8: strong performers; A10: too little data; no false alarms", async () => {
    const r = await audit(["kampanie-audyt.csv"])
    expect(
      by(r, "A8")
        .map((f) => f.subject)
        .sort()
    ).toEqual(["Brand – Search", "Buty – Search"])
    expect(by(r, "A8")[0].kind).toBe("opportunity")
    expect(by(r, "A10")[0].subject).toBe("Akcesoria – Search")
    // Skarpety: CPA 50 zł is ~1,5× the account, but 6 conversions in 150 clicks is not
    // enough to call it a problem.
    expect(by(r, "A2")).toEqual([])
    expect(r.findings.some((f) => f.severity === "critical")).toBe(false)
  })

  it("targets replace the account benchmark", async () => {
    const r = await audit(["kampanie-audyt.csv"], { cpa: 15, roas: null })
    // With a 15 zł CPA goal, Buty (CPA 20) is no longer a strong performer.
    expect(by(r, "A8").map((f) => f.subject)).toEqual(["Brand – Search"])
    const withRoas = await audit(["kampanie-audyt.csv"], { cpa: null, roas: 1200 })
    expect(by(withRoas, "A3").map((f) => f.subject)).toContain("Remarketing – Display")
  })

  it("is deterministic", async () => {
    const a = await audit(["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
    const b = await audit(["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
    expect(a).toEqual(b)
  })
})

/*
 * slowa-kluczowe-audyt.csv, by hand: clicks 4652, cost 6983, conversions 135
 * → conversion rate 2,90%, CPA 51,73; zero conversions is meaningful from 102 clicks.
 */
describe("keyword rules on slowa-kluczowe-audyt.csv", () => {
  it("B1: 900 clicks without conversions; B0: 2 clicks are only listed", async () => {
    const r = await audit(["slowa-kluczowe-audyt.csv"])
    const [b1] = by(r, "B1")
    expect(by(r, "B1")).toHaveLength(1)
    expect(b1.subject).toBe("buty sportowe [przybliżone]")
    expect(b1.severity).toBe("high")
    expect(b1.action).toContain("węższe dopasowanie")
    expect(b1.source.method).toContain("102")
    const [b0] = by(r, "B0")
    expect(b0.evidence.map((e) => e.label)).toContain(
      "skarpety do biegania [przybliżone]"
    )
    expect(b0.action).toContain("Nie wykluczaj")
  })

  it("B2: very high CPA with an estimate", async () => {
    const r = await audit(["slowa-kluczowe-audyt.csv"])
    expect(by(r, "B2").map((f) => f.subject)).toEqual(["kurtka zimowa [do wyrażenia]"])
    expect(by(r, "B2")[0].severity).toBe("high")
  })

  it("B4 high CTR and conversion, B5 very low CTR, B6 overlap, B8 budget candidates", async () => {
    const r = await audit(["slowa-kluczowe-audyt.csv"])
    expect(by(r, "B4").map((f) => f.subject)).toEqual(["nike pegasus 41 [ścisłe]"])
    expect(by(r, "B5").map((f) => f.subject)).toEqual(["buty [przybliżone]"])
    expect(by(r, "B6").map((f) => f.subject)).toEqual(["buty do biegania"])
    expect(by(r, "B6")[0].evidence).toHaveLength(2)
    expect(
      by(r, "B8")
        .map((f) => f.subject)
        .sort()
    ).toEqual(["buty do biegania [do wyrażenia]", "buty do biegania [ścisłe]"])
    // "buty": CPA 150 is high, but 2 conversions in 200 clicks is not significant.
    expect(by(r, "B2").some((f) => f.subject.startsWith("buty ["))).toBe(false)
  })

  it("every finding has the required fields", async () => {
    const r = await audit(["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
    expect(r.findings.length).toBeGreaterThan(8)
    for (const f of r.findings) {
      expect(f.title && f.situation && f.cause && f.action).toBeTruthy()
      expect(f.evidence.length).toBeGreaterThan(0)
      expect(f.source.report).toBeTruthy()
      expect(f.source.method).toBeTruthy()
    }
    // Sorted: problems of higher severity first.
    expect(r.findings[0].severity).toBe("high")
  })

  it("explains what cannot be assessed instead of inventing it", async () => {
    const r = await audit(["kampanie-audyt.csv"])
    expect(r.notes).toContain(
      "Analiza słów kluczowych wymaga raportu słów kluczowych z kosztem."
    )
  })
})
