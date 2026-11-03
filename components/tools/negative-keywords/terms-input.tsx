"use client"

import { useId } from "react"
import { ScanSearch } from "lucide-react"
import {
  FileImportField,
  ListTextarea,
  useListImport,
} from "@/components/forms/list-import"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SearchTerm } from "@/lib/calculations/negative-keywords"
import {
  detectMetricColumns,
  METRIC_LABEL,
  searchTermsFromTable,
} from "@/lib/csv/search-terms-import"

export interface TermsInputValue {
  text: string
  /** Terms with metrics from an imported report; null for a pasted list. */
  importedTerms: SearchTerm[] | null
  offerWords: string
  competitors: string
  customWords: string
}

interface TermsInputProps {
  value: TermsInputValue
  onChange: (patch: Partial<TermsInputValue>) => void
  onAnalyze: () => void
  stale: boolean
}

export function TermsInput({ value, onChange, onAnalyze, stale }: TermsInputProps) {
  const listImport = useListImport({
    onText: (text) => onChange({ text, importedTerms: null }),
    onTable: ({ table, column }) => {
      const terms = searchTermsFromTable(table, column, detectMetricColumns(table))
      onChange({ text: terms.map((t) => t.term).join("\n"), importedTerms: terms })
    },
  })

  const recognised = listImport.imported
    ? Object.keys(detectMetricColumns(listImport.imported.table)).map(
        (k) => METRIC_LABEL[k as keyof typeof METRIC_LABEL]
      )
    : []

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="flex flex-col gap-5">
        <ListTextarea
          label="Wyszukiwane hasła"
          value={value.text}
          onChange={(text) => onChange({ text, importedTerms: null })}
          listImport={listImport}
          placeholder={
            "Wklej hasła z raportu wyszukiwanych haseł, po jednym w wierszu:\npraca w sklepie obuwniczym\nbuty do biegania za darmo\njak wyczyścić buty zamszowe"
          }
          hint="Najlepiej zaimportuj raport z Google Ads: zobaczysz wtedy koszt i konwersje każdej sugestii."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <ListField
            label="Twoja oferta"
            hint="Te słowa nigdy nie trafią do wykluczeń. Na ich podstawie znajdziemy niepowiązane zapytania."
            placeholder="np. buty, obuwie, sneakersy"
            value={value.offerWords}
            onChange={(offerWords) => onChange({ offerWords })}
          />
          <ListField
            label="Konkurencja"
            hint="Nazwy firm, których zapytań nie chcesz."
            placeholder="np. CCC, Deichmann"
            value={value.competitors}
            onChange={(competitors) => onChange({ competitors })}
          />
          <ListField
            label="Twoje niepożądane słowa"
            hint="Słowa i zwroty, które już wiesz, że chcesz wykluczyć."
            placeholder="np. hurtownia, allegro"
            value={value.customWords}
            onChange={(customWords) => onChange({ customWords })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <FileImportField
          listImport={listImport}
          columnLabel="Kolumna z wyszukiwanymi hasłami"
          hint="Raport wyszukiwanych haseł z Google Ads (CSV), do 5 MB. Plik zostaje na Twoim komputerze."
          detail={
            <p className="text-xs text-muted-foreground">
              {recognised.length
                ? `Rozpoznane dane: ${recognised.join(", ").toLowerCase()}.`
                : "Nie rozpoznaliśmy kolumn z kosztem ani konwersjami."}
            </p>
          }
        />
        <Button size="lg" onClick={onAnalyze} disabled={!value.text.trim()}>
          <ScanSearch />
          {stale ? "Szukaj ponownie" : "Znajdź sugestie"}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Nic nie trafi na listę wykluczeń bez Twojej akceptacji. Ponowne wyszukanie
          zachowuje decyzje dla sugestii, które się powtarzają.
        </p>
      </div>
    </div>
  )
}

function ListField({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs leading-snug text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}
