/**
 * Dates as Google Ads exports them, in Polish or English UI: "2026-10-01", "01.10.2026",
 * "2026/10/01", "1 paź 2026", "Oct 1, 2026". Returns ISO "YYYY-MM-DD" or null.
 */

/** Month abbreviations; full names ("października") match on their first three letters. */
const MONTHS: Record<string, number> = {
  sty: 1,
  lut: 2,
  mar: 3,
  kwi: 4,
  maj: 5,
  cze: 6,
  lip: 7,
  sie: 8,
  wrz: 9,
  paz: 10,
  paź: 10,
  lis: 11,
  gru: 12,
  jan: 1,
  feb: 2,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const pad = (n: number) => String(n).padStart(2, "0")

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejects 31.02 and similar: the date object would roll over to the next month.
  if (date.getUTCMonth() !== month - 1) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const monthOf = (word: string) =>
  MONTHS[word.toLowerCase().slice(0, 3)] ?? MONTHS[word.toLowerCase()]

export function parseReportDate(cell: string): string | null {
  const text = cell.trim().replace(/\.$/, "")
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
  if (m) return iso(+m[3], +m[2], +m[1])
  // "1 paź 2026", "1 października 2026"
  m = text.match(/^(\d{1,2})\s+([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\.?\s+(\d{4})$/)
  if (m && monthOf(m[2])) return iso(+m[3], monthOf(m[2]), +m[1])
  // "Oct 1, 2026"
  m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (m && monthOf(m[1])) return iso(+m[3], monthOf(m[1]), +m[2])
  return null
}

const LONG = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const SHORT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

const toDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`)

/** "1–31 października 2026" style label for a date range. */
export function formatPeriod(from: string, to: string): string {
  if (from === to) return LONG.format(toDate(from))
  return `${LONG.format(toDate(from))} – ${LONG.format(toDate(to))}`
}

/** "1 paź" for chart axes. */
export function formatShortDate(isoDate: string): string {
  return SHORT.format(toDate(isoDate))
}
