import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeReport } from "@/lib/auditor/import"
import { buildDataset, pickPrimary } from "@/lib/auditor/join"
import { kpisOf, relativeDiff, sumMetrics } from "@/lib/auditor/metrics"
import {
  normalizeDayOfWeek,
  normalizeDevice,
  normalizeHour,
  normalizeId,
  normalizeMatchType,
  normalizeReport,
  normalizeStatus,
  type NormalizedReport,
} from "@/lib/auditor/normalize"
import { parseSheet } from "@/lib/auditor/parse"

const FIXTURES = join(__dirname, "../fixtures/auditor")

async function report(name: string, skipDuplicates = false): Promise<NormalizedReport> {
  const table = await parseSheet(new Uint8Array(readFileSync(join(FIXTURES, name))))
  return normalizeReport(
    name,
    name,
    table,
    analyzeReport(table, { fileName: name }),
    skipDuplicates
  )
}

/** A synthetic report for edge cases; metrics default to null (column missing). */
function synthetic(
  id: string,
  type: NormalizedReport["type"],
  rows: {
    dims?: NormalizedReport["records"][0]["dims"]
    cost?: number
    clicks?: number
    conversions?: number
  }[],
  period: NormalizedReport["period"] = {
    from: "2026-10-01",
    to: "2026-10-31",
    source: "kolumna",
  }
): NormalizedReport {
  return {
    id,
    name: id,
    type,
    period,
    unrecognised: [],
    currency: null,
    records: rows.map((r, i) => ({
      line: i + 2,
      dims: r.dims ?? {},
      metrics: {
        impressions: null,
        clicks: r.clicks ?? null,
        cost: r.cost ?? null,
        conversions: r.conversions ?? null,
        conversionValue: null,
      },
    })),
  }
}

describe("value normalisation", () => {
  it.each([
    ["Komputery", "desktop"],
    ["Computers", "desktop"],
    ["Telefony komórkowe z pełną przeglądarką", "mobile"],
    ["Mobile phones", "mobile"],
    ["Tablety z pełną przeglądarką", "tablet"],
    ["Ekrany telewizorów", "tv"],
    ["Connected TV", "tv"],
    ["Inne", "other"],
  ])("device %s → %s", (v, d) => expect(normalizeDevice(v)).toBe(d))

  it("match types, including close variants from search terms", () => {
    expect(normalizeMatchType("Ścisłe")).toEqual({ type: "exact", closeVariant: false })
    expect(normalizeMatchType("Exact match (close variant)")).toEqual({
      type: "exact",
      closeVariant: true,
    })
    expect(normalizeMatchType("Do wyrażenia")).toEqual({
      type: "phrase",
      closeVariant: false,
    })
    expect(normalizeMatchType("Broad match")).toEqual({
      type: "broad",
      closeVariant: false,
    })
    expect(normalizeMatchType("Inne")).toBeNull()
  })

  it("statuses, days, hours and IDs", () => {
    expect(normalizeStatus("Włączona")).toBe("enabled")
    expect(normalizeStatus("Paused")).toBe("paused")
    expect(normalizeStatus("Usunięta")).toBe("removed")
    expect(normalizeDayOfWeek("Środa")).toBe(3)
    expect(normalizeDayOfWeek("Sunday")).toBe(7)
    expect(normalizeHour("13:00")).toBe(13)
    expect(normalizeHour("12 AM")).toBe(0)
    expect(normalizeHour("1 PM")).toBe(13)
    expect(normalizeHour("25")).toBeNull()
    expect(normalizeId("123-456-7890")).toBe("1234567890")
  })
})

