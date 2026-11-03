import { describe, expect, it } from "vitest"
import {
  EMPTY_BRIEF,
  FORMULAS,
  generateProposals,
  missingInputs,
  tidy,
  type RsaBrief,
} from "@/lib/rsa/formulas"
import { countChars, displayText, RSA } from "@/lib/rsa/limits"
import { displayUrl, previewCombination } from "@/lib/rsa/preview"
import { adHints, validateAd, validateAsset, type RsaAd } from "@/lib/rsa/validate"
import { rsaCsvRows, rsaPlainText, rsaReport } from "@/lib/export/rsa"

const BRIEF: RsaBrief = {
  brand: "Biegam.pl",
  product: "Buty do biegania",
  keywords: ["buty do biegania", "buty biegowe"],
  benefits: ["Darmowa dostawa", "30 dni na zwrot", "Doradztwo w doborze"],
  audience: "biegaczy",
  ctas: ["Sprawdź ofertę", "Kup teraz"],
  price: "od 199 zł",
  problem: "Obtarte stopy po bieganiu",
  offer: "Wysyłka w 24 h",
}

const ad = (patch: Partial<RsaAd> = {}): RsaAd => ({
  headlines: [
    { id: "h1", text: "Buty do biegania", pin: null },
    { id: "h2", text: "Darmowa dostawa", pin: null },
    { id: "h3", text: "Sprawdź ofertę", pin: null },
  ],
  descriptions: [
    { id: "d1", text: "Darmowa dostawa i 30 dni na zwrot. Sprawdź ofertę.", pin: null },
    { id: "d2", text: "Buty do biegania od 199 zł. Doradzimy w doborze.", pin: null },
  ],
  finalUrl: "https://biegam.pl/buty",
  path1: "buty",
  path2: "",
  ...patch,
})

describe("character counting", () => {
  it("counts Polish letters once and keyword insertion by its default text", () => {
    expect(countChars("Żółć")).toBe(4)
    expect(displayText("Kup {KeyWord:buty} dziś")).toBe("Kup buty dziś")
    expect(countChars("{KeyWord:Buty do biegania}")).toBe(16)
  })
})

describe("validateAsset", () => {
  it("accepts text at the limit and rejects one character more", () => {
    expect(validateAsset("headline", "x".repeat(RSA.headline.max))).toEqual([])
    const over = validateAsset("headline", "x".repeat(RSA.headline.max + 1))
    expect(over[0]).toMatchObject({ severity: "error" })
    expect(over[0].message).toContain("skróć o 1")
    expect(validateAsset("description", "x".repeat(91))[0].severity).toBe("error")
  })

  it("applies Google Ads editorial rules", () => {
    const messages = (kind: "headline" | "description", text: string) =>
      validateAsset(kind, text).map((i) => `${i.severity}:${i.message}`)
    expect(messages("headline", "Kup teraz!")[0]).toContain("wykrzyknika")
    expect(messages("description", "Kup teraz! Taniej!")[0]).toContain("jeden wykrzyknik")
    expect(validateAsset("description", "Kup teraz!")).toEqual([])
    expect(messages("headline", "Super oferta ??")[0]).toContain("error")
    expect(messages("headline", "Promocja..")[0]).toContain("warning")
    expect(messages("headline", "Buty 🏃")[0]).toContain("emoji")
    expect(messages("description", "Zadzwoń: 600 100 200")[0]).toContain("telefonu")
    expect(messages("headline", "MEGA promocja")[0]).toContain("Wielkie litery")
    expect(validateAsset("headline", "Kurs SEO i PPC")).toEqual([])
    expect(messages("headline", "Kup {buty}")[0]).toContain("KeyWord")
    expect(validateAsset("headline", "Kup {KeyWord:buty}")).toEqual([])
    expect(messages("headline", "   ")[0]).toContain("Pusty")
  })
})

