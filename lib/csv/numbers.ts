/**
 * Parses numbers from Google Ads exports in any locale: "1 234,56 zł", "1,234.56", "12%",
 * "--" (no data). The last "," or "." followed by 1–2 digits is the decimal separator;
 * other separators are thousands. Returns null for empty or non-numeric cells.
 */
export function parseReportNumber(cell: string | undefined | null): number | null {
  if (cell === undefined || cell === null) return null
  let text = String(cell)
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(/(zł|pln|eur|€|\$|%)/gi, "")
    .replace("−", "-")
  if (text === "" || /^-+$/.test(text)) return null

  const decimal = text.match(/[.,](\d{1,2})$/)
  if (decimal) {
    const integer = text.slice(0, -decimal[0].length).replace(/[.,]/g, "")
    text = `${integer}.${decimal[1]}`
  } else {
    text = text.replace(/[.,]/g, "")
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}
