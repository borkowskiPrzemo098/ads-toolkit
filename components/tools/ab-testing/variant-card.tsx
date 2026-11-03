"use client"

import { NumberField } from "@/components/forms/number-field"
import { Input } from "@/components/ui/input"
import { CURRENCY_SUFFIX, type Currency } from "@/lib/formatting/number"
import type { VariantField, VariantForm } from "@/lib/validators/ab-test"

interface VariantCardProps {
  letter: "A" | "B"
  color: string
  name: string
  onNameChange: (name: string) => void
  form: VariantForm
  onFieldChange: (field: VariantField, value: string) => void
  errors: Partial<Record<VariantField, string>>
  currency: Currency
}

export function VariantCard(props: VariantCardProps) {
  const { letter, color, form, errors } = props
  return (
    <section
      aria-label={`Wariant ${letter}`}
      className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.3),0_8px_24px_-12px_rgb(0_0_0/0.5)] sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-[#0b0d12] glow"
          style={{ background: color, "--glow": color } as React.CSSProperties}
        >
          {letter}
        </span>
        <Input
          aria-label={`Nazwa wariantu ${letter}`}
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          maxLength={40}
          className="font-medium"
        />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <NumberField
          label="Wizyty lub kliknięcia"
          value={form.visitors}
          onChange={(v) => props.onFieldChange("visitors", v)}
          placeholder="np. 1000"
          error={errors.visitors}
          className="col-span-2 sm:col-span-1"
        />
        <NumberField
          label="Konwersje"
          value={form.conversions}
          onChange={(v) => props.onFieldChange("conversions", v)}
          placeholder="np. 50"
          error={errors.conversions}
          className="col-span-2 sm:col-span-1"
        />
        <NumberField
          label="Koszt"
          suffix={CURRENCY_SUFFIX[props.currency]}
          value={form.cost}
          onChange={(v) => props.onFieldChange("cost", v)}
          placeholder="np. 500"
          error={errors.cost}
          optional
          hint="Do porównania CPA."
          className="col-span-2"
        />
      </div>
    </section>
  )
}
