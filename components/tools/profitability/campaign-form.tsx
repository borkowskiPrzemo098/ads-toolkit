"use client"

import { useId } from "react"
import { TriangleAlert } from "lucide-react"
import { NumberField } from "@/components/forms/number-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PROFITABILITY_FIELD_GROUPS } from "@/constants/profitability"
import type { Currency } from "@/lib/formatting/number"
import type {
  ProfitabilityField,
  ProfitabilityForm,
  ProfitabilityValidation,
} from "@/lib/validators/profitability"

export const CURRENCY_SUFFIX: Record<Currency, string> = { PLN: "zł", EUR: "€" }

interface CampaignFormProps {
  name: string
  onNameChange: (name: string) => void
  form: ProfitabilityForm
  onFieldChange: (field: ProfitabilityField, value: string) => void
  validation: ProfitabilityValidation
  currency: Currency
}

export function CampaignForm({
  name,
  onNameChange,
  form,
  onFieldChange,
  validation,
  currency,
}: CampaignFormProps) {
  const nameId = useId()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId} className="text-sm font-medium">
          Nazwa kampanii
        </Label>
        <Input
          id={nameId}
          value={name}
          maxLength={80}
          onChange={(e) => onNameChange(e.target.value)}
          autoComplete="off"
        />
      </div>

      {PROFITABILITY_FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-4">
          <legend className="mb-3 text-xs font-medium text-muted-foreground">
            {group.title}
          </legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {group.fields.map((field) => (
              <NumberField
                key={field.key}
                className={field.hint ? "col-span-2" : undefined}
                label={field.label}
                value={form[field.key]}
                onChange={(value) => onFieldChange(field.key, value)}
                placeholder={field.placeholder}
                suffix={
                  field.unit === "currency"
                    ? CURRENCY_SUFFIX[currency]
                    : (field.unit ?? undefined)
                }
                hint={field.hint}
                optional={field.optional}
                error={validation.errors[field.key]}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {validation.warnings.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {validation.warnings.map((warning) => (
            <li
              key={warning}
              className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed text-[#f7cf7c]"
            >
              <TriangleAlert
                className="mt-px size-3.5 shrink-0 text-warning"
                aria-hidden="true"
              />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
