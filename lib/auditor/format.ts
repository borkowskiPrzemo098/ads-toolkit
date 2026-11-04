import { formatCurrency, formatNumber } from "@/lib/formatting/number"

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
