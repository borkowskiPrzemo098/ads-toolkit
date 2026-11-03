import { describe, expect, it } from "vitest"
import {
  budgetUse,
  byCampaign,
  byDate,
  change,
  kpisOf,
  summarize,
  totalsOf,
} from "@/lib/reports/aggregate"
import { formatPeriod, parseReportDate } from "@/lib/reports/dates"
import {
  mappingProblems,
  mapRows,
  readReportTable,
  suggestMapping,
  type ReportRow,
} from "@/lib/reports/import"
import { ppcCsvRows } from "@/lib/export/ppc-report"
import { changeTone, formatChange } from "@/lib/reports/format"
import { buildReportTexts } from "@/lib/reports/insights"
import {
  chartSeries,
  EMPTY_SETTINGS,
  kpiLines,
  type ReportModel,
} from "@/lib/reports/model"
import type { CalcResult } from "@/types/calculation"

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ")

const v = (r: CalcResult) => {
  if (!r.ok) throw new Error(r.reason)
  return r.value
}

describe("parseReportDate", () => {
  it.each([
    ["2026-10-01", "2026-10-01"],
    ["2026/10/1", "2026-10-01"],
    ["01.10.2026", "2026-10-01"],
    ["1.10.2026", "2026-10-01"],
    ["1 paź 2026", "2026-10-01"],
    ["1 października 2026", "2026-10-01"],
    ["15 maja 2026", "2026-05-15"],
    ["Oct 1, 2026", "2026-10-01"],
    ["March 3 2026", "2026-03-03"],
  ])("%j → %s", (input, expected) => {
    expect(parseReportDate(input)).toBe(expected)
  })

  it.each(["", "31.02.2026", "2026-13-01", "wczoraj", "1 xyz 2026"])(
    "rejects %j",
    (input) => {
      expect(parseReportDate(input)).toBeNull()
    }
  )

  it("formats periods in Polish", () => {
    expect(formatPeriod("2026-10-01", "2026-10-31")).toBe(
      "1 października 2026 – 31 października 2026"
    )
    expect(formatPeriod("2026-10-01", "2026-10-01")).toBe("1 października 2026")
  })
})

/* A Google Ads campaign report exported from the Polish UI, by day and campaign. */
const POLISH_EXPORT = [
  "Raport kampanii",
  "1 października 2026 - 3 października 2026",
  "Dzień,Kampania,Wyśw.,Kliknięcia,Koszt,Konwersje,Wartość konw.,Kod waluty",
  '2026-10-01,Buty – Search,"1 000",50,"100,00",4,"800,00",PLN',
  '2026-10-01,Kurtki – Search,500,20,"60,00",0,0,PLN',
  '2026-10-02,Buty – Search,1200,60,"120,00",5,"1 000,00",PLN',
  '2026-10-03,Buty – Search,900,40,"80,00",3,"540,00",PLN',
  '2026-10-03,Kurtki – Search,600,30,"90,00",--,--,PLN',
  'Razem: konto,,"4 200",200,"450,00",12,"2 340,00",',
].join("\n")

describe("report import", () => {
  const table = readReportTable(POLISH_EXPORT)!

  it("finds the header below the title lines and suggests a mapping", () => {
    expect(table.headerRow).toBe(2)
    expect(table.suggested).toEqual({
      date: 0,
      campaign: 1,
      impressions: 2,
      clicks: 3,
      cost: 4,
      conversions: 5,
      conversionValue: 6,
    })
  })

  it("maps rows, parses Polish numbers and skips the totals row", () => {
    const data = mapRows(table, table.suggested)
    expect(data.rows).toHaveLength(5)
    expect(data.skippedTotals).toBe(1)
    expect(data.problems).toEqual([])
    expect(data.rows[0]).toEqual({
      date: "2026-10-01",
      campaign: "Buty – Search",
      impressions: 1000,
      clicks: 50,
      cost: 100,
      conversions: 4,
      conversionValue: 800,
    })
    expect(data.rows[4].conversions).toBeNull()
  })

  it("reports unreadable cells with line numbers instead of dropping them silently", () => {
    const broken = readReportTable(
      "Day,Clicks,Cost\n2026-10-01,10,5\nwczoraj,3,2\n2026-10-02,abc,1"
    )!
    const data = mapRows(broken, broken.suggested)
    expect(data.rows).toHaveLength(1)
    expect(data.problems.map((p) => p.line)).toEqual([3, 4])
    expect(data.problems[0].reason).toContain("data")
  })

  it("recognises English headers and validates the mapping", () => {
    expect(
      suggestMapping([
        "Day",
        "Campaign",
        "Impr.",
        "Clicks",
        "Cost",
        "Conversions",
        "Conv. value",
      ])
    ).toEqual({
      date: 0,
      campaign: 1,
      impressions: 2,
      clicks: 3,
      cost: 4,
      conversions: 5,
      conversionValue: 6,
    })
    expect(mappingProblems({ impressions: 0 })[0]).toContain("koszt")
    expect(mappingProblems({ cost: 1, clicks: 1 })[0]).toContain("dwóch pól")
    expect(mappingProblems({ cost: 1 })).toEqual([])
  })

  it("returns null for a file without recognisable headers", () => {
    expect(readReportTable("a,b\n1,2")).toBeNull()
  })
})

