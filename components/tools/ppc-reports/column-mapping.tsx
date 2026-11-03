"use client"

import { Check, X } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/formatting/number"
import {
  FIELD_LABEL,
  mappingProblems,
  mapRows,
  type Mapping,
  type RawTable,
  type ReportField,
} from "@/lib/reports/import"

const FIELDS: ReportField[] = [
  "date",
  "campaign",
  "impressions",
  "clicks",
  "cost",
  "conversions",
  "conversionValue",
]
const PREVIEW_ROWS = 5

interface ColumnMappingProps {
  fileName: string
  table: RawTable
  mapping: Mapping
  onMappingChange: (mapping: Mapping) => void
  onConfirm: () => void
  onCancel: () => void
}

/** Step between reading a file and using it: the user checks every column assignment. */
export function ColumnMapping({
  fileName,
  table,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
}: ColumnMappingProps) {
  const preview = mapRows(table, mapping)
  const problems = mappingProblems(mapping)
  const options = [
    { value: "", label: "— brak —" },
    ...table.columns.map((name, i) => ({
      value: String(i),
      label: name || `Kolumna ${i + 1}`,
    })),
  ]
  const shownFields = FIELDS.filter((f) => mapping[f] !== undefined)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Plik <span className="font-medium text-foreground">{fileName}</span>: sprawdź,
        którą kolumnę wziąć do każdego pola. Rozpoznane kolumny są już przypisane.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FIELDS.map((field) => (
          <SelectField
            key={field}
            label={FIELD_LABEL[field]}
            value={mapping[field] === undefined ? "" : String(mapping[field])}
            options={options}
            onChange={(value) => {
              const next = { ...mapping }
              if (value === "") delete next[field]
              else next[field] = Number(value)
              onMappingChange(next)
            }}
          />
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Podgląd pierwszych wierszy po przypisaniu
        </p>
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[36rem] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {shownFields.map((f) => (
                  <th key={f} scope="col" className="py-1.5 pr-3 font-medium">
                    {FIELD_LABEL[f]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {preview.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                <tr key={i}>
                  {shownFields.map((f) => {
                    const value = row[f]
                    return (
                      <td key={f} className="py-1.5 pr-3 tabular">
                        {value === null
                          ? "—"
                          : typeof value === "number"
                            ? formatNumber(value, value % 1 ? 2 : 0)
                            : value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular">
          Wierszy z danymi: {formatNumber(preview.rows.length)}
          {preview.skippedTotals > 0 &&
            ` · pominięte podsumowania: ${preview.skippedTotals}`}
          {preview.problems.length > 0 && ` · nieczytelne: ${preview.problems.length}`}
        </p>
        {preview.problems.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-[#f7cf7c]">
            {preview.problems.slice(0, 5).map((p) => (
              <li key={p.line}>
                Wiersz {p.line}: {p.reason}
              </li>
            ))}
            {preview.problems.length > 5 && (
              <li>i {preview.problems.length - 5} więcej.</li>
            )}
          </ul>
        )}
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onConfirm}
          disabled={problems.length > 0 || preview.rows.length === 0}
        >
          <Check />
          Zatwierdź import
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X />
          Anuluj
        </Button>
      </div>
    </div>
  )
}
