"use client"

import { useId } from "react"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { SelectField } from "@/components/forms/select-field"
import { TextField } from "@/components/forms/text-field"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { NormalizeOptions, UtmKey, UtmValues } from "@/lib/utm/build"
import { UTM_TEMPLATES } from "@/lib/utm/templates"
import { cn } from "@/lib/utils"

export type UtmMode = "single" | "bulk"

const FIELDS: {
  key: UtmKey
  label: string
  placeholder: string
  hint: string
  required?: boolean
}[] = [
  {
    key: "utm_source",
    label: "Źródło (utm_source)",
    placeholder: "np. google, newsletter",
    hint: "Skąd przychodzi ruch.",
    required: true,
  },
  {
    key: "utm_medium",
    label: "Medium (utm_medium)",
    placeholder: "np. cpc, email",
    hint: "Typ kanału; od niego zależy kanał w GA4.",
    required: true,
  },
  {
    key: "utm_campaign",
    label: "Kampania (utm_campaign)",
    placeholder: "np. black_friday_2026",
    hint: "Nazwa, po której znajdziesz kampanię w raportach.",
    required: true,
  },
  {
    key: "utm_term",
    label: "Słowo kluczowe (utm_term)",
    placeholder: "np. {keyword}",
    hint: "Zwykle słowo kluczowe w kampaniach płatnych.",
  },
  {
    key: "utm_content",
    label: "Treść (utm_content)",
    placeholder: "np. baner_glowny",
    hint: "Odróżnia linki prowadzące w to samo miejsce.",
  },
]

const SPACE_OPTIONS: { value: NormalizeOptions["spaces"]; label: string }[] = [
  { value: "_", label: "Podkreślnik: jesien_2026" },
  { value: "-", label: "Myślnik: jesien-2026" },
  { value: "%20", label: "Zostaw spacje (%20)" },
]

interface UtmFormProps {
  mode: UtmMode
  onModeChange: (mode: UtmMode) => void
  url: string
  onUrlChange: (url: string) => void
  bulkText: string
  onBulkTextChange: (text: string) => void
  urlError: string | null
  values: UtmValues
  onValueChange: (key: UtmKey, value: string) => void
  fieldErrors: Partial<Record<UtmKey, string>>
  templateId: string | null
  onTemplate: (id: string) => void
  normalize: NormalizeOptions
  onNormalizeChange: (patch: Partial<NormalizeOptions>) => void
}

export function UtmForm(props: UtmFormProps) {
  const bulkId = useId()
  const template = UTM_TEMPLATES.find((t) => t.id === props.templateId)

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="Tryb"
        value={props.mode}
        onChange={props.onModeChange}
        options={[
          { value: "single", label: "Jeden link" },
          { value: "bulk", label: "Wiele linków" },
        ]}
        className="flex w-full [&>button]:flex-1"
      />

      {props.mode === "single" ? (
        <TextField
          label="Adres strony"
          required
          mono
          inputMode="url"
          value={props.url}
          onChange={props.onUrlChange}
          placeholder="https://sklep.pl/buty-do-biegania"
          error={props.urlError}
          hint="Istniejące parametry w adresie zostaną zachowane."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={bulkId} className="text-sm font-medium">
            Adresy stron, po jednym w wierszu
          </Label>
          <Textarea
            id={bulkId}
            value={props.bulkText}
            onChange={(e) => props.onBulkTextChange(e.target.value)}
            spellCheck={false}
            placeholder={"https://sklep.pl/buty\nhttps://sklep.pl/kurtki?kolor=czarny"}
            className="[field-sizing:fixed] h-36 resize-y font-mono text-[13px] leading-6"
          />
          <p className="text-xs text-muted-foreground">
            Każdy adres dostanie te same parametry UTM.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Szablon</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Szablony UTM">
          {UTM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={props.templateId === t.id}
              onClick={() => props.onTemplate(t.id)}
              className={cn(
                "h-8 rounded-lg border px-3 text-sm transition-colors duration-150",
                props.templateId === t.id
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-card text-[#c9cfdb] hover:border-[#3a4456] hover:bg-[#141925]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {template
            ? template.hint
            : "Szablon wypełnia typowe pola. Każde możesz potem zmienić."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <TextField
            key={field.key}
            className={
              field.required && field.key !== "utm_campaign" ? undefined : "sm:col-span-2"
            }
            label={field.label}
            required={field.required}
            mono
            value={props.values[field.key]}
            onChange={(value) => props.onValueChange(field.key, value)}
            placeholder={field.placeholder}
            hint={field.hint}
            error={props.fieldErrors[field.key]}
          />
        ))}
      </div>

      <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
        <legend className="sr-only">Porządkowanie wartości</legend>
        <p className="text-sm font-medium">Porządkowanie wartości</p>
        <ToggleRow
          label="Małe litery"
          hint="GA4 traktuje „Google” i „google” jako dwa różne źródła."
          checked={props.normalize.lowercase}
          onChange={(lowercase) => props.onNormalizeChange({ lowercase })}
        />
        <ToggleRow
          label="Bez polskich znaków"
          hint="ą → a, ł → l. Krótsze i czytelniejsze linki."
          checked={props.normalize.stripDiacritics}
          onChange={(stripDiacritics) => props.onNormalizeChange({ stripDiacritics })}
        />
        <SelectField
          label="Spacje w wartościach"
          value={props.normalize.spaces}
          options={SPACE_OPTIONS}
          onChange={(spaces) => props.onNormalizeChange({ spaces })}
        />
      </fieldset>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  )
}
