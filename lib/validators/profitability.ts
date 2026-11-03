import { parseDecimal } from "@/lib/formatting/number"
import type { ProfitabilityInput } from "@/lib/calculations/profitability"

export type ProfitabilityField = keyof ProfitabilityInput
export type ProfitabilityForm = Record<ProfitabilityField, string>

export const EMPTY_PROFITABILITY_FORM: ProfitabilityForm = {
  adSpend: "",
  impressions: "",
  clicks: "",
  conversions: "",
  revenue: "",
  avgOrderValue: "",
  marginPercent: "",
  extraCosts: "",
  productCostPerConversion: "",
}

/** Fields that count whole events. Conversions stay decimal: Google Ads attribution splits them. */
const WHOLE_NUMBER_FIELDS: ProfitabilityField[] = ["impressions", "clicks"]

export interface ProfitabilityValidation {
  input: ProfitabilityInput
  errors: Partial<Record<ProfitabilityField, string>>
  /** Data that is valid but inconsistent or worth a second look. */
  warnings: string[]
}

export function validateProfitabilityForm(
  form: ProfitabilityForm
): ProfitabilityValidation {
  const errors: ProfitabilityValidation["errors"] = {}
  const input = {} as ProfitabilityInput

  for (const field of Object.keys(form) as ProfitabilityField[]) {
    const raw = form[field].trim()
    input[field] = null
    if (raw === "") continue

    const parsed = parseDecimal(raw)
    if (parsed === null) {
      errors[field] = "Wpisz liczbę, np. 1250 albo 1250,50."
    } else if (parsed < 0) {
      errors[field] = "Wartość nie może być ujemna."
    } else if (WHOLE_NUMBER_FIELDS.includes(field) && !Number.isInteger(parsed)) {
      errors[field] = "Wpisz liczbę całkowitą."
    } else if (field === "marginPercent" && parsed > 100) {
      errors[field] = "Marża nie może przekraczać 100%."
    } else {
      input[field] = parsed
    }
  }

  return { input, errors, warnings: consistencyWarnings(input) }
}

function consistencyWarnings(input: ProfitabilityInput): string[] {
  const warnings: string[] = []
  const { clicks, conversions, revenue, avgOrderValue, marginPercent } = input

  if (clicks !== null && conversions !== null && conversions > clicks) {
    warnings.push(
      "Konwersji jest więcej niż kliknięć. To możliwe przy kilku konwersjach na kliknięcie, ale sprawdź dane."
    )
  }
  if (
    revenue !== null &&
    avgOrderValue !== null &&
    conversions !== null &&
    conversions > 0
  ) {
    const implied = avgOrderValue * conversions
    if (Math.abs(implied - revenue) > Math.max(revenue, implied) * 0.02) {
      warnings.push(
        "Przychód różni się od iloczynu średniej wartości zamówienia i konwersji. Do ROAS liczymy podany przychód, do CPA podaną średnią."
      )
    }
  }
  if (marginPercent === 0) {
    warnings.push("Przy marży 0% każda złotówka wydana na reklamę jest stratą.")
  }
  return warnings
}