describe("validateAd", () => {
  it("accepts a minimal valid ad", () => {
    const result = validateAd(ad())
    expect(result.valid).toBe(true)
    expect(result.ad).toEqual([])
  })

  it("requires 3 headlines and 2 descriptions", () => {
    const result = validateAd(
      ad({
        headlines: ad().headlines.slice(0, 2),
        descriptions: ad().descriptions.slice(0, 1),
      })
    )
    expect(result.valid).toBe(false)
    expect(result.ad.filter((i) => i.severity === "error")).toHaveLength(2)
  })

  it("flags duplicates ignoring case, spaces and final punctuation", () => {
    const result = validateAd(
      ad({
        headlines: [
          ...ad().headlines,
          { id: "h4", text: "buty  do biegania.", pin: null },
        ],
      })
    )
    expect(result.assets.h4[0].message).toContain("Powtarza")
    expect(result.assets.h1).toEqual([])
  })

  it("explains pinning trade-offs and impossible pin setups", () => {
    const headlines = [
      { id: "h1", text: "Buty do biegania", pin: 1 as const },
      { id: "h2", text: "Darmowa dostawa", pin: 2 as const },
      { id: "h3", text: "Sprawdź ofertę", pin: 2 as const },
      { id: "h4", text: "Biegam.pl", pin: 3 as const },
    ]
    const result = validateAd(ad({ headlines }))
    const text = result.ad.map((i) => i.message).join(" | ")
    expect(text).toContain("Pozycja 1 ma przypięty tylko jeden")
    expect(text).toContain("pozycji 3 nie zawsze")

    const allPinned = validateAd(
      ad({
        headlines: [
          { id: "h1", text: "A1", pin: 1 },
          { id: "h2", text: "B2", pin: 1 },
          { id: "h3", text: "C3", pin: 2 },
        ],
      })
    )
    expect(allPinned.ad.some((i) => i.message.includes("Za mało nieprzypiętych"))).toBe(
      true
    )
    expect(allPinned.valid).toBe(false)
  })

  it("checks the final URL and display paths", () => {
    const result = validateAd(
      ad({ finalUrl: "biegam", path1: "", path2: "buty do biegania xx" })
    )
    const text = result.ad.map((i) => i.message).join(" | ")
    expect(text).toContain("domeny")
    expect(text).toContain("Ścieżka 2: najwyżej 15")
    expect(text).toContain("wymaga wypełnionej ścieżki 1")
    expect(text).toContain("myślnika")
  })
})

describe("adHints", () => {
  it("suggests more assets and keyword coverage, without claiming Ad Strength", () => {
    const hints = adHints(ad(), ["buty do biegania"])
    expect(hints.join(" ")).toContain("Masz 3 nagłówków")
    expect(hints.join(" ")).toContain("co najmniej 2 nagłówkach")
  })
})

describe("tidy", () => {
  it("capitalises sentences, fixes spacing and final punctuation", () => {
    expect(tidy("darmowa dostawa , 30 dni na zwrot. sprawdź ofertę", "description")).toBe(
      "Darmowa dostawa, 30 dni na zwrot. Sprawdź ofertę."
    )
    expect(tidy("buty. kup teraz.", "headline")).toBe("Buty. Kup teraz")
    expect(tidy("żółte buty?", "description")).toBe("Żółte buty?")
  })
})

