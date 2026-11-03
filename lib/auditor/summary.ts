import { FIELDS, type Field } from "./columns"
import { REPORT_TYPES, type ReportType } from "./detect"
import type { ImportIssue, ReportAnalysis } from "./import"

export interface SummaryInput {
  name: string
  analysis: ReportAnalysis
}

/**
 * Checks across files: different periods, the same report type twice, and how totals will be
 * taken (from the highest-level report, so detailed reports never add to spend twice).
 */
export function crossFileNotes(reports: SummaryInput[]): ImportIssue[] {
  const notes: ImportIssue[] = []
  const typed = reports.filter((r) => r.analysis.type)

  const periods = new Map<string, string[]>()
  for (const r of typed) {
    if (!r.analysis.period) continue
    const key = `${r.analysis.period.from}–${r.analysis.period.to}`
    periods.set(key, [...(periods.get(key) ?? []), r.name])
  }
  if (periods.size > 1)
    notes.push({
      severity: "warning",
      message: `Raporty obejmują różne okresy (${[...periods.keys()].join(", ")}). Wyniki z różnych okresów nie będą sumowane; porównanie okresów uwzględni ich długość.`,
    })

  const byType = new Map<ReportType, string[]>()
  for (const r of typed) {
    const t = r.analysis.type!
    byType.set(t, [...(byType.get(t) ?? []), r.name])
  }
  for (const [type, names] of byType)
    if (names.length > 1)
      notes.push({
        severity: "warning",
        message: `${names.length} raporty typu „${REPORT_TYPES[type].label}” (${names.join(", ")}). Jeśli obejmują ten sam okres, część danych może się powtarzać.`,
      })

  const top = [...typed].sort(
    (a, b) => REPORT_TYPES[a.analysis.type!].level - REPORT_TYPES[b.analysis.type!].level
  )[0]
  if (top && typed.length > 1)
    notes.push({
      severity: "info",
      message: `Sumy konta (koszt, kliknięcia, konwersje) zostaną policzone z raportu „${top.name}” (${REPORT_TYPES[top.analysis.type!].label.toLowerCase()}). Raporty szczegółowe służą do szukania przyczyn i nie są do nich dodawane.`,
    })

  const ids: Field[] = ["customerId", "campaignId", "adGroupId", "adId", "keywordId"]
  const withIds = typed.filter((r) =>
    ids.some((f) => r.analysis.mapping[f] !== undefined)
  )
  if (typed.length > 1 && withIds.length < typed.length)
    notes.push({
      severity: "info",
      message: `Nie wszystkie raporty mają identyfikatory (${ids
        .map((f) => FIELDS[f].label)
        .slice(1, 3)
        .join(
          ", "
        )}…). Tam, gdzie ich brak, raporty zostaną połączone po nazwach kampanii i grup reklam.`,
    })
  return notes
}
