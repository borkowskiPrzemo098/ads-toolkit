import {
  CONFIDENCE_LABEL,
  type Confidence,
  type Evidence,
  type Finding,
  type Severity,
} from "./findings"

/*
 * Recommendations panel (spec section 7): every finding becomes one recommendation in one of
 * seven groups, written as problem → evidence → interpretation → action, with priority and
 * confidence. Causes stay worded as possibilities, never as proven.
 */

export type RecGroup =
  "urgent" | "costs" | "conversion" | "value" | "newKeywords" | "exclusions" | "monitor"

export const GROUPS: { id: RecGroup; label: string; description: string }[] = [
  {
    id: "urgent",
    label: "Problemy wymagające natychmiastowej uwagi",
    description: "Wysoka ważność: duży koszt lub wyraźne odchylenie od wyników konta.",
  },
  {
    id: "costs",
    label: "Możliwości ograniczenia kosztów",
    description: "Wydatki, które nie przynoszą konwersji albo przynoszą je drogo.",
  },
  {
    id: "conversion",
    label: "Możliwości poprawy konwersji",
    description: "Ruch, który konwertuje słabiej, i reklamy o niskim CTR.",
  },
  {
    id: "value",
    label: "Możliwości zwiększenia wartości kampanii",
    description: "Elementy z dobrymi wynikami, które mogą udźwignąć więcej budżetu.",
  },
  {
    id: "newKeywords",
    label: "Potencjalne nowe słowa kluczowe",
    description: "Wyszukiwane hasła z konwersjami, których nie ma jeszcze na liście.",
  },
  {
    id: "exclusions",
    label: "Potencjalne wykluczenia",
    description: "Zapytania i nakładające się słowa do sprawdzenia przed wykluczeniem.",
  },
  {
    id: "monitor",
    label: "Elementy wymagające dalszego monitorowania",
    description: "Za mało danych, wahania i informacje o strukturze konta.",
  },
]

/** Group of each rule; problems of high severity always go to "urgent" first. */
const RULE_GROUP: Record<string, RecGroup> = {
  A1: "costs",
  A2: "costs",
  A3: "costs",
  A4: "monitor",
  A6: "conversion",
  A7: "conversion",
  A8: "value",
  A9: "monitor",
  A10: "monitor",
  B0: "monitor",
  B1: "costs",
  B2: "costs",
  B3: "conversion",
  B4: "value",
  B5: "conversion",
  B6: "exclusions",
  B7: "monitor",
  B8: "value",
  S1: "exclusions",
  S2: "exclusions",
  S3: "exclusions",
  S4: "exclusions",
  S5: "newKeywords",
  D0: "monitor",
  D1: "costs",
  D2: "conversion",
  D3: "value",
  L0: "monitor",
  L1: "costs",
  L2: "conversion",
  L3: "value",
  L4: "monitor",
  H1: "costs",
  H2: "value",
  G1: "conversion",
  G2: "conversion",
  G3: "conversion",
}

export type Priority = "Pilny" | "Wysoki" | "Średni" | "Niski"

const PRIORITY: Record<Severity, Priority> = {
  critical: "Pilny",
  high: "Wysoki",
  medium: "Średni",
  low: "Niski",
  info: "Niski",
}

export interface Recommendation {
  id: string
  group: RecGroup
  problem: string
  evidence: Evidence[]
  interpretation: string
  action: string
  priority: Priority
  confidence: Confidence
  confidenceLabel: string
  impact?: string
  source: Finding["source"]
  cost: number
}

export function toRecommendation(f: Finding): Recommendation {
  const urgent =
    f.kind === "problem" && (f.severity === "high" || f.severity === "critical")
  return {
    id: f.id,
    group: urgent
      ? "urgent"
      : (RULE_GROUP[f.rule] ?? (f.kind === "data" ? "monitor" : "costs")),
    problem: `${f.title}: ${f.subject}`,
    evidence: f.evidence,
    interpretation: `${f.situation} ${f.cause}`,
    action: f.action,
    priority: PRIORITY[f.severity],
    confidence: f.confidence,
    confidenceLabel: CONFIDENCE_LABEL[f.confidence],
    impact: f.impact,
    source: f.source,
    cost: f.cost,
  }
}

const PRIORITY_ORDER: Record<Priority, number> = {
  Pilny: 0,
  Wysoki: 1,
  Średni: 2,
  Niski: 3,
}

/** Groups in the spec order; inside a group by priority, then by money involved. */
export function groupRecommendations(findings: Finding[]) {
  const recs = findings.map(toRecommendation)
  return GROUPS.map((g) => ({
    ...g,
    items: recs
      .filter((r) => r.group === g.id)
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.cost - a.cost
      ),
  })).filter((g) => g.items.length > 0)
}
