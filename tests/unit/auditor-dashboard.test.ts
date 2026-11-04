import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildDashboard,
  DAILY_LIMIT,
  filterOptions,
  isUnavailable,
  NO_FILTERS,
  pickSource,
} from "@/lib/auditor/dashboard"
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
const dataset = async (...names: string[]) =>
  buildDataset(await Promise.all(names.map(report)))

// Hand totals of kampanie-dzienne.csv (generate.py): clicks = base + day % 7 over 31 days.
const sumDays = (f: (day: number) => number) =>
  Array.from({ length: 31 }, (_, i) => f(i + 1)).reduce((a, b) => a + b, 0)
const BUTY_CLICKS = sumDays((d) => 80 + (d % 7))
const KURTKI_CLICKS = sumDays((d) => 110 + (d % 7))
const BRAND_CLICKS = sumDays((d) => 12 + (d % 7))

describe("dashboard from daily campaign data", () => {
  it("KPIs follow the spec formulas on the totals report", async () => {
    const data = await dataset("kampanie-dzienne.csv")
    const m = buildDashboard(data, NO_FILTERS)
    const clicks = BUTY_CLICKS + KURTKI_CLICKS + BRAND_CLICKS
    const cost = BUTY_CLICKS * 1 + KURTKI_CLICKS * 2 + BRAND_CLICKS * 0.4
    expect(m.source?.name).toBe("kampanie-dzienne.csv")
    expect(m.totals.clicks).toBe(clicks)
    expect(m.totals.cost).toBeCloseTo(cost)
    expect(m.totals.impressions).toBe(clicks * 20)
    const k = m.kpis
    expect(k.ctr.ok && k.ctr.value).toBeCloseTo(5) // clicks / impressions × 100%
    expect(k.cpc.ok && k.cpc.value).toBeCloseTo(cost / clicks)
    expect(k.conversionRate.ok && k.conversionRate.value).toBeCloseTo(
      (m.totals.conversions! / clicks) * 100
    )
    expect(k.cpa.ok && k.cpa.value).toBeCloseTo(cost / m.totals.conversions!)
    // Conversion value is 200 per conversion: ROAS = value / cost × 100%.
    expect(k.roas.ok && k.roas.value).toBeCloseTo(
      ((m.totals.conversions! * 200) / cost) * 100
    )
  })

  it("daily series adds up to the KPIs and campaign bars add up to the cost", async () => {
    const m = buildDashboard(await dataset("kampanie-dzienne.csv"), NO_FILTERS)
    if (isUnavailable(m.series) || isUnavailable(m.campaigns))
      throw new Error("unavailable")
    expect(m.series.granularity).toBe("day")
    expect(m.series.points).toHaveLength(31)
    expect(m.series.points[0]).toMatchObject({ date: "2026-10-01" })
    const seriesCost = m.series.points.reduce((s, p) => s + p.metrics.cost!, 0)
    expect(seriesCost).toBeCloseTo(m.totals.cost!)
    expect(m.campaigns.rows.map((r) => r.name)).toEqual([
      "Kurtki – PMax",
      "Buty – Search",
      "Brand – Search",
    ])
    expect(m.campaigns.rows.reduce((s, r) => s + r.costShare!, 0)).toBeCloseTo(1)
  })

  it("filters: campaign, type, status and period", async () => {
    const data = await dataset("kampanie-dzienne.csv")
    const buty = data.campaigns.find((c) => c.name === "Buty – Search")!.key
    expect(buildDashboard(data, { ...NO_FILTERS, campaign: buty }).totals.clicks).toBe(
      BUTY_CLICKS
    )
    expect(
      buildDashboard(data, { ...NO_FILTERS, campaignType: "Performance Max" }).totals
        .clicks
    ).toBe(KURTKI_CLICKS)
    expect(
      buildDashboard(data, { ...NO_FILTERS, campaignStatus: "paused" }).totals.clicks
    ).toBe(BRAND_CLICKS)
    const week = buildDashboard(data, {
      ...NO_FILTERS,
      from: "2026-10-01",
      to: "2026-10-07",
    })
    expect(week.records).toBe(21)
    if (isUnavailable(week.series)) throw new Error("unavailable")
    expect(week.series.points).toHaveLength(7)
  })

  it("filter options come from the data", async () => {
    const o = filterOptions(await dataset("kampanie-dzienne.csv", "urzadzenia.xlsx"))
    expect(o.campaignTypes).toEqual(["Performance Max", "Sieć wyszukiwania"])
    expect(o.statuses).toEqual(["enabled", "paused"])
    expect(o.devices).toEqual(["desktop", "mobile", "tablet"])
    expect(o.dates).toEqual({ from: "2026-10-01", to: "2026-10-31" })
  })
})

