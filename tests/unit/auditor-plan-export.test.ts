import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildActionPlan } from "@/lib/auditor/action-plan"
import { runAudit } from "@/lib/auditor/audit"
import { campaignsCsv, findingsCsv, planCsv } from "@/lib/auditor/export"
import { analyzeReport } from "@/lib/auditor/import"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport, type NormalizedReport } from "@/lib/auditor/normalize"
import { parseSheet } from "@/lib/auditor/parse"
import { availableSections } from "@/lib/pdf/audit-report"

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
async function setup(...names: string[]) {
  const data = buildDataset(await Promise.all(names.map(report)))
  const result = runAudit(data, { cpa: null, roas: null })
  const money = (v: number) => `${v} zł`
  return { data, result, tasks: buildActionPlan(result.findings, money) }
}

describe("action plan", () => {
  it("one task per kind of work, highest priority first, monitoring last", async () => {
    const { tasks } = await setup("kampanie-audyt.csv", "slowa-kluczowe-audyt.csv")
    expect(tasks[0]).toMatchObject({
      title: "Przeanalizować kampanie z wysokim kosztem i małą liczbą konwersji",
      priority: "Wysoki",
      subjects: ["Kurtki – Search"],
    })
    expect(tasks.at(-1)!.title).toBe("Wrócić do elementów z małą ilością danych")
    // A8, B4 and B8 opportunities share one task.
    const scale = tasks.find((t) => t.id === "scale")!
    expect(scale.subjects).toContain("Brand – Search")
    expect(scale.subjects).toContain("nike pegasus 41 [ścisłe]")
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length)
    for (const t of tasks) expect(t.justification).toMatch(/wykry(cie|ć).*łączny koszt/)
  })
})

describe("CSV exports", () => {
  it("findings, plan with statuses and campaign data, formula-safe", async () => {
    const { data, result, tasks } = await setup(
      "kampanie-audyt.csv",
      "slowa-kluczowe-audyt.csv"
    )
    const findings = findingsCsv(result.findings)
    expect(findings.split("\r\n")[0]).toContain("Grupa;Obszar;Problem;Dotyczy;Ważność")
    expect(findings).toContain(
      "Problemy wymagające natychmiastowej uwagi;Kampanie;Wysoki koszt przy małej liczbie konwersji;Kurtki – Search;Wysoki"
    )
    const plan = planCsv(tasks, { [tasks[0].id]: "done" })
    expect(plan.split("\r\n")[1]).toMatch(/;Zrobione$/)
    expect(plan.split("\r\n")[2]).toMatch(/;Do zrobienia$/)
    const campaigns = campaignsCsv(data)
    expect(campaigns).toContain(
      "Kurtki – Search;2222;Sieć wyszukiwania;40000;2500;5000;25;5000"
    )
    // Evidence values like "-5" or "=x" would be guarded; minus-signed numbers stay numbers.
    expect(findings.includes(";=")).toBe(false)
  })
})

describe("PDF sections", () => {
  it("leaves out sections without data", async () => {
    const campaignsOnly = await setup("kampanie-audyt.csv")
    expect(availableSections(campaignsOnly)).toEqual([
      "summary",
      "kpis",
      "index",
      "campaigns",
      "problems",
      "recommendations",
      "plan",
      "scope",
    ])
    const full = await setup(
      "kampanie-audyt.csv",
      "slowa-kluczowe-audyt.csv",
      "hasla-audyt.csv",
      "urzadzenia-audyt.csv",
      "lokalizacje-audyt.csv",
      "godziny-audyt.csv"
    )
    expect(availableSections(full)).toHaveLength(13)
  })
})