describe("normalised records", () => {
  it("campaign report: cleaned dimensions, numbers and source lines", async () => {
    const r = await report("kampanie-pl.csv")
    expect(r.records).toHaveLength(4)
    expect(r.records[0]).toMatchObject({
      line: 4,
      dims: { campaign: "Buty – Search", campaignId: "1111", campaignStatus: "enabled" },
      metrics: {
        impressions: 48210,
        clicks: 2410,
        cost: 2410,
        conversions: 96,
        conversionValue: 19200,
      },
    })
    expect(r.records[2].dims.campaignStatus).toBe("paused")
  })

  it("devices from XLSX keep fractional conversions", async () => {
    const r = await report("urzadzenia.xlsx")
    expect(r.records.map((x) => x.dims.device)).toEqual(["desktop", "mobile", "tablet"])
    expect(r.records[0].metrics.conversions).toBeCloseTo(52.333333)
  })

  it("schedule: day of week and hour", async () => {
    const r = await report("godziny-srednik.csv")
    expect(r.records[0].dims).toMatchObject({ dayOfWeek: 1, hour: 0 })
    expect(r.records.at(-1)!.dims).toMatchObject({ dayOfWeek: 6, hour: 18 })
  })

  it("a cell that is not a number stays out of the sums; '--' counts as zero", async () => {
    const r = await report("brak-kosztu.csv")
    expect(r.records[0].metrics.clicks).toBeNull()
    expect(sumMetrics(r.records.map((x) => x.metrics)).clicks).toBe(-5)
  })

  it("skipping duplicates changes the sums", async () => {
    const all = sumMetrics(
      (await report("slowa-kluczowe-utf16.csv")).records.map((r) => r.metrics)
    )
    const unique = sumMetrics(
      (await report("slowa-kluczowe-utf16.csv", true)).records.map((r) => r.metrics)
    )
    expect(all.cost).toBeCloseTo(2636.1)
    expect(unique.cost).toBeCloseTo(2144.1)
  })
})

describe("joining reports", () => {
  it("totals come only from the campaign report, never added to detailed reports", async () => {
    const reports = await Promise.all(
      [
        "slowa-kluczowe-utf16.csv",
        "kampanie-pl.csv",
        "search-terms-en.csv",
        "urzadzenia.xlsx",
      ].map((n) => report(n, true))
    )
    const data = buildDataset(reports)
    expect(data.primary?.name).toBe("kampanie-pl.csv")
    expect(data.totals.cost).toBeCloseTo(6448)
    expect(data.totals.clicks).toBe(5248)
    expect(data.totals.conversions).toBeCloseTo(175.5)
    const k = kpisOf(data.totals)
    expect(k.cpc).toEqual({ ok: true, value: 6448 / 5248 })
    expect(k.roas.ok && k.roas.value).toBeCloseTo((36950 / 6448) * 100)
  })

  it("ID-less reports borrow the campaign ID through a unique name", async () => {
    const data = buildDataset(
      await Promise.all(["kampanie-pl.csv", "urzadzenia.xlsx"].map((n) => report(n)))
    )
    const devices = data.joins.find((j) => j.reportId === "urzadzenia.xlsx")!
    expect(devices.campaign).toEqual({ id: 0, "name→id": 3, name: 0, none: 0 })
    const buty = data.campaigns.find((c) => c.id === "1111")!
    expect(buty.reports).toEqual(["kampanie-pl.csv", "urzadzenia.xlsx"])
    expect(buty.primary?.cost).toBe(2410)
    // Campaigns are ordered by spend in the totals report.
    expect(data.campaigns[0].name).toBe("Kurtki – PMax")
  })

  it("reconciliation: matching, lower with the known reason, other period", async () => {
    const reports = await Promise.all(
      ["kampanie-pl.csv", "search-terms-en.csv", "godziny-srednik.csv"].map((n) =>
        report(n)
      )
    )
    reports.push(
      synthetic("wrzesien", "device", [{ cost: 100 }], {
        from: "2026-09-01",
        to: "2026-09-30",
        source: "kolumna",
      })
    )
    reports.push(
      synthetic("pelny", "device", [{ cost: 6448, clicks: 5248, conversions: 175.5 }])
    )
    const checks = Object.fromEntries(
      buildDataset(reports).checks.map((c) => [c.reportId, c])
    )
    expect(checks["kampanie-pl.csv"].status).toBe("source")
    expect(checks["search-terms-en.csv"].status).toBe("lower")
    expect(checks["search-terms-en.csv"].note).toContain("wystarczająco wiele osób")
    expect(checks["search-terms-en.csv"].diff.cost).toBeCloseTo(584 / 6448 - 1)
    expect(checks["wrzesien"].status).toBe("other-period")
    expect(checks["pelny"].status).toBe("match")
    // No period in the file: compared, since it cannot be told apart.
    expect(checks["godziny-srednik.csv"].status).toBe("lower")
  })

  it("a detailed report above the account totals is flagged", () => {
    const data = buildDataset([
      synthetic("kampanie", "campaign", [
        { dims: { campaign: "A" }, cost: 100, clicks: 10 },
      ]),
      synthetic("slowa", "keyword", [
        { dims: { campaign: "A", keyword: "x" }, cost: 130, clicks: 10 },
      ]),
    ])
    expect(data.checks[1].status).toBe("higher")
    expect(data.issues.map((i) => i.message).join(" ")).toContain(
      "wyższa niż w raporcie „kampanie”"
    )
  })

  it("campaigns missing from the totals report, ambiguous names, several accounts", () => {
    const data = buildDataset([
      synthetic("kampanie", "campaign", [
        { dims: { campaign: "A", campaignId: "1", customerId: "111" }, cost: 10 },
        { dims: { campaign: "Dup", campaignId: "2", customerId: "111" }, cost: 10 },
        { dims: { campaign: "Dup", campaignId: "3", customerId: "222" }, cost: 10 },
      ]),
      synthetic("slowa", "keyword", [
        { dims: { campaign: "B", keyword: "x" }, cost: 1 },
        { dims: { campaign: "Dup", keyword: "y" }, cost: 1 },
      ]),
    ])
    const text = data.issues.map((i) => i.message).join("\n")
    expect(data.joins[1].unmatchedCampaigns).toEqual(["B", "Dup"])
    expect(text).toContain("kilka różnych identyfikatorów")
    expect(text).toContain("2 różnych kont")
    expect(data.joins[1].campaign).toEqual({ id: 0, "name→id": 0, name: 2, none: 0 })
  })

  it("picks the highest level, then the longest period", () => {
    const sept = { from: "2026-09-01", to: "2026-09-30", source: "kolumna" } as const
    const q3 = { from: "2026-07-01", to: "2026-09-30", source: "kolumna" } as const
    expect(
      pickPrimary([
        synthetic("g", "adGroup", [{ cost: 1 }]),
        synthetic("c", "campaign", [{ cost: 1 }]),
      ])?.id
    ).toBe("c")
    expect(
      pickPrimary([
        synthetic("m", "campaign", [{ cost: 1 }], sept),
        synthetic("q", "campaign", [{ cost: 1 }], q3),
      ])?.id
    ).toBe("q")
    expect(
      pickPrimary([synthetic("conv", "conversion", [{ conversions: 1 }])])
    ).toBeNull()
  })

  it("currency from symbols in amounts, a column, or none", async () => {
    expect((await report("kampanie-pl.csv")).currency).toBe("PLN")
    expect((await report("search-terms-en.csv")).currency).toBeNull()
    const data = buildDataset([
      { ...synthetic("a", "campaign", [{ cost: 1 }]), currency: "PLN" },
      { ...synthetic("b", "keyword", [{ cost: 1 }]), currency: "EUR" },
    ])
    expect(data.currency).toBe("PLN")
    expect(data.issues.map((i) => i.message).join(" ")).toContain("różnych walutach")
  })

  it("relative difference", () => {
    expect(relativeDiff(100, 110)).toBeCloseTo(0.1)
    expect(relativeDiff(0, 5)).toBeNull()
    expect(relativeDiff(null, 5)).toBeNull()
  })
})

