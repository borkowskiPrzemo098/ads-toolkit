import { describe, expect, it } from "vitest"
import { toCsv } from "@/lib/export/csv"
import { utmCsvRows } from "@/lib/export/utm"
import {
  buildUtmUrl,
  checkUrl,
  DEFAULT_NORMALIZE,
  EMPTY_UTM,
  encodeUtmValue,
  normalizeUtmValue,
  type UtmValues,
} from "@/lib/utm/build"
import { generateBulk, generateUtmLink } from "@/lib/utm/generate"
import { addToHistory, MAX_HISTORY, parseHistory } from "@/lib/utm/history"
import { UTM_TEMPLATES } from "@/lib/utm/templates"

const utm = (patch: Partial<UtmValues>): UtmValues => ({
  ...EMPTY_UTM,
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "jesien_2026",
  ...patch,
})

const url = (raw: string) => {
  const check = checkUrl(raw)
  if (!check.ok) throw new Error(check.reason)
  return check.url
}

describe("checkUrl", () => {
  it("accepts http(s) addresses and adds https:// when missing", () => {
    expect(checkUrl("https://sklep.pl").ok).toBe(true)
    const noScheme = checkUrl("sklep.pl/buty")
    expect(noScheme.ok && noScheme.addedScheme).toBe(true)
    expect(noScheme.ok && noScheme.url.href).toBe("https://sklep.pl/buty")
  })

  it.each([
    ["", "Podaj adres"],
    ["sklep pl", "spacji"],
    ["ftp://sklep.pl", "http://"],
    ["javascript:alert(1)", "http://"],
    ["https://sklep", "domeny"],
    ["https://", "poprawny"],
  ])("rejects %j", (input, reason) => {
    const check = checkUrl(input)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toContain(reason)
  })
})

describe("normalizeUtmValue", () => {
  it("lowercases, strips Polish letters and replaces spaces by default", () => {
    expect(normalizeUtmValue("  Jesień   Żółte Buty ", DEFAULT_NORMALIZE)).toBe(
      "jesien_zolte_buty"
    )
  })

  it("respects each option", () => {
    expect(
      normalizeUtmValue("Jesień Buty", {
        lowercase: false,
        stripDiacritics: false,
        spaces: "%20",
      })
    ).toBe("Jesień Buty")
    expect(
      normalizeUtmValue("Łódź Buty", {
        lowercase: false,
        stripDiacritics: true,
        spaces: "-",
      })
    ).toBe("Lodz-Buty")
  })

  it("leaves platform placeholders untouched", () => {
    expect(
      normalizeUtmValue("Kampania {CampaignId} {{ad.name}}", DEFAULT_NORMALIZE)
    ).toBe("kampania_{CampaignId}_{{ad.name}}")
  })
})

describe("encodeUtmValue", () => {
  it("encodes reserved characters but not placeholders", () => {
    expect(encodeUtmValue("a&b=c d/ą")).toBe("a%26b%3Dc%20d%2F%C4%85")
    expect(encodeUtmValue("{keyword}")).toBe("{keyword}")
    expect(encodeUtmValue("x {{ad.name}} y")).toBe("x%20{{ad.name}}%20y")
  })
})

describe("buildUtmUrl", () => {
  it("adds parameters in canonical order and skips empty optional ones", () => {
    const result = buildUtmUrl(
      url("https://sklep.pl/buty"),
      utm({ utm_content: "baner" })
    )
    expect(result.url).toBe(
      "https://sklep.pl/buty?utm_source=google&utm_medium=cpc&utm_campaign=jesien_2026&utm_content=baner"
    )
    expect(result.suffix).toBe(
      "utm_source=google&utm_medium=cpc&utm_campaign=jesien_2026&utm_content=baner"
    )
  })

  it("keeps existing parameters byte-for-byte and the fragment at the end", () => {
    const result = buildUtmUrl(
      url("https://sklep.pl/p?id=12&q=buty+damskie&ref=%C5%BC#opinie"),
      utm({})
    )
    expect(result.url).toBe(
      "https://sklep.pl/p?id=12&q=buty+damskie&ref=%C5%BC&utm_source=google&utm_medium=cpc&utm_campaign=jesien_2026#opinie"
    )
    expect(result.kept).toEqual(["id=12", "q=buty+damskie", "ref=%C5%BC"])
  })

  it("replaces existing UTM keys and reports the old values", () => {
    const result = buildUtmUrl(
      url("https://sklep.pl/?UTM_SOURCE=fb&utm_term=stare&x=1"),
      utm({})
    )
    expect(result.url).toBe(
      "https://sklep.pl/?utm_term=stare&x=1&utm_source=google&utm_medium=cpc&utm_campaign=jesien_2026"
    )
    expect(result.replaced).toEqual([{ key: "utm_source", previous: "fb" }])
  })

  it("does not crash on malformed percent-encoding", () => {
    const result = buildUtmUrl(
      url("https://sklep.pl/?a=%E0%A4%A&utm_source=%ZZ"),
      utm({})
    )
    expect(result.kept).toEqual(["a=%E0%A4%A"])
    expect(result.replaced[0].previous).toBe("%ZZ")
  })

  it("encodes values with spaces and ampersands safely", () => {
    const result = buildUtmUrl(url("https://sklep.pl"), utm({ utm_campaign: "a & b" }))
    expect(result.url).toContain("utm_campaign=a%20%26%20b")
    expect(new URL(result.url).searchParams.get("utm_campaign")).toBe("a & b")
  })
})

