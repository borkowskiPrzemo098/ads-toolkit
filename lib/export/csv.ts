export type CsvCell = string | number | null | undefined

/** Semicolon + comma decimals: what Excel expects in the Polish locale. */
const SEPARATOR = ";"
const BOM = "﻿"

/** Characters that make spreadsheet apps treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * Neutralises CSV/formula injection: a user-typed "=HYPERLINK(...)" is exported as text.
 * Only strings are guarded; numbers we format ourselves may be negative.
 */
export function guardFormula(text: string): string {
  return FORMULA_PREFIX.test(text) ? `'${text}` : text
}

export function formatCsvNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace(".", ",")
}

function encodeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ""
  const text = typeof cell === "number" ? formatCsvNumber(cell) : guardFormula(cell)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: CsvCell[][]): string {
  return BOM + rows.map((row) => row.map(encodeCell).join(SEPARATOR)).join("\r\n")
}
