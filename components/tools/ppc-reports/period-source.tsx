"use client"

import { useRef, useState } from "react"
import { FileUp, PencilLine, RefreshCw, Trash2 } from "lucide-react"
import { NumberField } from "@/components/forms/number-field"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { Button } from "@/components/ui/button"
import { FileReadError, readTextFile } from "@/lib/csv/read-file"
import { CURRENCY_SUFFIX, formatNumber, type Currency } from "@/lib/formatting/number"
import {
  mapRows,
  METRICS,
  readReportTable,
  type Mapping,
  type Metric,
  type RawTable,
  type ReportRow,
} from "@/lib/reports/import"
import { METRIC_LABELS } from "@/lib/reports/insights"
import { parseNumericForm } from "@/lib/validators/numeric-form"
import { ColumnMapping } from "./column-mapping"

export interface PeriodData {
  source: "csv" | "manual"
  rows: ReportRow[]
  fileName?: string
  problems: number
  skippedTotals: number
}

interface PeriodSourceProps {
  data: PeriodData | null
  onChange: (data: PeriodData | null) => void
  currency: Currency
  /** Shown before anything is loaded. */
  emptyHint: string
}

type ManualForm = Record<Metric, string>
const EMPTY_MANUAL: ManualForm = {
  impressions: "",
  clicks: "",
  cost: "",
  conversions: "",
  conversionValue: "",
}

export function PeriodSource({ data, onChange, currency, emptyHint }: PeriodSourceProps) {
  const [mode, setMode] = useState<"csv" | "manual">("csv")
  const [pending, setPending] = useState<{
    name: string
    table: RawTable
    mapping: Mapping
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState<ManualForm>(EMPTY_MANUAL)
  const fileRef = useRef<HTMLInputElement>(null)

  const manualParsed = parseNumericForm(manual, {})
  const manualReady =
    Object.keys(manualParsed.errors).length === 0 &&
    (manualParsed.values.cost !== null || manualParsed.values.clicks !== null)

  const importFile = async (file: File) => {
    setError(null)
    try {
      const text = await readTextFile(file, ["csv", "tsv", "txt"])
      const table = readReportTable(text)
      if (!table) {
        setError(
          "Nie znaleźliśmy nagłówków z danymi (np. Kliknięcia, Koszt). Sprawdź, czy to raport z Google Ads."
        )
        return
      }
      setPending({ name: file.name, table, mapping: table.suggested })
    } catch (e) {
      setError(e instanceof FileReadError ? e.message : "Nie udało się odczytać pliku.")
    }
  }

  if (data) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/6 px-4 py-3">
        <p className="text-sm">
          {data.source === "csv" ? (
            <>
              <span className="font-medium">{data.fileName}</span>
              <span className="text-muted-foreground tabular">
                {" "}
                · {formatNumber(data.rows.length)} wierszy
                {data.skippedTotals > 0 &&
                  ` · pominięte podsumowania: ${data.skippedTotals}`}
                {data.problems > 0 && ` · nieczytelne wiersze: ${data.problems}`}
              </span>
            </>
          ) : (
            <span className="font-medium">Dane wpisane ręcznie</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {data.source === "csv" ? <RefreshCw /> : <Trash2 />}
            {data.source === "csv" ? "Zmień plik" : "Usuń"}
          </Button>
        </div>
      </div>
    )
  }

  if (pending) {
    return (
      <ColumnMapping
        fileName={pending.name}
        table={pending.table}
        mapping={pending.mapping}
        onMappingChange={(mapping) => setPending({ ...pending, mapping })}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const mapped = mapRows(pending.table, pending.mapping)
          onChange({
            source: "csv",
            rows: mapped.rows,
            fileName: pending.name,
            problems: mapped.problems.length,
            skippedTotals: mapped.skippedTotals,
          })
          setPending(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Źródło danych"
        value={mode}
        onChange={setMode}
        options={[
          { value: "csv", label: "Plik CSV" },
          { value: "manual", label: "Wpisz ręcznie" },
        ]}
        className="self-start"
      />
      {mode === "csv" ? (
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-[#3a4456] px-5 py-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) void importFile(file)
          }}
        >
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              e.target.value = ""
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp />
            Wybierz plik CSV
          </Button>
          <p className="text-xs text-muted-foreground">
            Google Ads › Raporty › pobierz jako CSV. Najlepiej z kolumną Dzień i Kampania.
            Plik zostaje na Twoim komputerze.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {METRICS.map((metric) => (
              <NumberField
                key={metric}
                label={METRIC_LABELS[metric]}
                value={manual[metric]}
                onChange={(value) => setManual((m) => ({ ...m, [metric]: value }))}
                suffix={
                  metric === "cost" || metric === "conversionValue"
                    ? CURRENCY_SUFFIX[currency]
                    : undefined
                }
                error={manualParsed.errors[metric]}
              />
            ))}
          </div>
          <Button
            className="self-start"
            disabled={!manualReady}
            onClick={() =>
              onChange({
                source: "manual",
                rows: [{ date: null, campaign: null, ...manualParsed.values }],
                problems: 0,
                skippedTotals: 0,
              })
            }
          >
            <PencilLine />
            Użyj tych danych
          </Button>
        </div>
      )}
    </div>
  )
}
