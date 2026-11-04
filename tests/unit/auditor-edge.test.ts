import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { runAudit } from "@/lib/auditor/audit"
import { buildDashboard, NO_FILTERS } from "@/lib/auditor/dashboard"
import { analyzeReport } from "@/lib/auditor/import"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport } from "@/lib/auditor/normalize"
import { declaredZipSize, ImportError, parseSheet } from "@/lib/auditor/parse"
import { crossFileNotes } from "@/lib/auditor/summary"

const FIXTURES = join(__dirname, "../fixtures/auditor")
const file = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)))
const csv = (text: string) => new TextEncoder().encode(text)

async function pipeline(bytes: Uint8Array, name = "raport.csv") {
  const table = await parseSheet(bytes)
  const analysis = analyzeReport(table, { fileName: name })
  const data = buildDataset([normalizeReport(name, name, table, analysis, false)])
  return { analysis, data, result: runAudit(data, { cpa: null, roas: null }) }
}

describe("security", () => {
  it("rejects an XLSX that would expand far beyond any real export (zip bomb)", async () => {
    expect(declaredZipSize(file("bomba.xlsx"))).toBe(420 * 1024 * 1024)
    await expect(parseSheet(file("bomba.xlsx"))).rejects.toThrow("400 MB")
    await expect(parseSheet(file("bomba.xlsx"))).rejects.toBeInstanceOf(ImportError)
  })

  it("reads the declared size of real exports", () => {
    const size = declaredZipSize(file("urzadzenia.xlsx"))!
    expect(size).toBeGreaterThan(1000)
    expect(size).toBeLessThan(100_000)
  })

  it("a damaged ZIP is refused before parsing", async () => {
    const broken = file("urzadzenia.xlsx").slice(0, 2000)
    await expect(parseSheet(broken)).rejects.toThrow("nieprawidłową strukturę")
  })

  it("cell text that looks like a formula stays plain data", async () => {
    const { data } = await pipeline(
      csv('Kampania,Kliknięcia,Koszt\n"=HYPERLINK(""http://x"")",10,"5,00"')
    )
    expect(data.campaigns[0].name).toBe('=HYPERLINK("http://x")')
  })
})

describe("edge values", () => {
  it("zeros: no division by zero, N/D with a reason", async () => {
    const { data } = await pipeline(
      csv("Kampania,Wyśw.,Kliknięcia,Koszt,Konwersje\nA,0,0,0,0")
    )
    const m = buildDashboard(data, NO_FILTERS)
    expect(m.kpis.ctr).toEqual({ ok: false, reason: "Brak wyświetleń." })
    expect(m.kpis.cpc).toEqual({ ok: false, reason: "Brak kliknięć." })
    expect(m.kpis.cpa).toEqual({ ok: false, reason: "Brak konwersji." })
  })

  it("empty and '--' cells count as zero; a negative cost adjustment is summed", async () => {
    const { data } = await pipeline(
      csv(
        'Kampania,Kliknięcia,Koszt,Konwersje\nA,10,"100,00",--\nA,,"-20,00",\nB,5,"50,00",1'
      )
    )
    expect(data.totals).toMatchObject({ clicks: 15, cost: 130, conversions: 1 })
  })

  it("different date ranges in one audit are flagged", async () => {
    const a = await pipeline(file("kampanie-audyt.csv"))
    const b = await pipeline(file("kampanie-wrzesien.csv"))
    const notes = crossFileNotes([
      { name: "paz", analysis: a.analysis },
      { name: "wrz", analysis: b.analysis },
    ])
    expect(notes.map((n) => n.message).join(" ")).toContain("różne okresy")
  })
})

describe("large reports", () => {
  it("50 000 search terms: whole pipeline in reasonable time, totals exact", async () => {
    const lines = ["Wyszukiwane hasło,Kampania,Kliknięcia,Koszt,Konwersje"]
    for (let i = 0; i < 50_000; i++)
      lines.push(
        `fraza ${i} buty,Buty – Search,${i % 20},"${i % 20},00",${i % 9 === 0 ? 1 : 0}`
      )
    const start = performance.now()
    const { data, result } = await pipeline(csv(lines.join("\n")), "hasla.csv")
    const ms = performance.now() - start
    // Σ(i mod 20) over 50 000 rows = 2500 full cycles × 190.
    expect(data.totals.clicks).toBe(2500 * 190)
    expect(data.totals.cost).toBe(2500 * 190)
    expect(data.totals.conversions).toBe(Math.ceil(50_000 / 9))
    expect(result.searchTerms!.rows).toHaveLength(50_000)
    expect(ms).toBeLessThan(20_000)
  }, 60_000)
})
