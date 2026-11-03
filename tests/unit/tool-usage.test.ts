import { describe, expect, it } from "vitest"
import { parseToolUsage, topTools } from "@/lib/tool-usage"

describe("parseToolUsage", () => {
  it("keeps known tools with positive integer counts", () => {
    expect(parseToolUsage('{"profitability":3,"utm-builder":1}')).toEqual({
      profitability: 3,
      "utm-builder": 1,
    })
  })

  it("drops unknown tools and invalid counts", () => {
    expect(
      parseToolUsage('{"profitability":0,"hack":5,"ab-testing":"7","rsa-builder":1.5}')
    ).toEqual({})
  })

  it.each([null, "", "not json", "[1,2]", "42", "null"])("returns {} for %j", (raw) => {
    expect(parseToolUsage(raw)).toEqual({})
  })
})

describe("topTools", () => {
  it("sorts by count and limits the result", () => {
    expect(
      topTools(
        { "utm-builder": 2, "ppc-reports": 9, profitability: 2, "ab-testing": 1 },
        3
      )
    ).toEqual(["ppc-reports", "profitability", "utm-builder"])
  })

  it("returns an empty list without usage", () => {
    expect(topTools({})).toEqual([])
  })
})