describe("source selection", () => {
  it("a device filter switches to the device report and says so", async () => {
    const data = await dataset("kampanie-pl.csv", "urzadzenia.xlsx")
    const m = buildDashboard(data, { ...NO_FILTERS, device: "mobile" })
    expect(m.source?.name).toBe("urzadzenia.xlsx")
    expect(m.totals.cost).toBeCloseTo(1190.4)
    expect(m.sourceNote).toContain("urzadzenia.xlsx")
    const daily = buildDashboard(
      await dataset("kampanie-dzienne.csv", "urzadzenia.xlsx"),
      {
        ...NO_FILTERS,
        device: "mobile",
      }
    )
    expect(isUnavailable(daily.series) && daily.series.reason).toContain(
      "wybranych filtrów"
    )
    expect(buildDashboard(data, NO_FILTERS).sourceNote).toBeNull()
  })

  it("filters no report can answer give a reason, not zeros", async () => {
    const data = await dataset("kampanie-pl.csv", "urzadzenia.xlsx", "lokalizacje.csv")
    const both = buildDashboard(data, {
      ...NO_FILTERS,
      device: "mobile",
      location: "Kraków",
    })
    expect(both.source).toBeNull()
    expect(both.unavailable).toContain("jednocześnie")
    const noDates = buildDashboard(await dataset("kampanie-pl.csv"), {
      ...NO_FILTERS,
      from: "2026-10-01",
    })
    expect(noDates.unavailable).toBe(
      "Żaden raport z kosztem nie ma kolumny: data (dzień)."
    )
  })

  it("without a date column the time charts explain how to export one", async () => {
    const m = buildDashboard(await dataset("kampanie-pl.csv"), NO_FILTERS)
    expect(isUnavailable(m.series) && m.series.reason).toContain("Segment")
  })

  it("the totals report wins over a more detailed one", async () => {
    const data = await dataset("slowa-kluczowe-utf16.csv", "kampanie-pl.csv")
    expect(pickSource(data, NO_FILTERS)?.name).toBe("kampanie-pl.csv")
  })

  it("N/D instead of fake values when a denominator is zero", async () => {
    const data = await dataset("kampanie-pl.csv")
    const akcesoria = data.campaigns.find((c) => c.name === "Akcesoria – Search")!.key
    const m = buildDashboard(data, { ...NO_FILTERS, campaign: akcesoria })
    expect(m.kpis.cpa).toEqual({ ok: false, reason: "Brak konwersji." })
    expect(m.kpis.roas.ok && m.kpis.roas.value).toBe(0)
  })

  it("long periods are grouped by week, starting on Monday", () => {
    const days = DAILY_LIMIT + 8 // 70 days from Thu 2026-07-02
    const start = Date.UTC(2026, 6, 2)
    const long: NormalizedReport = {
      id: "q3",
      name: "q3",
      type: "campaign",
      period: null,
      currency: null,
      unrecognised: [],
      records: Array.from({ length: days }, (_, i) => ({
        line: i + 2,
        dims: {
          campaign: "A",
          date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        },
        metrics: {
          impressions: null,
          clicks: 1,
          cost: 1,
          conversions: null,
          conversionValue: null,
        },
      })),
    }
    const m = buildDashboard(buildDataset([long]), NO_FILTERS)
    if (isUnavailable(m.series)) throw new Error("unavailable")
    expect(m.series.granularity).toBe("week")
    expect(m.series.points[0]).toMatchObject({ date: "2026-06-29", metrics: { cost: 4 } })
    expect(m.series.points.reduce((s, p) => s + p.metrics.cost!, 0)).toBe(days)
  })
})
