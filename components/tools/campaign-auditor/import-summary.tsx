"use client"

import { ArrowLeft, Check } from "lucide-react"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { Button } from "@/components/ui/button"
import { FIELDS, type Field } from "@/lib/auditor/columns"
import { REPORT_TYPES } from "@/lib/auditor/detect"
import { recordCount } from "@/lib/auditor/import"
import { crossFileNotes } from "@/lib/auditor/summary"
import { formatPeriod } from "@/lib/reports/dates"
import { formatNumber } from "@/lib/formatting/number"
import { IssueList } from "./report-card"
import type { FileView } from "./use-audit-import"

/** Step 3: what will go into the audit. The user confirms before any analysis runs. */
export function ImportSummary({
  files,
  onBack,
  onConfirm,
}: {
  files: FileView[]
  onBack: () => void
  onConfirm: () => void
}) {
  const ready = files.filter((f) => f.analysis)
  const notes = crossFileNotes(
    ready.map((f) => ({ name: f.name, analysis: f.analysis! }))
  )
  const totalRecords = ready.reduce(
    (s, f) => s + recordCount(f.analysis!, f.skipDuplicates),
    0
  )
  const warnings = ready.reduce(
    (s, f) => s + f.analysis!.issues.filter((i) => i.severity === "warning").length,
    0
  )

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Plików", formatNumber(ready.length)],
          ["Rekordów", formatNumber(totalRecords)],
          [
            "Typów raportów",
            formatNumber(new Set(ready.map((f) => f.analysis!.type)).size),
          ],
          ["Ostrzeżeń", formatNumber(warnings)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-(--tool) tabular neon-text">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Panel
        title="Podsumowanie importu"
        description="Sprawdź, co trafi do audytu. Dane zostają w tej karcie przeglądarki."
      >
        <TableScroll label="Zaimportowane raporty">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Plik</th>
                <th className="px-3 py-2 font-medium">Typ</th>
                <th className="px-3 py-2 text-right font-medium">Rekordy</th>
                <th className="px-3 py-2 font-medium">Okres</th>
                <th className="px-3 py-2 font-medium">Kolumny</th>
                <th className="py-2 pl-3 font-medium">Brakujące dane</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((f) => {
                const a = f.analysis!
                const recognised = (Object.keys(a.mapping) as Field[]).filter(
                  (k) => FIELDS[k].kind !== "derived"
                )
                return (
                  <tr
                    key={f.id}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="min-w-[9rem] py-2.5 pr-3 font-medium [overflow-wrap:anywhere]">
                      {f.name}
                    </td>
                    <td className="px-3 py-2.5">
                      {a.type ? REPORT_TYPES[a.type].label : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {formatNumber(recordCount(a, f.skipDuplicates))}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular">
                      {a.period ? formatPeriod(a.period.from, a.period.to) : "brak dat"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatNumber(recognised.length)}:{" "}
                      {recognised.map((k) => FIELDS[k].label).join(", ")}
                    </td>
                    <td className="py-2.5 pl-3 text-muted-foreground">
                      {a.missingUseful.length
                        ? a.missingUseful.map((k) => FIELDS[k].label).join(", ")
                        : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      {notes.length > 0 && (
        <Panel title="Uwagi do całego zestawu">
          <IssueList issues={notes} />
        </Panel>
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onConfirm}>
          <Check />
          Zatwierdź dane
        </Button>
        <Button size="lg" variant="outline" onClick={onBack}>
          <ArrowLeft />
          Wróć do raportów
        </Button>
      </div>
    </div>
  )
}
