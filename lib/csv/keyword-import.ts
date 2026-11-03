import Papa from "papaparse"
import { stripDiacritics } from "@/lib/keywords/normalize"

/** Column headers used by Google Ads, Keyword Planner and common tools (PL and EN). */
const KEYWORD_HEADERS = [
  "keyword",
  "keywords",
  "search keyword",
  "search term",
  "search terms",
  "query",
  "slowo kluczowe",
  "slowa kluczowe",
  "wyszukiwane haslo",
  "haslo",
  "fraza",
  "zapytanie",
]

/** Report title and date lines sit above the header; look a few rows down. */
const HEADER_SEARCH_ROWS = 10

export interface ParsedTable {
  rows: string[][]
  /** Index of the header row, or null when the file has no recognisable header. */
  headerRow: number | null
  columnNames: string[]
  /** Suggested keyword column. */
  keywordColumn: number
}

const normalizeHeader = (h: string) =>
  stripDiacritics(h.trim().toLocaleLowerCase("pl-PL"))

export function parseKeywordTable(text: string): ParsedTable {
  const { data } = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" })
  const rows = data.map((row) => row.map((cell) => String(cell ?? "")))

  for (let r = 0; r < Math.min(rows.length, HEADER_SEARCH_ROWS); r++) {
    const column = rows[r].findIndex((cell) =>
      KEYWORD_HEADERS.includes(normalizeHeader(cell))
    )
    if (column !== -1) {
      return { rows, headerRow: r, columnNames: rows[r], keywordColumn: column }
    }
  }

  const width = Math.max(1, ...rows.map((row) => row.length))
  return {
    rows,
    headerRow: null,
    columnNames: Array.from({ length: width }, (_, i) => `Kolumna ${i + 1}`),
    keywordColumn: 0,
  }
}

/** Values of one column below the header. Totals rows from Google Ads exports are skipped. */
export function keywordColumnValues(table: ParsedTable, column: number): string[] {
  const start = table.headerRow === null ? 0 : table.headerRow + 1
  return table.rows
    .slice(start)
    .map((row) => row[column] ?? "")
    .filter((value) => !/^(total|razem|suma|łącznie)\b/i.test(value.trim()))
}
