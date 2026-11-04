import { isTotalsCell } from "@/lib/csv/keyword-import"
import { parseReportNumber } from "@/lib/csv/numbers"
import { parseReportDate } from "@/lib/reports/dates"
import {
  FIELDS,
  NUMERIC_FIELDS,
  normalizeHeader,
  suggestMapping,
  type Field,
  type Mapping,
} from "./columns"
import {
  detectReportType,
  REQUIRED,
  USEFUL,
  type Detection,
  type ReportType,
} from "./detect"
import type { SheetTable } from "./parse"

/** Everything the import screens show for one file. Raw rows are kept untouched. */
export interface ReportAnalysis {
  headerRow: number
  columns: string[]
  mapping: Mapping
  detection: Detection
  /** Detected type, or the one the user picked. */
  type: ReportType | null
  /** Indexes into table.rows of the rows that will be analysed. */
  dataRows: number[]
  skipped: { totals: number[]; repeatedHeaders: number[] }
  duplicates: number[]
  /** Report period from the date column, or from the "1 paź 2026 – 31 paź 2026" line above the header. */
  period: { from: string; to: string; source: "kolumna" | "nagłówek pliku" } | null
  missingRequired: Field[]
  missingUseful: Field[]
  issues: ImportIssue[]
}

export interface ImportIssue {
  severity: "error" | "warning" | "info"
  message: string
}

export interface AnalysisOptions {
  mapping?: Mapping
  type?: ReportType | null
  fileName?: string
}

/** Numbers: XLSX cells are canonical ("41.333"), CSV cells are locale-formatted text. */
export function parseCellNumber(
  cell: string,
  format: SheetTable["format"]
): number | null {
  if (format === "xlsx" && /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(cell)) return Number(cell)
  return parseReportNumber(cell)
}

export const isNoData = (cell: string) =>
  cell === "" || /^(--|-|n\/a|brak)$/i.test(cell.trim())

/**
 * The header is the first of the top rows that names at least two known fields including a
 * metric. Exports start with a title and a date-range line, so it is rarely row 0.
 */
export function findHeaderRow(rows: string[][]): number | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const mapping = suggestMapping(rows[r])
    const fields = Object.keys(mapping) as Field[]
    if (fields.length >= 2 && fields.some((f) => FIELDS[f].kind === "metric")) return r
  }
  return null
}

/** "1 października 2026 - 31 października 2026" or "Oct 1, 2026 - Oct 31, 2026". */
export function periodFromPreamble(
  rows: string[][]
): { from: string; to: string } | null {
  for (const row of rows) {
    const text = row.filter(Boolean).join(" ")
    const parts = text.split(/\s[-–—]\s/)
    if (parts.length !== 2) continue
    const from = parseReportDate(parts[0].trim())
    const to = parseReportDate(parts[1].trim())
    if (from && to && from <= to) return { from, to }
  }
  return null
}

const rowKey = (row: string[]) => row.join("\u0001")

