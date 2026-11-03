"use client"

import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import type { NegativeList } from "@/lib/calculations/negative-keywords"
import { negativePlainList } from "@/lib/export/negative-keywords"
import { formatNumber } from "@/lib/formatting/number"

/** The final list exactly as it will be exported, built from accepted suggestions only. */
export function NegativeListPanel({ list }: { list: NegativeList }) {
  const { copy: copyText, copiedId, failed } = useCopy()
  const copied = copiedId === "list"
  const text = negativePlainList(list)
  const copy = () => copyText(text, "list")

  if (list.entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-6 text-sm leading-relaxed text-muted-foreground">
        Lista jest pusta. Kliknij „Wyklucz” przy sugestiach, które chcesz dodać. Bez
        Twojej decyzji nic tu nie trafi.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular">
          <span className="font-semibold">{formatNumber(list.entries.length)}</span>{" "}
          <span className="text-muted-foreground">wykluczeń</span>
        </p>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Skopiowano" : "Kopiuj listę"}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          Przeglądarka zablokowała schowek. Zaznacz listę poniżej i skopiuj ją ręcznie.
        </p>
      )}
      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-[13px] leading-6 whitespace-pre-wrap text-[#c9cfdb]">
        {text}
      </pre>
      {(list.duplicatesRemoved > 0 || list.rejected.length > 0) && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {list.duplicatesRemoved > 0 && (
            <li>Usunięto {formatNumber(list.duplicatesRemoved)} powtórzeń.</li>
          )}
          {list.rejected.map((r) => (
            <li key={r.text} className="text-[#f7cf7c]">
              Pominięto „{r.text}”: {r.reason}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Wklej listę w Google Ads: Słowa kluczowe › Wykluczające słowa kluczowe. Symbole
        &quot;…&quot; i […] ustawiają typ dopasowania.
      </p>
    </div>
  )
}