describe("aggregation", () => {
  const rows = mapRows(
    readReportTable(POLISH_EXPORT)!,
    readReportTable(POLISH_EXPORT)!.suggested
  ).rows

  it("sums totals and computes KPIs, checked by hand", () => {
    const t = totalsOf(rows)
    expect(t).toEqual({
      impressions: 4200,
      clicks: 200,
      cost: 450,
      conversions: 12,
      conversionValue: 2340,
    })
    const k = kpisOf(t)
    expect(v(k.ctr)).toBeCloseTo((200 / 4200) * 100, 10)
    expect(v(k.cpc)).toBeCloseTo(2.25, 10)
    expect(v(k.cpa)).toBeCloseTo(37.5, 10)
    expect(v(k.conversionRate)).toBeCloseTo(6, 10)
    expect(v(k.roas)).toBeCloseTo(520, 10)
    expect(v(k.avgConversionValue)).toBeCloseTo(195, 10)
  })

  it("groups by day, oldest first", () => {
    const daily = byDate(rows)!
    expect(daily.map((d) => d.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"])
    expect(daily[0].totals.cost).toBe(160)
    expect(daily[2].totals.conversions).toBe(3)
  })

  it("groups by campaign, highest cost first", () => {
    const campaigns = byCampaign(rows)!
    expect(campaigns.map((c) => c.key)).toEqual(["Buty – Search", "Kurtki – Search"])
    expect(campaigns[1].totals).toMatchObject({ cost: 150, conversions: 0 })
    expect(campaigns[1].kpis.cpa.ok).toBe(false)
  })

  it("keeps metrics missing from the file as null, not zero", () => {
    const noValue: ReportRow[] = [
      {
        date: null,
        campaign: null,
        impressions: null,
        clicks: 10,
        cost: 20,
        conversions: 1,
        conversionValue: null,
      },
    ]
    const t = totalsOf(noValue)
    expect(t.conversionValue).toBeNull()
    expect(kpisOf(t).roas.ok).toBe(false)
    expect(byDate(noValue)).toBeNull()
    expect(byCampaign(noValue)).toBeNull()
  })

  it("summarises a period with its date range", () => {
    expect(summarize(rows).range).toEqual({ from: "2026-10-01", to: "2026-10-03" })
  })

  it("computes changes and budget use safely", () => {
    expect(change(120, 100)).toBeCloseTo(20, 10)
    expect(change(80, 100)).toBeCloseTo(-20, 10)
    expect(change(5, 0)).toBeNull()
    expect(change(null, 100)).toBeNull()
    expect(v(budgetUse(450, 500))).toBeCloseTo(90, 10)
    expect(budgetUse(450, null).ok).toBe(false)
    expect(budgetUse(450, 0).ok).toBe(false)
  })
})

describe("report texts", () => {
  const table = readReportTable(POLISH_EXPORT)!
  const current = summarize(mapRows(table, table.suggested).rows)
  const previousRows: ReportRow[] = [
    {
      date: "2026-09-01",
      campaign: "Buty – Search",
      impressions: 3000,
      clicks: 150,
      cost: 300,
      conversions: 12,
      conversionValue: 2400,
    },
  ]
  const previous = summarize(previousRows)

  it("summarises the period with real numbers only", () => {
    const texts = buildReportTexts(current, null, 500, "PLN")
    expect(nbsp(texts.summary)).toBe(
      "W okresie 1 października 2026 – 3 października 2026 kampanie przyniosły 200 kliknięć i 12 konwersji przy koszcie 450,00 zł. ROAS wyniósł 520%. Średni koszt konwersji to 37,50 zł."
    )
  })

  it("reports budget use, campaign shares and campaigns without conversions", () => {
    const texts = buildReportTexts(current, null, 500, "PLN")
    const all = nbsp([...texts.observations, ...texts.recommendations].join(" | "))
    expect(all).toContain("Wydano 450,00 zł, czyli 90% budżetu 500,00 zł.")
    expect(all).toContain(
      "Najwięcej konwersji dała kampania „Buty – Search”: 12 (100% wszystkich)."
    )
    expect(all).toContain("kampanii „Kurtki – Search”: wydała 150,00 zł bez konwersji")
    expect(all).toContain("Najwięcej konwersji przyniósł dzień 2 października 2026: 5.")
    expect(all).toContain(
      "Największy koszt miała kampania „Buty – Search”: 300,00 zł (67% wszystkich kosztów)."
    )
  })

  it("compares periods and explains CPA from the numbers", () => {
    const texts = buildReportTexts(current, previous, null, "PLN")
    const all = nbsp(
      [...texts.observations, ...texts.conclusions, ...texts.recommendations].join(" | ")
    )
    expect(all).toContain("Koszt: 450,00 zł (+50% wobec poprzedniego okresu).")
    expect(all).toContain("CPA wzrósł z 25,00 zł do 37,50 zł")
    expect(all).toContain("wzrost CPA o 50%")
  })

  it("never invents causes", () => {
    const texts = buildReportTexts(current, previous, 500, "PLN")
    const all = [
      texts.summary,
      ...texts.observations,
      ...texts.conclusions,
      ...texts.recommendations,
    ]
      .join(" ")
      .toLowerCase()
    for (const cause of [
      "ponieważ",
      "z powodu",
      "przez sezon",
      "konkurencja",
      "algorytm",
      "dzięki",
    ]) {
      expect(all).not.toContain(cause)
    }
  })

  it("asks for conversion value when it is missing and warns about low ROAS", () => {
    const noValue = summarize([
      {
        date: null,
        campaign: null,
        impressions: 100,
        clicks: 10,
        cost: 50,
        conversions: 2,
        conversionValue: null,
      },
    ])
    expect(
      buildReportTexts(noValue, null, null, "PLN").recommendations.join(" ")
    ).toContain("Skonfiguruj wartość konwersji")
    const lowRoas = summarize([
      {
        date: null,
        campaign: null,
        impressions: 100,
        clicks: 10,
        cost: 100,
        conversions: 1,
        conversionValue: 60,
      },
    ])
    const texts = buildReportTexts(lowRoas, null, null, "PLN")
    expect(texts.conclusions.join(" ")).toContain("niższa niż koszt reklamy")
    expect(texts.recommendations.join(" ")).toContain("progiem rentowności")
  })

  it("keeps a neutral recommendation when the data shows nothing to act on", () => {
    const fine = summarize([
      {
        date: null,
        campaign: null,
        impressions: 1000,
        clicks: 50,
        cost: 100,
        conversions: 5,
        conversionValue: 1000,
      },
    ])
    expect(buildReportTexts(fine, null, null, "PLN").recommendations).toEqual([
      "Dane nie wskazują pilnych zmian. Porównaj wyniki z kolejnym okresem, zanim wprowadzisz poprawki.",
    ])
  })
})

describe("report model and export", () => {
  const table = readReportTable(POLISH_EXPORT)!
  const current = summarize(mapRows(table, table.suggested).rows)
  const previous = summarize([
    {
      date: "2026-09-01",
      campaign: "Buty – Search",
      impressions: 3000,
      clicks: 150,
      cost: 300,
      conversions: 12,
      conversionValue: 2400,
    },
  ])
  const model = (prev: typeof previous | null = previous): ReportModel => ({
    settings: {
      ...EMPTY_SETTINGS,
      clientName: "Biegam.pl",
      periodLabel: "1–3 października 2026",
      comparisonLabel: "1 września 2026",
      budget: 500,
    },
    current,
    previous: prev,
    texts: buildReportTexts(current, prev, 500, "PLN"),
  })

  it("lists KPIs with changes and colours by direction", () => {
    const lines = kpiLines(model())
    const cpa = lines.find((l) => l.key === "cpa")!
    expect(cpa.value).toBeCloseTo(37.5, 10)
    expect(cpa.previous).toBeCloseTo(25, 10)
    expect(cpa.change).toBeCloseTo(50, 10)
    expect(changeTone(cpa)).toBe("bad")
    expect(changeTone(lines.find((l) => l.key === "clicks")!)).toBe("good")
    expect(lines.find((l) => l.key === "budgetUse")!.value).toBeCloseTo(90, 10)
    expect(formatChange(-12.4)).toBe("−12%")
  })

  it("prefers daily data for charts, then campaigns, then periods", () => {
    expect(chartSeries(model(), "cost")).toMatchObject({
      mode: "daily",
      values: [160, 120, 170],
    })
    // Same file mapped without its date column: no daily series, so campaigns are used.
    const noDates = summarize(
      mapRows(table, { ...table.suggested, date: undefined }).rows
    )
    const byCampaignModel = { ...model(), current: noDates }
    expect(chartSeries(byCampaignModel, "conversions")?.mode).toBe("campaign")
    const totalsOnly = summarize([
      {
        date: null,
        campaign: null,
        impressions: 10,
        clicks: 5,
        cost: 20,
        conversions: 1,
        conversionValue: 50,
      },
    ])
    expect(chartSeries({ ...model(), current: totalsOnly }, "roas")).toMatchObject({
      mode: "periods",
      values: [800, 250],
    })
    expect(chartSeries({ ...model(null), current: totalsOnly }, "cost")).toBeNull()
  })

  it("exports settings, KPIs, breakdowns and texts to CSV", () => {
    const rows = ppcCsvRows(model())
    expect(rows[0]).toEqual(["Klient", "Biegam.pl"])
    expect(rows.find((r) => r[0] === "CPA")).toEqual(["CPA", 37.5, 25, 50])
    expect(rows.some((r) => r[0] === "Dane dzienne")).toBe(true)
    expect(rows.some((r) => r[0] === "Kampanie")).toBe(true)
    expect(rows.filter((r) => r[0] === "Rekomendacja").length).toBeGreaterThan(0)
  })
})
