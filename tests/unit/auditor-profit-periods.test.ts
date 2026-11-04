import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeReport } from "@/lib/auditor/import"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport, type NormalizedReport } from "@/lib/auditor/normalize"
import { parseSheet } from "@/lib/auditor/parse"
import { compare, comparisonOptions } from "@/lib/auditor/periods"
import {
  NO_PROFIT_INPUTS,
  profitModel,
  type ProfitInputs,
} from "@/lib/auditor/profitability"

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
const dataset = async (...names: string[]) =>
  buildDataset(await Promise.all(names.map(report)))
const line = (m: ReturnType<typeof profitModel>, label: string) =>
  m.lines.find((l) => l.label === label)!
const v = (m: ReturnType<typeof profitModel>, label: string) => {
  const r = line(m, label).value
  if (!r.ok) throw new Error(`${label}: ${r.reason}`)
  return r.value
}
const inputs = (p: Partial<ProfitInputs>): ProfitInputs => ({ ...NO_PROFIT_INPUTS, ...p })

/*
 * kampanie-audyt.csv: cost 10 558, conversions 317, conversion value 57 500. With a 40% margin
 * and 10 zł delivery per order: contribution 23 000 − 3170 = 19 830; profit 9272;
 * break-even ROAS 100 ÷ (19 830 ÷ 57 500) = 289,96%; max CPA 19 830 ÷ 317 = 62,56.
 */
describe("profitability", () => {
  it("margin path: every value hand-checked, origins labelled", async () => {
    const m = profitModel(
      await dataset("kampanie-audyt.csv"),
      inputs({ marginPct: 40, shippingCost: 10, targetProfit: 15000 })
    )
    expect(m.ready).toBe(true)
    expect(v(m, "Koszt reklamy")).toBe(10558)
    expect(v(m, "Przychód (wartość konwersji)")).toBe(57500)
    expect(v(m, "Szacowana marża po kosztach zmiennych")).toBeCloseTo(19830)
    expect(v(m, "Szacowany zysk po reklamie")).toBeCloseTo(9272)
    expect(v(m, "Break-even ROAS")).toBeCloseTo(289.96, 1)
    expect(v(m, "Maksymalny opłacalny CPA")).toBeCloseTo(62.555, 2)
    expect(v(m, "Szacowana rentowność")).toBeCloseTo(16.125, 2)
    // (10 558 + 15 000) ÷ 10 558 ÷ 0,34487 = 701,9%
    expect(v(m, "ROAS potrzebny do docelowego zysku")).toBeCloseTo(701.9, 0)
    expect(line(m, "Koszt reklamy").origin).toBe("google")
    expect(line(m, "Szacowany zysk po reklamie").origin).toBe("estimate")
    // Per campaign, same assumptions: Buty 30 000 × 40% − 150 × 10 − 3000 = 7500.
    const buty = m.campaigns.find((c) => c.name === "Buty – Search")!
    expect(buty.profit.ok && buty.profit.value).toBeCloseTo(7500)
  })

  it("no margin, no profit: the reason instead of a number", async () => {
    const m = profitModel(await dataset("kampanie-audyt.csv"), NO_PROFIT_INPUTS)
    expect(m.ready).toBe(false)
    expect(line(m, "Szacowany zysk po reklamie").value).toEqual({
      ok: false,
      reason: "Wpisz marżę albo koszt produktu, aby oszacować zysk.",
    })
    expect(m.missing).toEqual(["Wpisz marżę albo koszt produktu, aby oszacować zysk."])
    // Google Ads data is still shown.
    expect(v(m, "ROAS")).toBeCloseTo(544.6, 1)
  })

  it("without conversion value the revenue is an estimate from the order value", async () => {
    // lokalizacje.csv: 42 conversions, cost 1130, no conversion value.
    const m = profitModel(
      await dataset("lokalizacje.csv"),
      inputs({ aov: 200, marginPct: 50 })
    )
    expect(line(m, "Szacowany przychód").origin).toBe("estimate")
    expect(v(m, "Szacowany przychód")).toBe(8400)
    expect(v(m, "Szacowany zysk po reklamie")).toBe(3070)
    const none = profitModel(await dataset("lokalizacje.csv"), inputs({ marginPct: 50 }))
    expect(none.missing[0]).toContain("wpisz średnią wartość zamówienia")
  })

  it("product cost instead of margin; costs above margin are reported", async () => {
    const m = profitModel(
      await dataset("kampanie-audyt.csv"),
      inputs({ productCost: 100 })
    )
    expect(v(m, "Szacowana marża po kosztach zmiennych")).toBe(57500 - 317 * 100)
    const loss = profitModel(
      await dataset("kampanie-audyt.csv"),
      inputs({ marginPct: 5, otherCost: 20 })
    )
    expect(line(loss, "Break-even ROAS").value).toMatchObject({ ok: false })
  })
})

