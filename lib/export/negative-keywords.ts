import { CATEGORY_LABEL, MATCH_TYPE_LABEL } from "@/constants/negative-keywords"
import type { NegativeAnalysis, NegativeList } from "@/lib/calculations/negative-keywords"
import type { CsvCell } from "./csv"

/** The accepted list with context: why each entry is there and what it cost. */
export function negativeCsvRows(
  list: NegativeList,
  analysis: NegativeAnalysis
): CsvCell[][] {
  const byId = new Map(analysis.suggestions.map((s) => [s.id, s]))
  return [
    [
      "Wykluczające słowo kluczowe",
      "Do wklejenia w Google Ads",
      "Typ dopasowania",
      "Kategoria",
      "Liczba zapytań",
      "Koszt zapytań",
      "Konwersje z zapytań",
    ],
    ...list.entries.map((e) => {
      const s = byId.get(e.suggestionId)!
      return [
        e.text,
        e.formatted,
        MATCH_TYPE_LABEL[e.matchType],
        CATEGORY_LABEL[e.category],
        s.termIndexes.length,
        s.cost,
        s.conversions,
      ]
    }),
  ]
}

/** One entry per line, with match-type symbols, ready to paste into Google Ads. */
export function negativePlainList(list: NegativeList): string {
  return list.entries.map((e) => e.formatted).join("\r\n")
}