describe("generateProposals", () => {
  const proposals = generateProposals(BRIEF)

  it("only proposes texts within Google Ads limits", () => {
    for (const p of proposals) {
      expect(p.length, p.text).toBeLessThanOrEqual(RSA[p.kind].max)
      expect(countChars(p.text)).toBe(p.length)
    }
  })

  it("produces headlines and descriptions for every formula with enough data", () => {
    const formulas = new Set(proposals.map((p) => p.formula))
    for (const formula of FORMULAS)
      expect(formulas.has(formula.id), formula.id).toBe(true)
    expect(proposals.filter((p) => p.kind === "headline").length).toBeGreaterThanOrEqual(
      15
    )
    expect(
      proposals.filter((p) => p.kind === "description").length
    ).toBeGreaterThanOrEqual(4)
  })

  it("passes the editorial checks and never repeats a text", () => {
    for (const p of proposals) {
      expect(validateAsset(p.kind, p.text), p.text).toEqual([])
    }
    const keys = proposals.map((p) => `${p.kind}:${p.text.toLowerCase()}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("keeps the brand as written and lower-cases mid-sentence words", () => {
    expect(proposals.map((p) => p.text)).toContain("Buty do biegania – Biegam.pl")
    expect(proposals.map((p) => p.text)).toContain(
      "Darmowa dostawa, 30 dni na zwrot. Sprawdź ofertę."
    )
  })

  it("avoids redundant urgency and mirrored benefit pairs", () => {
    const texts = proposals.map((p) => p.text)
    expect(texts.some((t) => /teraz już dziś/i.test(t))).toBe(false)
    expect(texts).toContain("Sprawdź ofertę już dziś")
    expect(texts).not.toContain("30 dni na zwrot, darmowa dostawa. Sprawdź ofertę.")
    const dzis = generateProposals({ ...BRIEF, ctas: ["Zamów dziś"] }).map((p) => p.text)
    expect(dzis.some((t) => /dziś już dziś/i.test(t))).toBe(false)
  })

  it("uses only the advertiser's words, never invented claims", () => {
    const all = proposals.map((p) => p.text.toLowerCase()).join(" ")
    for (const claim of ["najtaniej", "najlepsz", "oficjalny", "gwarancj", "nr 1"]) {
      expect(all).not.toContain(claim)
    }
  })

  it("returns nothing for an empty brief and says what is missing", () => {
    expect(generateProposals(EMPTY_BRIEF)).toEqual([])
    expect(missingInputs({ ...BRIEF, price: "" }, "price-cta")).toEqual(["price"])
    expect(missingInputs(BRIEF, "price-cta")).toEqual([])
    expect(missingInputs({ ...BRIEF, audience: "" }, "product-use")).toEqual(["audience"])
  })
})

describe("previewCombination", () => {
  const assets = (texts: string[], pins: (1 | 2 | 3 | null)[] = []) =>
    texts.map((text, i) => ({ id: `a${i}`, text, pin: pins[i] ?? null }))

  it("keeps pinned texts on their positions and fills the rest", () => {
    const preview = previewCombination(
      ad({ headlines: assets(["A", "B", "C", "Marka"], [null, null, null, 1]) }),
      0
    )
    expect(preview.headlines).toEqual(["Marka", "A", "B"])
  })

  it("rotates unpinned texts with the seed", () => {
    const base = ad({ headlines: assets(["A", "B", "C", "D"]) })
    expect(previewCombination(base, 0).headlines).toEqual(["A", "B", "C"])
    expect(previewCombination(base, 1).headlines).toEqual(["B", "C", "D"])
  })

  it("shows keyword insertion as its default text and builds the display URL", () => {
    const preview = previewCombination(
      ad({
        headlines: assets(["Kup {KeyWord:buty}", "B", "C"]),
        finalUrl: "https://www.biegam.pl/x",
        path1: "buty",
        path2: "damskie",
      })
    )
    expect(preview.headlines[0]).toBe("Kup buty")
    expect(preview.displayUrl).toBe("biegam.pl/buty/damskie")
    expect(displayUrl({ finalUrl: "", path1: "", path2: "x" })).toBe("twojadomena.pl")
  })
})

describe("RSA export", () => {
  it("lists every filled asset with length, limit and pin", () => {
    const pinned = ad({
      headlines: [
        ...ad().headlines.slice(0, 2),
        { id: "h3", text: "Sprawdź ofertę", pin: 1 },
      ],
    })
    const rows = rsaCsvRows(pinned)
    expect(rows[3]).toEqual(["Nagłówek", 3, "Sprawdź ofertę", 14, 30, "Pozycja 1"])
    expect(rows.find((r) => r[0] === "Ścieżka 1")).toEqual([
      "Ścieżka 1",
      "",
      "buty",
      4,
      15,
      "",
    ])
    expect(rsaPlainText(pinned)).toContain("3. Sprawdź ofertę (14/30) [pozycja 1]")
    const report = rsaReport(pinned, validateAd(pinned))
    expect(report.tables[0].rows).toHaveLength(3)
    expect(report.summary?.tone).toBe("positive")
  })
})
