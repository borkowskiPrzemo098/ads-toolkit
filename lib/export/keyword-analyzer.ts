import {
  CATEGORY_LABEL,
  INTENT_LABEL,
  LENGTH_LABEL,
  STATUS_LABEL,
} from "@/constants/keyword-analyzer"
import type { KeywordRow } from "@/lib/calculations/keyword-analyzer"
import type { CsvCell } from "./csv"

/** Full analysis, every input row including duplicates, so nothing from the list is lost. */
export function keywordCsvRows(rows: KeywordRow[]): CsvCell[][] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return [
    [
      "Lp. na liście",
      "Fraza (oryginał)",
      "Fraza (po normalizacji)",
      "Kategoria (sugestia)",
      "Wszystkie sygnały",
      "Możliwa intencja",
      "Liczba słów",
      "Długość",
      "Status",
      "Duplikuje frazę",
      "Temat",
      "Sugerowane działanie",
    ],
    ...rows.map((r) => [
      String(r.id + 1),
      r.original.trim(),
      r.keyword,
      CATEGORY_LABEL[r.category],
      r.tags.map((t) => CATEGORY_LABEL[t]).join(", "),
      INTENT_LABEL[r.intent],
      String(r.wordCount),
      LENGTH_LABEL[r.lengthGroup],
      STATUS_LABEL[r.status],
      r.duplicateOf === null ? "" : (byId.get(r.duplicateOf)?.keyword ?? ""),
      r.topic,
      r.action,
    ]),
  ]
}

/** One normalised phrase per line, ready to paste into Google Ads. */
export function keywordPlainList(rows: KeywordRow[]): string {
  return rows.map((r) => r.keyword).join("\r\n")
}