describe("generateUtmLink", () => {
  it("normalises values and reports notes", () => {
    const result = generateUtmLink(
      "sklep.pl",
      utm({ utm_campaign: "Jesień 2026" }),
      DEFAULT_NORMALIZE
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.link.url).toBe(
      "https://sklep.pl/?utm_source=google&utm_medium=cpc&utm_campaign=jesien_2026"
    )
    expect(result.notes[0]).toContain("https://")
    expect(result.warnings).toEqual([])
  })

  it("requires source, medium and campaign", () => {
    const result = generateUtmLink("https://sklep.pl", EMPTY_UTM, DEFAULT_NORMALIZE)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      "utm_campaign",
      "utm_medium",
      "utm_source",
    ])
  })

  it("reports an invalid URL together with field errors", () => {
    const result = generateUtmLink(
      "nie adres",
      utm({ utm_source: "" }),
      DEFAULT_NORMALIZE
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.urlError).not.toBeNull()
    expect(result.fieldErrors.utm_source).toBeDefined()
  })

  it.each(["cpc", "email", "paid_social", "affiliate", "display", "{lpurl}"])(
    "accepts GA4-friendly medium %j",
    (medium) => {
      const result = generateUtmLink(
        "sklep.pl",
        utm({ utm_medium: medium }),
        DEFAULT_NORMALIZE
      )
      expect(result.ok && result.warnings).toEqual([])
    }
  )

  it("warns about mediums GA4 will not recognise", () => {
    const result = generateUtmLink(
      "sklep.pl",
      utm({ utm_medium: "reklama" }),
      DEFAULT_NORMALIZE
    )
    expect(result.ok && result.warnings[0]).toContain("Unassigned")
  })

  it("warns about upper case when lowercasing is off", () => {
    const result = generateUtmLink("sklep.pl", utm({ utm_source: "Google" }), {
      ...DEFAULT_NORMALIZE,
      lowercase: false,
    })
    expect(result.ok && result.warnings.some((w) => w.includes("wielkość liter"))).toBe(
      true
    )
  })

  it("warns about very long links", () => {
    const result = generateUtmLink(
      `sklep.pl/?q=${"x".repeat(2100)}`,
      utm({}),
      DEFAULT_NORMALIZE
    )
    expect(result.ok && result.warnings.some((w) => w.includes("2000"))).toBe(true)
  })
})

describe("generateBulk", () => {
  it("builds one link per non-empty line and reports invalid ones", () => {
    const rows = generateBulk(
      "sklep.pl/a\n\n  \nnie adres\nhttps://sklep.pl/b?x=1",
      utm({}),
      DEFAULT_NORMALIZE
    )
    expect(rows.map((r) => r.line)).toEqual([1, 4, 5])
    expect(rows.map((r) => r.result.ok)).toEqual([true, false, true])
  })
})

describe("templates", () => {
  it("produce valid links with the user's URL and campaign", () => {
    for (const template of UTM_TEMPLATES) {
      const values = { ...utm({}), ...template.values }
      if (!values.utm_source) values.utm_source = "partner_x"
      if (!values.utm_campaign) values.utm_campaign = "test"
      const result = generateUtmLink("sklep.pl", values, DEFAULT_NORMALIZE)
      expect(result.ok, template.id).toBe(true)
      if (result.ok) expect(result.warnings, template.id).toEqual([])
    }
  })

  it("keeps Google Ads and Meta placeholders literal in the final link", () => {
    const fb = UTM_TEMPLATES.find((t) => t.id === "facebook")!
    const result = generateUtmLink(
      "sklep.pl",
      { ...utm({}), ...fb.values },
      DEFAULT_NORMALIZE
    )
    expect(result.ok && result.link.url).toContain("utm_campaign={{campaign.name}}")
    expect(result.ok && result.link.url).toContain("utm_content={{ad.name}}")
  })
})

describe("history", () => {
  const item = (u: string) => ({ target: "sklep.pl", url: u, values: utm({}) })

  it("adds newest first and moves repeated links to the top", () => {
    const first = addToHistory([], [item("a"), item("b")], new Date(1000))
    expect(first.map((h) => h.url)).toEqual(["b", "a"])
    const second = addToHistory(first, [item("a")], new Date(2000))
    expect(second.map((h) => h.url)).toEqual(["a", "b"])
  })

  it("caps the history length", () => {
    const many = Array.from({ length: MAX_HISTORY + 10 }, (_, i) => item(`u${i}`))
    expect(addToHistory([], many)).toHaveLength(MAX_HISTORY)
  })

  it("parses stored history defensively", () => {
    const valid = addToHistory([], [item("a")])
    expect(parseHistory(JSON.stringify(valid))).toEqual(valid)
    expect(parseHistory("nope")).toEqual([])
    expect(parseHistory('[{"url":"x"}]')).toEqual([])
    expect(parseHistory(null)).toEqual([])
  })

  it("exports CSV with every UTM field and guards formulas", () => {
    const rows = utmCsvRows(addToHistory([], [{ ...item("=cmd"), target: "@x" }]))
    expect(rows[0]).toHaveLength(8)
    const csv = toCsv(rows)
    expect(csv).toContain("'=cmd;'@x;google;cpc;jesien_2026")
  })
})
