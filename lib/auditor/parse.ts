import Papa from "papaparse"
import { decodeText } from "@/lib/csv/read-file"

/** One worksheet or CSV file as text cells; numbers from XLSX are canonical ("1234.5"). */
export interface SheetTable {
  format: "csv" | "xlsx"
  /** CSV only: the separator that was detected. */
  delimiter?: "," | ";" | "\t"
  encoding?: "utf-8" | "utf-16"
  rows: string[][]
}

export class ImportError extends Error {}

const DELIMITERS = [",", ";", "\t"] as const

/** Limits against oversized or decompression-bomb files; both are far above real exports. */
export const MAX_AUDIT_FILE_BYTES = 50 * 1024 * 1024
export const MAX_ROWS = 300_000

export function isXlsx(bytes: Uint8Array): boolean {
  // XLSX is a ZIP archive: "PK\x03\x04".
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/**
 * Picks the separator that splits the first lines into the same number of columns most often.
 * Google Ads exports: "," (CSV), "\t" (TSV and "Excel CSV" in UTF-16), ";" after re-saving in a
 * Polish Excel. Quoted cells are respected, so "1 234,56" inside quotes is not a split.
 */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 30)
  let best: { d: "," | ";" | "\t"; score: number } = { d: ",", score: -1 }
  for (const d of DELIMITERS) {
    const counts = lines.map((line) => splitCount(line, d)).filter((c) => c > 0)
    if (!counts.length) continue
    // Most common column count, weighted by how many lines share it.
    const freq = new Map<number, number>()
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1)
    const [cols, lines_] = [...freq].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    const score = lines_ * 1000 + cols
    if (score > best.score) best = { d, score }
  }
  return best.d
}

function splitCount(line: string, d: string): number {
  let count = 0
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === d && !quoted) count++
  }
  return count
}

export function parseCsv(bytes: Uint8Array): SheetTable {
  const encoding =
    (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
      ? "utf-16"
      : "utf-8"
  const text = decodeText(bytes)
  if (text.includes("\u0000"))
    throw new ImportError("Plik wygląda na binarny, a nie na raport CSV.")
  const delimiter = detectDelimiter(text)
  const { data } = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: "greedy" })
  if (data.length > MAX_ROWS)
    throw new ImportError(`Plik ma ponad ${MAX_ROWS.toLocaleString("pl-PL")} wierszy.`)
  return {
    format: "csv",
    delimiter,
    encoding,
    rows: data.map((row) => row.map((cell) => String(cell ?? "").trim())),
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** XLSX cells to text: numbers stay canonical, dates become ISO (the parser reads both). */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    const d = value
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    return d.getUTCHours() || d.getUTCMinutes()
      ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
      : date
  }
  return String(value).trim()
}

/** Uncompressed size an XLSX may expand to; real Google Ads exports stay far below. */
export const MAX_XLSX_UNCOMPRESSED = 400 * 1024 * 1024

/**
 * Sum of uncompressed sizes declared in the ZIP central directory, read before anything is
 * inflated. Returns null when the archive structure cannot be read (or uses ZIP64).
 * Guards against "zip bombs": a small file that would expand to gigabytes in memory.
 */
export function declaredZipSize(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // End of central directory: signature 0x06054b50, within the last 64 KB + 22 bytes.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const entries = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  let total = 0
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50)
      return null
    const size = view.getUint32(offset + 24, true)
    if (size === 0xffffffff) return null
    total += size
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
  }
  return total
}

export async function parseXlsx(bytes: Uint8Array): Promise<SheetTable> {
  const declared = declaredZipSize(bytes)
  if (declared === null)
    throw new ImportError(
      "Plik XLSX ma nieprawidłową strukturę. Wyeksportuj raport ponownie."
    )
  if (declared > MAX_XLSX_UNCOMPRESSED)
    throw new ImportError(
      "Plik XLSX po rozpakowaniu przekracza 400 MB. Zawęź zakres raportu w Google Ads."
    )
  // Loaded only when an XLSX file is imported.
  const { readSheet } = await import("read-excel-file/universal")
  let sheet
  try {
    sheet = await readSheet<string>(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      { parseNumber: (s: string) => s }
    )
  } catch {
    throw new ImportError(
      "Nie udało się odczytać pliku XLSX. Sprawdź, czy nie jest uszkodzony."
    )
  }
  if (sheet.length > MAX_ROWS)
    throw new ImportError(`Arkusz ma ponad ${MAX_ROWS.toLocaleString("pl-PL")} wierszy.`)
  const rows = sheet
    .map((row) => row.map(cellText))
    .filter((row) => row.some((cell) => cell !== ""))
  return { format: "xlsx", rows }
}

/** Any supported file to rows. Format comes from the content, not the extension. */
export async function parseSheet(bytes: Uint8Array): Promise<SheetTable> {
  if (bytes.byteLength === 0) throw new ImportError("Plik jest pusty.")
  if (bytes.byteLength > MAX_AUDIT_FILE_BYTES)
    throw new ImportError(
      "Plik jest większy niż 50 MB. Zawęź zakres raportu w Google Ads."
    )
  return isXlsx(bytes) ? parseXlsx(bytes) : parseCsv(bytes)
}
