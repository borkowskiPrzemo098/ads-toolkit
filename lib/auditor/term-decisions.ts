import { formatNegative, type MatchType } from "@/lib/calculations/negative-keywords"
import { toCsv } from "@/lib/export/csv"
import { INTENT_LABEL } from "./intent"
import type { TermRow } from "./rules/search-terms"

/*
 * The user's decisions on search terms. Nothing is decided automatically: suggestions are
 * shown, the user marks each term, and only marked terms reach the exports.
 */

export type TermDecision = "relevant" | "irrelevant" | "exclude" | "add"

export interface DecisionEntry {
  decision: TermDecision
  match: MatchType
}

export type Decisions = Record<string, DecisionEntry>

export const DECISION_LABEL: Record<TermDecision, string> = {
  relevant: "Trafne",
  irrelevant: "Nietrafne",
  exclude: "Wyklucz",
  add: "Dodaj jako słowo kluczowe",
}

export const MATCH_LABEL: Record<MatchType, string> = {
  exact: "Ścisłe",
  phrase: "Do wyrażenia",
  broad: "Przybliżone",
}

/** Exclusions default to exact match: it blocks only that query and is the safest choice. */
export const DEFAULT_MATCH: Record<TermDecision, MatchType> = {
  relevant: "exact",
  irrelevant: "exact",
  exclude: "exact",
  add: "exact",
}

export function listFor(
  rows: TermRow[],
  decisions: Decisions,
  decision: "exclude" | "add"
) {
  return rows
    .filter((r) => decisions[r.key]?.decision === decision)
    .map((r) => ({
      row: r,
      match: decisions[r.key].match,
      formatted: formatNegative(r.term, decisions[r.key].match),
    }))
}

/** One entry per line, in Google Ads syntax: word, "phrase", [exact]. */
export function plainList(items: ReturnType<typeof listFor>): string {
  return [...new Set(items.map((i) => i.formatted))].join("\r\n")
}

export function decisionsCsv(items: ReturnType<typeof listFor>, title: string): string {
  return toCsv([
    [
      title,
      "Dopasowanie",
      "Do wklejenia",
      "Intencja (heurystyka)",
      "Kampanie",
      "Kliknięcia",
      "Koszt",
      "Konwersje",
    ],
    ...items.map(({ row, match, formatted }) => [
      row.term,
      MATCH_LABEL[match],
      formatted,
      INTENT_LABEL[row.intent.intent],
      row.campaigns.join(", "),
      row.metrics.clicks ?? "",
      row.metrics.cost ?? "",
      row.metrics.conversions ?? "",
    ]),
  ])
}
