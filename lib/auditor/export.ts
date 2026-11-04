import { toCsv } from "@/lib/export/csv"
import { STATUS_LABEL, type Task, type TaskStatus } from "./action-plan"
import { AREA_LABEL, CONFIDENCE_LABEL, SEVERITY_LABEL, type Finding } from "./findings"
import type { AuditDataset } from "./join"
import { kpisOf } from "./metrics"
import { toRecommendation, GROUPS } from "./recommendations"

/* CSV exports (spec section 10): findings with recommendations, action plan, campaign data.
 * toCsv guards every text cell against spreadsheet formulas. */

const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]))

export function findingsCsv(findings: Finding[]): string {
  return toCsv([
    [
      "Grupa",
      "Obszar",
      "Problem",
      "Dotyczy",
      "Ważność",
      "Pewność",
      "Sytuacja",
      "Dowody",
      "Możliwa przyczyna",
      "Działanie",
      "Szacowany wpływ",
      "Raport",
      "Wymiar",
      "Okres",
      "Metoda",
      "Koszt",
    ],
    ...findings.map((f) => {
      const rec = toRecommendation(f)
      return [
        GROUP_LABEL[rec.group],
        AREA_LABEL[f.area],
        f.title,
        f.subject,
        SEVERITY_LABEL[f.severity],
        CONFIDENCE_LABEL[f.confidence],
        f.situation,
        f.evidence.map((e) => `${e.label}: ${e.value}`).join(" | "),
        f.cause,
        f.action,
        f.impact ?? "",
        f.source.report,
        f.source.dimension,
        f.source.period ?? "",
        f.source.method,
        f.cost,
      ]
    }),
  ])
}

export function planCsv(tasks: Task[], statuses: Record<string, TaskStatus>): string {
  return toCsv([
    ["Priorytet", "Zadanie", "Opis", "Uzasadnienie", "Dotyczy", "Status"],
    ...tasks.map((t) => [
      t.priority,
      t.title,
      t.description,
      t.justification,
      t.subjects.join(", "),
      STATUS_LABEL[statuses[t.id] ?? "todo"],
    ]),
  ])
}

/** Campaign data from the totals report, with KPIs recomputed. */
export function campaignsCsv(data: AuditDataset): string {
  return toCsv([
    [
      "Kampania",
      "ID",
      "Typ",
      "Wyświetlenia",
      "Kliknięcia",
      "Koszt",
      "Konwersje",
      "Wartość konwersji",
      "CTR %",
      "Śr. CPC",
      "CPA",
      "ROAS %",
    ],
    ...data.campaigns
      .filter((c) => c.primary)
      .map((c) => {
        const m = c.primary!
        const k = kpisOf(m)
        const v = (r: { ok: boolean; value?: number }) =>
          r.ok ? (r as { value: number }).value : ""
        return [
          c.name,
          c.id ?? "",
          c.type ?? "",
          m.impressions,
          m.clicks,
          m.cost,
          m.conversions,
          m.conversionValue,
          v(k.ctr),
          v(k.cpc),
          v(k.cpa),
          v(k.roas),
        ]
      }),
  ])
}
