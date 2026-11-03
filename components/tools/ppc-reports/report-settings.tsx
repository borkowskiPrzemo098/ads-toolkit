"use client"

import { useRef, useState } from "react"
import { ImageUp, Trash2 } from "lucide-react"
import { NumberField } from "@/components/forms/number-field"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { TextField } from "@/components/forms/text-field"
import { Button } from "@/components/ui/button"
import { CURRENCY_SUFFIX, type Currency } from "@/lib/formatting/number"
import type { ReportLogo } from "@/lib/reports/model"

export interface SettingsForm {
  clientName: string
  campaignName: string
  periodLabel: string
  comparisonLabel: string
  budget: string
  agencyName: string
  logo: ReportLogo | null
  currency: Currency
}

const MAX_LOGO_BYTES = 1024 * 1024

/** Reads a PNG or JPEG into a data URL with its pixel size. SVG is refused: jsPDF cannot embed it. */
function readLogo(file: File): Promise<ReportLogo> {
  return new Promise((resolve, reject) => {
    const format =
      file.type === "image/png" ? "PNG" : file.type === "image/jpeg" ? "JPEG" : null
    if (!format) return reject(new Error("Logo musi być w formacie PNG albo JPG."))
    if (file.size > MAX_LOGO_BYTES)
      return reject(new Error("Logo może mieć najwyżej 1 MB."))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onload = () =>
        resolve({
          dataUrl,
          format,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      image.onerror = () => reject(new Error("Plik nie jest poprawnym obrazem."))
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

interface ReportSettingsProps {
  value: SettingsForm
  onChange: (patch: Partial<SettingsForm>) => void
  budgetError: string | null
  hasComparison: boolean
}

export function ReportSettingsFields({
  value,
  onChange,
  budgetError,
  hasComparison,
}: ReportSettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nazwa klienta"
          required
          value={value.clientName}
          onChange={(clientName) => onChange({ clientName })}
          placeholder="np. Biegam.pl"
        />
        <TextField
          label="Nazwa kampanii"
          value={value.campaignName}
          onChange={(campaignName) => onChange({ campaignName })}
          placeholder="np. Wszystkie kampanie w wyszukiwarce"
        />
        <TextField
          label="Okres raportu"
          required
          value={value.periodLabel}
          onChange={(periodLabel) => onChange({ periodLabel })}
          placeholder="np. 1–31 października 2026"
          hint="Uzupełniamy z dat w pliku; możesz zmienić."
        />
        {hasComparison && (
          <TextField
            label="Okres porównawczy"
            required
            value={value.comparisonLabel}
            onChange={(comparisonLabel) => onChange({ comparisonLabel })}
            placeholder="np. 1–30 września 2026"
          />
        )}
        <NumberField
          label="Budżet na okres"
          value={value.budget}
          onChange={(budget) => onChange({ budget })}
          suffix={CURRENCY_SUFFIX[value.currency]}
          optional
          error={budgetError}
          hint="Pokażemy wykorzystanie budżetu."
        />
        <TextField
          label="Nazwa agencji"
          value={value.agencyName}
          onChange={(agencyName) => onChange({ agencyName })}
          placeholder="np. Twoja agencja"
        />
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Waluta</span>
          <SegmentedControl
            label="Waluta raportu"
            value={value.currency}
            onChange={(currency) => onChange({ currency })}
            options={[
              { value: "PLN", label: "PLN" },
              { value: "EUR", label: "EUR" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Logo agencji</span>
          <div className="flex items-center gap-3">
            {value.logo && (
              // eslint-disable-next-line @next/next/no-img-element -- local data URL, not an optimisable asset
              <img
                src={value.logo.dataUrl}
                alt="Logo agencji"
                className="h-10 max-w-32 rounded bg-white object-contain p-1"
              />
            )}
            <input
              ref={fileRef}
              aria-label="Wybierz plik z logo"
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              tabIndex={-1}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (!file) return
                try {
                  setLogoError(null)
                  onChange({ logo: await readLogo(file) })
                } catch (err) {
                  setLogoError(
                    err instanceof Error ? err.message : "Nie udało się wczytać logo."
                  )
                }
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImageUp />
              {value.logo ? "Zmień logo" : "Dodaj logo"}
            </Button>
            {value.logo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange({ logo: null })}
                aria-label="Usuń logo"
              >
                <Trash2 />
              </Button>
            )}
          </div>
          {logoError ? (
            <p role="alert" className="text-xs text-destructive">
              {logoError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">PNG lub JPG, do 1 MB.</p>
          )}
        </div>
      </div>
    </div>
  )
}
