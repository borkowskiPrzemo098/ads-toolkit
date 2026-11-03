import { formatNumber, parseDecimal } from "@/lib/formatting/number"

export interface NumericRule {
  integer?: boolean
  /** Inclusive lower bound. Defaults to 0: tool inputs are never negative. */
  min?: number
  /** Exclusive lower bound, for values that must be strictly positive. */
  greaterThan?: number
  /** Inclusive upper bound. */
  max?: number
  /** Message for `max`, e.g. "Marża nie może przekraczać 100%." */
  maxMessage?: string
}

export interface NumericFormResult<K extends string> {
  /** Parsed values; empty or invalid fields are null. */
  values: Record<K, number | null>
  errors: Partial<Record<K, string>>
}

/**
 * Parses a form of raw strings into numbers, one rule per field. Empty fields are not errors:
 * calculations decide what is required and explain what is missing.
 */
export function parseNumericForm<K extends string>(
  form: Record<K, string>,
  rules: Partial<Record<K, NumericRule>> = {}
): NumericFormResult<K> {
  const values = {} as Record<K, number | null>
  const errors: Partial<Record<K, string>> = {}

  for (const field of Object.keys(form) as K[]) {
    values[field] = null
    const raw = form[field].trim()
    if (raw === "") continue

    const rule = rules[field] ?? {}
    const min = rule.min ?? 0
    const parsed = parseDecimal(raw)

    if (parsed === null) errors[field] = "Wpisz liczbę, np. 1250 albo 1250,50."
    else if (parsed < min)
      errors[field] =
        min === 0 ? "Wartość nie może być ujemna." : `Minimum to ${formatNumber(min)}.`
    else if (rule.greaterThan !== undefined && parsed <= rule.greaterThan)
      errors[field] = `Wartość musi być większa niż ${formatNumber(rule.greaterThan)}.`
    else if (rule.integer && !Number.isInteger(parsed))
      errors[field] = "Wpisz liczbę całkowitą."
    else if (rule.max !== undefined && parsed > rule.max)
      errors[field] = rule.maxMessage ?? `Maksimum to ${formatNumber(rule.max)}.`
    else values[field] = parsed
  }

  return { values, errors }
}
