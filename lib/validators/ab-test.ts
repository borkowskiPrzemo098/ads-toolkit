import type { VariantInput } from "@/lib/calculations/ab-test"
import { parseNumericForm, type NumericRule } from "./numeric-form"

export type VariantField = keyof VariantInput
export type VariantForm = Record<VariantField, string>

export const EMPTY_VARIANT_FORM: VariantForm = { visitors: "", conversions: "", cost: "" }

/** The test counts people: visits and converting visits must be whole numbers. */
const RULES: Partial<Record<VariantField, NumericRule>> = {
  visitors: { integer: true },
  conversions: { integer: true },
}

export function validateVariantForm(form: VariantForm) {
  const { values, errors } = parseNumericForm(form, RULES)
  return { input: values as VariantInput, errors }
}