export function analyzeReport(
  table: SheetTable,
  options: AnalysisOptions = {}
): ReportAnalysis {
  const issues: ImportIssue[] = []
  const headerRow = findHeaderRow(table.rows)

  if (headerRow === null) {
    return {
      headerRow: 0,
      columns: table.rows[0] ?? [],
      mapping: options.mapping ?? {},
      detection: { type: null, confidence: "low", reason: "nie znaleziono nagłówka" },
      type: options.type ?? null,
      dataRows: table.rows.length ? table.rows.slice(1).map((_, i) => i + 1) : [],
      skipped: { totals: [], repeatedHeaders: [] },
      duplicates: [],
      period: null,
      missingRequired: [],
      missingUseful: [],
      issues: [
        {
          severity: "error",
          message:
            "Nie rozpoznano wiersza nagłówka (np. Kampania, Koszt, Kliknięcia). Przypisz kolumny ręcznie albo wyeksportuj raport ponownie z nagłówkami.",
        },
      ],
    }
  }

  const columns = table.rows[headerRow]
  const mapping = options.mapping ?? suggestMapping(columns)
  const detection = detectReportType(mapping, options.fileName)
  const type = options.type !== undefined ? options.type : detection.type
  const headerKey = rowKey(columns.map(normalizeHeader))

  const dataRows: number[] = []
  const totals: number[] = []
  const repeatedHeaders: number[] = []
  const seen = new Map<string, number>()
  const duplicates: number[] = []

  for (let r = headerRow + 1; r < table.rows.length; r++) {
    const row = table.rows[r]
    if (row.every((c) => c === "")) continue
    // Cheap first-cell check before normalising the whole row (300k rows must stay fast).
    if (row[0] === columns[0] && rowKey(row.map(normalizeHeader)) === headerKey) {
      repeatedHeaders.push(r)
      continue
    }
    if (row.slice(0, 3).some((c) => isTotalsCell(c))) {
      totals.push(r)
      continue
    }
    const key = rowKey(row)
    if (seen.has(key)) duplicates.push(r)
    else seen.set(key, r)
    dataRows.push(r)
  }

  const line = (r: number) => r + 1
  const list = (rs: number[]) =>
    rs.slice(0, 5).map(line).join(", ") +
    (rs.length > 5 ? ` i ${rs.length - 5} innych` : "")

  if (!dataRows.length)
    issues.push({
      severity: "error",
      message: "Plik nie zawiera wierszy z danymi pod nagłówkiem.",
    })
  if (totals.length)
    issues.push({
      severity: "info",
      message: `Pominięto ${totals.length} ${plural(totals.length, "wiersz", "wiersze", "wierszy")} podsumowania (Razem/Total), wiersz ${list(totals)}. Sumy liczymy sami z danych.`,
    })
  if (repeatedHeaders.length)
    issues.push({
      severity: "info",
      message: `Pominięto powtórzony nagłówek w wierszu ${list(repeatedHeaders)}.`,
    })
  if (duplicates.length)
    issues.push({
      severity: "warning",
      message: `${duplicates.length} ${plural(duplicates.length, "wiersz jest identyczny", "wiersze są identyczne", "wierszy jest identycznych")} z wcześniejszym (wiersz ${list(duplicates)}). Mogą to być zdublowane dane: możesz je pominąć poniżej.`,
    })

  // Numbers that do not parse, per mapped numeric column.
  for (const field of NUMERIC_FIELDS) {
    const col = mapping[field]
    if (col === undefined) continue
    const bad: number[] = []
    const negative: number[] = []
    for (const r of dataRows) {
      const cell = table.rows[r][col] ?? ""
      if (isNoData(cell)) continue
      const value = parseCellNumber(cell, table.format)
      if (value === null) bad.push(r)
      else if (value < 0 && (field === "clicks" || field === "impressions"))
        negative.push(r)
    }
    if (bad.length)
      issues.push({
        severity: "warning",
        message: `Kolumna „${columns[col]}” (${FIELDS[field].label}): ${bad.length} ${plural(bad.length, "wartość nie jest liczbą", "wartości nie są liczbami", "wartości nie jest liczbami")} (wiersz ${list(bad)}). Te komórki będą traktowane jako brak danych.`,
      })
    if (negative.length)
      issues.push({
        severity: "warning",
        message: `Kolumna „${columns[col]}” ma ujemne wartości (wiersz ${list(negative)}), czego Google Ads nie raportuje dla ${FIELDS[field].label.toLowerCase()}.`,
      })
  }

  // Period: date column first, then the line above the header.
  let period: ReportAnalysis["period"] = null
  const dateCol = mapping.date
  if (dateCol !== undefined) {
    const dates: string[] = []
    const invalid: number[] = []
    for (const r of dataRows) {
      const cell = table.rows[r][dateCol] ?? ""
      if (!cell) continue
      // XLSX dates may carry a time ("2026-10-01 00:00"); only the day matters.
      const d = parseReportDate(
        /^\d{4}-\d{2}-\d{2}/.test(cell) ? cell.slice(0, 10) : cell
      )
      if (d) dates.push(d)
      else invalid.push(r)
    }
    if (dates.length) {
      dates.sort()
      period = { from: dates[0], to: dates[dates.length - 1], source: "kolumna" }
    }
    if (invalid.length)
      issues.push({
        severity: "warning",
        message: `${invalid.length} ${plural(invalid.length, "data ma", "daty mają", "dat ma")} nierozpoznany format (wiersz ${list(invalid)}).`,
      })
  }
  if (!period) {
    const fromPreamble = periodFromPreamble(table.rows.slice(0, headerRow))
    if (fromPreamble) period = { ...fromPreamble, source: "nagłówek pliku" }
  }

  const has = (f: Field) => mapping[f] !== undefined
  const missingRequired = type ? REQUIRED[type].filter((f) => !has(f)) : []
  const missingUseful = type ? USEFUL[type].filter((f) => !has(f)) : []
  if (!type)
    issues.push({
      severity: "error",
      message: "Nie rozpoznano typu raportu. Wybierz go z listy albo przypisz kolumny.",
    })
  if (missingRequired.length)
    issues.push({
      severity: "error",
      message: `Brakuje kolumn potrzebnych do analizy: ${missingRequired.map((f) => FIELDS[f].label).join(", ")}. Przypisz je ręcznie albo dodaj do eksportu w Google Ads.`,
    })
  if (missingUseful.length)
    issues.push({
      severity: "info",
      message: `Bez kolumn: ${missingUseful.map((f) => FIELDS[f].label).join(", ")}. Analizy, które ich wymagają, zostaną pominięte.`,
    })
  if (!period && type)
    issues.push({
      severity: "info",
      message:
        "Nie znaleziono zakresu dat. Porównanie okresów nie będzie możliwe dla tego pliku.",
    })

  return {
    headerRow,
    columns,
    mapping,
    detection,
    type,
    dataRows,
    skipped: { totals, repeatedHeaders },
    duplicates,
    period,
    missingRequired,
    missingUseful,
    issues,
  }
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const d = n % 10
  const t = n % 100
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many
}

/** Mapping memory within one audit: files exported with the same columns reuse the user's choice. */
export const headerSignature = (columns: string[]) =>
  columns.map(normalizeHeader).join("|")

/** Records that will be analysed, after optionally dropping exact duplicates. */
export function recordCount(a: ReportAnalysis, skipDuplicates: boolean): number {
  return a.dataRows.length - (skipDuplicates ? a.duplicates.length : 0)
}

/** The import can be confirmed when every file has a type and its required columns. */
export const blockingIssues = (a: ReportAnalysis) =>
  a.issues.filter((i) => i.severity === "error")

/** Two files with the same columns and rows: most likely the same report imported twice. */
export function sameContent(a: SheetTable, b: SheetTable): boolean {
  return (
    a.rows.length === b.rows.length &&
    a.rows.every((row, i) => rowKey(row) === rowKey(b.rows[i]))
  )
}