/*
 * September (30 days): clicks 5400, cost 6000, conversions 260. October (31 days): clicks 8062,
 * cost 10 558, conversions 317. Per day: cost 200 → 340,58 (+70,3%).
 */
describe("period comparison", () => {
  it("two reports of the same type, normalised per day", async () => {
    const data = await dataset("kampanie-wrzesien.csv", "kampanie-audyt.csv")
    const options = comparisonOptions(data)
    expect(options).toHaveLength(1)
    expect(options[0].label).toBe(
      "Kampanie: 1 września 2026 – 30 września 2026 → 1 października 2026 – 31 października 2026"
    )
    const c = compare(data, options[0].id)!
    expect(c.normalized).toBe(true)
    expect(c.warnings[0]).toContain("30 i 31 dni")
    const row = (k: string) => c.rows.find((r) => r.key === k)!
    expect(row("cost").previous).toBeCloseTo(200)
    expect(row("cost").current).toBeCloseTo(10558 / 31)
    expect(row("cost").changePct).toBeCloseTo(10558 / 31 / 200 - 1)
    expect(row("cost").perDay).toBe(true)
    expect(row("cost").good).toBeNull()
    // Ratios are not normalised: CPA 23,08 → 33,31, worse.
    expect(row("cpa").previous).toBeCloseTo(6000 / 260)
    expect(row("cpa").current).toBeCloseTo(10558 / 317)
    expect(row("cpa").good).toBe(false)
    expect(row("cpa").perDay).toBe(false)
  })

  it("campaigns that improved and worsened most (ROAS when value exists)", async () => {
    const data = await dataset("kampanie-wrzesien.csv", "kampanie-audyt.csv")
    const c = compare(data, comparisonOptions(data)[0].id)!
    // Kurtki ROAS 66,7% → 100%; Buty 1333% → 1000%; Brand unchanged.
    expect(c.improved.map((x) => x.name)).toEqual(["Kurtki – Search"])
    expect(c.improved[0].changePct).toBeCloseTo(0.5)
    expect(c.worsened.map((x) => x.name)).toEqual(["Buty – Search"])
    expect(c.worsened[0].changePct).toBeCloseTo(-0.25)
  })

  it("a daily report splits into two equal halves", async () => {
    const data = await dataset("kampanie-dzienne.csv")
    const [opt] = comparisonOptions(data)
    expect(opt.label).toBe("kampanie-dzienne.csv: ostatnie 15 dni wobec poprzednich 15")
    const c = compare(data, opt.id)!
    expect(c.previous.window).toEqual({ from: "2026-10-02", to: "2026-10-16", days: 15 })
    expect(c.current.window).toEqual({ from: "2026-10-17", to: "2026-10-31", days: 15 })
    expect(c.normalized).toBe(false)
  })

  it("identical periods and missing periods give no comparison", async () => {
    expect(
      comparisonOptions(await dataset("kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"))
    ).toEqual([])
    expect(comparisonOptions(await dataset("godziny-srednik.csv"))).toEqual([])
  })
})
