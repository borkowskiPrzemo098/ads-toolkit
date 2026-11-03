"use client"

import { useState } from "react"
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { FIELDS, type Field } from "@/lib/auditor/columns"
import { REPORT_TYPE_KEYS, REPORT_TYPES, type ReportType } from "@/lib/auditor/detect"
import {
  blockingIssues,
  plural,
  recordCount,
  type ImportIssue,
} from "@/lib/auditor/import"
import { formatPeriod } from "@/lib/reports/dates"
import { formatNumber } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import { ColumnMapper } from "./column-mapper"
import type { FileView } from "./use-audit-import"

const UNKNOWN = "unknown"
const TYPE_OPTIONS = [
  { value: UNKNOWN, label: "Nie rozpoznano: wybierz" },
  ...REPORT_TYPE_KEYS.map((t) => ({ value: t, label: REPORT_TYPES[t].label })),
]

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`
    : `${formatNumber(bytes / 1024 / 1024, 1)} MB`

export interface ReportCardActions {
  onRemove: () => void
  onType: (type: ReportType | null) => void
  onMapping: Parameters<typeof ColumnMapper>[0]["onChange"]
  onResetMapping: () => void
  onSkipDuplicates: (skip: boolean) => void
}

/** One imported file: what was recognised, what is missing, and the manual fixes. */
export function ReportCard({ file, ...actions }: { file: FileView } & ReportCardActions) {
  const a = file.analysis
  const errors = a ? blockingIssues(a).length : 0
  const [mapperOpen, setMapperOpen] = useState(false)
  const showMapper = mapperOpen || (a ? errors > 0 && a.columns.length > 0 : false)
  const recognised = a
    ? (Object.keys(a.mapping) as Field[]).filter((f) => FIELDS[f].kind !== "derived")
    : []

  return (
    <article
      aria-label={`Raport ${file.name}`}
      className={cn(
        "rounded-xl border bg-card",
        file.status === "error" || errors || file.duplicateOf
          ? "border-destructive/40"
          : "border-border"
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <StatusIcon file={file} errors={errors} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold break-all">{file.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground tabular">
            {formatSize(file.size)}
            {file.table && ` · ${file.table.format.toUpperCase()}`}
            {file.table?.encoding === "utf-16" && " · UTF-16"}
            {file.table?.delimiter &&
              ` · separator ${file.table.delimiter === "\t" ? "tabulator" : `„${file.table.delimiter}”`}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Usuń ${file.name}`}
          onClick={actions.onRemove}
        >
          <X />
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        {file.status === "parsing" && (
          <p className="text-sm text-muted-foreground">Odczytuję plik…</p>
        )}
        {file.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {file.error}
          </p>
        )}
        {file.duplicateOf && (
          <p role="alert" className="text-sm text-destructive">
            Ten sam raport co „{file.duplicateOf}”. Usuń jeden z nich, żeby dane nie
            liczyły się podwójnie.
          </p>
        )}

        {a && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
              <SelectField
                label="Typ raportu"
                value={a.type ?? UNKNOWN}
                options={TYPE_OPTIONS}
                onChange={(v) => actions.onType(v === UNKNOWN ? null : (v as ReportType))}
              />
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Rekordów</dt>
                  <dd className="font-semibold text-(--tool) tabular">
                    {formatNumber(recordCount(a, file.skipDuplicates))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Okres</dt>
                  <dd className="font-medium tabular">
                    {a.period ? formatPeriod(a.period.from, a.period.to) : "brak dat"}
                  </dd>
                </div>
                {a.type && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Rozpoznanie</dt>
                    <dd className="font-medium">
                      {a.type === a.detection.type
                        ? a.detection.reason
                        : "wybrane ręcznie"}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {recognised.length > 0 && (
              <ul aria-label="Rozpoznane kolumny" className="flex flex-wrap gap-1.5">
                {recognised.map((f) => (
                  <li
                    key={f}
                    className="rounded-md bg-[color-mix(in_oklab,var(--tool)_10%,transparent)] px-2 py-0.5 text-xs text-[#dbe9b5] ring-1 ring-[color-mix(in_oklab,var(--tool)_25%,transparent)] ring-inset"
                  >
                    {FIELDS[f].label}
                  </li>
                ))}
              </ul>
            )}

            {a.issues.length > 0 && <IssueList issues={a.issues} />}

            {a.duplicates.length > 0 && (
              <label className="flex items-center gap-3 text-sm">
                <Switch
                  checked={file.skipDuplicates}
                  onCheckedChange={actions.onSkipDuplicates}
                />
                Pomiń {formatNumber(a.duplicates.length)}{" "}
                {plural(
                  a.duplicates.length,
                  "zdublowany wiersz",
                  "zdublowane wiersze",
                  "zdublowanych wierszy"
                )}
              </label>
            )}

            <div>
              <Button
                variant="outline"
                size="sm"
                aria-expanded={showMapper}
                onClick={() => setMapperOpen(!showMapper)}
              >
                <ChevronDown
                  className={cn(
                    "transition-transform duration-150",
                    showMapper && "rotate-180"
                  )}
                />
                {showMapper ? "Ukryj przypisanie kolumn" : "Przypisz kolumny"}
              </Button>
              {showMapper && file.table && (
                <div className="mt-4 border-t border-border pt-4">
                  <ColumnMapper
                    analysis={a}
                    rows={file.table.rows}
                    onChange={actions.onMapping}
                    onReset={actions.onResetMapping}
                    edited={file.mapping !== undefined}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  )
}

function StatusIcon({ file, errors }: { file: FileView; errors: number }) {
  const base = "mt-0.5 size-5 shrink-0"
  if (file.status === "parsing")
    return (
      <LoaderCircle
        className={cn(base, "animate-spin text-muted-foreground")}
        aria-label="Wczytywanie"
      />
    )
  if (file.status === "error" || errors || file.duplicateOf)
    return (
      <CircleAlert className={cn(base, "text-destructive")} aria-label="Wymaga poprawy" />
    )
  if (file.analysis?.issues.some((i) => i.severity === "warning"))
    return (
      <TriangleAlert
        className={cn(base, "text-warning")}
        aria-label="Gotowy, z ostrzeżeniami"
      />
    )
  if (file.analysis)
    return <CircleCheck className={cn(base, "text-success")} aria-label="Gotowy" />
  return (
    <FileSpreadsheet className={cn(base, "text-muted-foreground")} aria-hidden="true" />
  )
}

const ISSUE_STYLE = {
  error: { icon: CircleAlert, className: "text-destructive", label: "Błąd" },
  warning: { icon: TriangleAlert, className: "text-warning", label: "Ostrzeżenie" },
  info: { icon: Info, className: "text-muted-foreground", label: "Informacja" },
} as const

export function IssueList({ issues }: { issues: ImportIssue[] }) {
  const order = { error: 0, warning: 1, info: 2 }
  return (
    <ul className="flex flex-col gap-2">
      {[...issues]
        .sort((x, y) => order[x.severity] - order[y.severity])
        .map((issue, i) => {
          const { icon: Icon, className, label } = ISSUE_STYLE[issue.severity]
          return (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <Icon
                className={cn("mt-0.5 size-4 shrink-0", className)}
                aria-label={label}
              />
              <span className={issue.severity === "info" ? "text-muted-foreground" : ""}>
                {issue.message}
              </span>
            </li>
          )
        })}
    </ul>
  )
}
