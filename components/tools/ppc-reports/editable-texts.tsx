"use client"

import { useId } from "react"
import { Plus, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ReportTexts } from "@/lib/reports/insights"

type ListKey = "observations" | "conclusions" | "recommendations"

const LISTS: { key: ListKey; label: string; add: string }[] = [
  { key: "observations", label: "Najważniejsze obserwacje", add: "Dodaj obserwację" },
  { key: "conclusions", label: "Wnioski", add: "Dodaj wniosek" },
  {
    key: "recommendations",
    label: "Rekomendacje na kolejny okres",
    add: "Dodaj rekomendację",
  },
]

interface EditableTextsProps {
  texts: ReportTexts
  onChange: (texts: ReportTexts) => void
  edited: boolean
  onRegenerate: () => void
}

/** Generated from the data, fully editable: the analyst signs the report, not the tool. */
export function EditableTexts({
  texts,
  onChange,
  edited,
  onRegenerate,
}: EditableTextsProps) {
  const summaryId = useId()
  const setItem = (key: ListKey, index: number, value: string) =>
    onChange({ ...texts, [key]: texts[key].map((t, i) => (i === index ? value : t)) })

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Teksty powstały z liczb w raporcie. Dopisz kontekst, który znasz tylko Ty, np.
          zmiany na stronie albo w ofercie.
        </p>
        {edited && (
          <Button variant="ghost" size="sm" onClick={onRegenerate}>
            <Undo2 />
            Przywróć teksty z danych
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={summaryId} className="text-sm font-semibold">
          Podsumowanie
        </Label>
        <Textarea
          id={summaryId}
          value={texts.summary}
          onChange={(e) => onChange({ ...texts, summary: e.target.value })}
          className="min-h-20 text-sm leading-relaxed"
        />
      </div>

      {LISTS.map((list) => (
        <section key={list.key} aria-label={list.label} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{list.label}</h3>
          {texts[list.key].length === 0 && (
            <p className="text-xs text-muted-foreground">
              Brak pozycji. Sekcja nie trafi do raportu.
            </p>
          )}
          {texts[list.key].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Textarea
                aria-label={`${list.label}, pozycja ${i + 1}`}
                value={item}
                onChange={(e) => setItem(list.key, i, e.target.value)}
                className="min-h-10 text-sm leading-relaxed"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="mt-1"
                aria-label={`Usuń pozycję ${i + 1}`}
                onClick={() =>
                  onChange({
                    ...texts,
                    [list.key]: texts[list.key].filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...texts, [list.key]: [...texts[list.key], ""] })}
          >
            <Plus />
            {list.add}
          </Button>
        </section>
      ))}
    </div>
  )
}
