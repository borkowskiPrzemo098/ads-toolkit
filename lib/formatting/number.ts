export type Currency = "PLN" | "EUR"

const LOCALE = "pl-PL"

/** Typographic minus (U+2212) instead of the hyphen Intl emits; reads better in tabular figures. */
const withMinus = (text: string) => text.replace("-", "−")

function format(value: number, digits: number, options: Intl.NumberFormatOptions = {}) {
  return withMinus(
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      // "negative" never prints "-0,00" for values that round to zero.
      signDisplay: "negative",
      ...options,
    }).format(value)
  )
}

export function formatCurrency(
  value: number,
  currency: Currency = "PLN",
  digits = 2
): string {
  return format(value, digits, { style: "currency", currency })
}

/** `value` is already a percentage, e.g. 412.5 → "412,5%". */
export function formatPercent(value: number, digits = 1): string {
  return `${format(value, digits)}%`
}

export function formatNumber(value: number, digits = 0): string {
  return format(value, digits)
}

/**
 * Parses user input in Polish or English notation: "1 234,50", "1234.5", "25%".
 * Returns null for empty or non-numeric input.
 */
export function parseDecimal(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[\s %]/g, "")
    .replace("−", "-")
    .replace(",", ".")
  if (cleaned === "" || !/^-?\d*\.?\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}
