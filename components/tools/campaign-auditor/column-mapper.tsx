"use client"

import { SelectField } from "@/components/forms/select-field"
import { TableScroll } from "@/components/layout/table-scroll"
import { Button } from "@/components/ui/button"
import { FIELDS, MAPPABLE_FIELDS, type Field, type Mapping } from "@/lib/auditor/columns"
import type { ReportAnalysis } from "@/lib/auditor/import"

const NONE = "none"

/** Manual column assignment with a preview of the first rows. */
export function ColumnMapper({
  analysis,
  rows,
  onChange,
  onReset,
  edited,
}: {
  analysis: ReportAnalysis
  rows: string[][]
  onChange: (mapping: Mapping) => void
  onReset: () => void
  edited: boolean
}) {
  const options = [
    { value: NONE, label: "— brak —" },
    ...analysis.columns.map((name, i) => ({
      value: String(i),
      label: name || `Kolumna ${i + 1}`,
    })),
  ]
  const set = (field: Field, value: string) => {
    const next = { ...analysis.mapping }
    if (value === NONE) delete next[field]
    else next[field] = Number(value)
    onChange(next)
  }
  const preview = analysis.dataRows.slice(0, 3).map((r) => rows[r])

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {MAPPABLE_FIELDS.map((field) => (
          <SelectField
            key={field}
            label={FIELDS[field].label}
            value={
              analysis.mapping[field] === undefined
                ? NONE
                : String(analysis.mapping[field])
            }
            options={options}
            onChange={(v) => set(field, v)}
          />
        ))}
      </div>
      {preview.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Pierwsze wiersze pliku
          </p>
          <TableScroll label="Podgląd pierwszych wierszy raportu">
            <table className="w-full min-w-[36rem] text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {analysis.columns.map((c, i) => (
                    <th key={i} className="px-2 py-2 font-medium whitespace-nowrap">
                      {c || `Kolumna ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, r) => (
                  <tr key={r} className="border-b border-border/60 last:border-0">
                    {analysis.columns.map((_, i) => (
                      <td key={i} className="px-2 py-1.5 whitespace-nowrap tabular">
                        {row[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
      {edited && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onReset}>
          Przywróć rozpoznanie automatyczne
        </Button>
      )}
    </div>
  )
}
