import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from "@/lib/formatting/number"

/**
 * Money in the report's own currency. Unknown currency: the number alone, never a guessed
 * "zł". Other codes (USD…) are printed after the amount.
 */
export function formatMoney(value: number, currency: string | null, digits = 2): string {
  if (currency === "PLN" || currency === "EUR")
    return formatCurrency(value, currency, digits)
  const n = formatNumber(value, digits)
  return currency ? `${n} ${currency}` : n
}

const COMPACT = new Intl.NumberFormat("pl-PL", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** Axis labels: "12 tys. zł", or "12 tys." when the currency is unknown. */
export function formatCompactMoney(value: number, currency: string | null): string {
  if (currency === "PLN" || currency === "EUR")
    return formatCompactCurrency(value, currency)
  return currency ? `${COMPACT.format(value)} ${currency}` : COMPACT.format(value)
}

export const formatCompactNumber = (value: number) => COMPACT.format(value)
