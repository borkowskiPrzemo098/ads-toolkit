import type { ProfitabilityInput } from "@/lib/calculations/profitability"
import { parseNumericForm, type NumericRule } from "./numeric-form"

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

/** Impressions and clicks are whole events. Conversions stay decimal: attribution splits them. */
const RULES: Partial<Record<ProfitabilityField, NumericRule>> = {
  impressions: { integer: true },
  clicks: { integer: true },
  marginPercent: { max: 100, maxMessage: "Marża nie może przekraczać 100%." },
}

export interface ProfitabilityValidation {
  input: ProfitabilityInput
  errors: Partial<Record<ProfitabilityField, string>>
  /** Data that is valid but inconsistent or worth a second look. */
  warnings: string[]
}

export function validateProfitabilityForm(
  form: ProfitabilityForm
): ProfitabilityValidation {
  const { values: input, errors } = parseNumericForm(form, RULES)
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
