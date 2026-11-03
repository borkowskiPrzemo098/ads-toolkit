export type Currency = "PLN" | "EUR"

const LOCALE = "pl-PL"

export function formatCurrency(
  value: number,
  currency: Currency = "PLN",
  digits = 2
): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** `value` is already a percentage, e.g. 412.5 → "412,5%". */
export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}%`
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Parses user input in Polish or English notation: "1 234,50", "1234.5", "25%".
 * Returns null for empty or non-numeric input.
 */
export function parseDecimal(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[\s\u00a0%]/g, "")
    .replace(",", ".")
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
