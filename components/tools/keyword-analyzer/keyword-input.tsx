"use client"

import { useId } from "react"
import { LoaderCircle, ScanSearch } from "lucide-react"
import {
  FileImportField,
  ListTextarea,
  useListImport,
} from "@/components/forms/list-import"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SEPARATOR_OPTIONS } from "@/constants/keyword-analyzer"
import { MAX_KEYWORDS, type Separator } from "@/lib/calculations/keyword-analyzer"
import { keywordColumnValues } from "@/lib/csv/keyword-import"
import { formatNumber } from "@/lib/formatting/number"

interface KeywordInputProps {
  text: string
  onTextChange: (text: string) => void
  separator: Separator
  onSeparatorChange: (separator: Separator) => void
  brands: string
  onBrandsChange: (brands: string) => void
  onAnalyze: () => void
  busy: boolean
  /** True when the list changed since the last analysis. */
  stale: boolean
}

export function KeywordInput(props: KeywordInputProps) {
  const { text, onTextChange, separator, onSeparatorChange, brands, onBrandsChange } =
    props
  const brandsId = useId()
  const listImport = useListImport({
    onText: onTextChange,
    onTable: ({ table, column }) => {
      onTextChange(keywordColumnValues(table, column).join("\n"))
      onSeparatorChange("newline")
    },
  })

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <ListTextarea
        label="Lista słów kluczowych"
        value={text}
        onChange={onTextChange}
        listImport={listImport}
        placeholder={
          "Wklej frazy, po jednej w wierszu:\nbuty do biegania damskie\ntanie buty do biegania\njak wybrać buty do biegania"
        }
        hint={`Do ${formatNumber(MAX_KEYWORDS)} fraz. Wiersze skopiowane z arkusza: bierzemy pierwszą kolumnę. Plik możesz też przeciągnąć na pole.`}
      />

      <div className="flex flex-col gap-5">
        <FileImportField
          listImport={listImport}
          columnLabel="Kolumna ze słowami kluczowymi"
          hint="Eksport z Planera słów kluczowych lub raport Google Ads, do 5 MB. Plik zostaje na Twoim komputerze."
        />

        <SelectField
          label="Rozdzielanie fraz"
          value={separator}
          onChange={onSeparatorChange}
          options={SEPARATOR_OPTIONS}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={brandsId} className="text-sm font-medium">
            Marki <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
          </Label>
          <Input
            id={brandsId}
            value={brands}
            onChange={(e) => onBrandsChange(e.target.value)}
            placeholder="np. Nike, Adidas, Twoja marka"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Oddziel przecinkami. Bez tej listy narzędzie nie rozpozna marek.
          </p>
        </div>

        <Button size="lg" onClick={props.onAnalyze} disabled={!text.trim() || props.busy}>
          {props.busy ? <LoaderCircle className="animate-spin" /> : <ScanSearch />}
          {props.busy
            ? "Analizuję"
            : props.stale
              ? "Analizuj ponownie"
              : "Analizuj listę"}
        </Button>
      </div>
    </div>
  )
}