describe("scoped reconciliation", () => {
  it("a report limited to some campaigns is checked against those campaigns", async () => {
    const data = buildDataset(
      await Promise.all(
        ["kampanie-pl.csv", "urzadzenia.xlsx", "grupy-reklam.csv"].map((n) => report(n))
      )
    )
    const devices = data.checks.find((c) => c.reportId === "urzadzenia.xlsx")!
    // Devices cover only "Buty – Search" (2410 zł of 6448 zł) and match it exactly.
    expect(devices.status).toBe("match")
    expect(devices.note).toBe(
      "Obejmuje 1 z 4 kampanii; w nich sumy zgodne z raportem nadrzędnym (różnica do 1%)."
    )
    expect(devices.diff.cost).toBeCloseTo(2410 / 6448 - 1)
    const groups = data.checks.find((c) => c.reportId === "grupy-reklam.csv")!
    expect(groups.status).toBe("lower")
    expect(groups.note).toContain("Obejmuje 1 z 4 kampanii; w nich jest")
  })

  it("a detailed report above its own campaigns is flagged even when below the account", () => {
    const data = buildDataset([
      synthetic("kampanie", "campaign", [
        { dims: { campaign: "A" }, cost: 100 },
        { dims: { campaign: "B" }, cost: 900 },
      ]),
      synthetic("slowa", "keyword", [
        { dims: { campaign: "A", keyword: "x" }, cost: 150 },
      ]),
    ])
    expect(data.checks[1].status).toBe("higher")
    expect(data.checks[1].note).toContain(
      "Obejmuje 1 z 2 kampanii; w nich suma jest wyższa"
    )
  })
})
