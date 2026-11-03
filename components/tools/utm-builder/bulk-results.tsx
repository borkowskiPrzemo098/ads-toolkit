"use client"

import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import { formatNumber } from "@/lib/formatting/number"
import type { BulkRow } from "@/lib/utm/generate"

interface BulkResultsProps {
  rows: BulkRow[]
  /** Valid links copied together; they are added to the history. */
  onCopiedAll: (rows: BulkRow[]) => void
  hasFieldErrors: boolean
}

export function BulkResults({ rows, onCopiedAll, hasFieldErrors }: BulkResultsProps) {
  const { copy, copiedId } = useCopy()

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
        Wklej adresy stron, po jednym w wierszu, i uzupełnij parametry.
      </p>
    )
  }
  if (hasFieldErrors) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
        Uzupełnij źródło, medium i kampanię, a linki pojawią się tutaj.
      </p>
    )
  }

  const valid = rows.filter((r) => r.result.ok)
  const allText = valid.map((r) => (r.result.ok ? r.result.link.url : "")).join("\n")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular">
          <span className="font-semibold">{formatNumber(valid.length)}</span>{" "}
          <span className="text-muted-foreground">
            z {formatNumber(rows.length)} adresów gotowych
          </span>
        </p>
        <Button
          disabled={valid.length === 0}
          onClick={async () => {
            onCopiedAll(valid)
            await copy(allText, "all")
          }}
        >
          {copiedId === "all" ? <Check /> : <Copy />}
          {copiedId === "all" ? "Skopiowano" : "Kopiuj wszystkie"}
        </Button>
      </div>
      <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <li key={row.line} className="flex items-start gap-3 px-3.5 py-2.5">
            <span className="w-6 shrink-0 pt-0.5 text-xs text-muted-foreground tabular">
              {row.line}
            </span>
            {row.result.ok ? (
              <>
                <span className="min-w-0 flex-1 font-mono text-[13px] leading-6 break-all">
                  {row.result.link.url}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Kopiuj link z wiersza ${row.line}`}
                  onClick={() =>
                    row.result.ok && copy(row.result.link.url, `row-${row.line}`)
                  }
                >
                  {copiedId === `row-${row.line}` ? <Check /> : <Copy />}
                </Button>
              </>
            ) : (
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-mono text-[13px] break-all text-muted-foreground">
                  {row.input}
                </span>
                <span className="text-xs text-destructive">
                  {row.result.urlError ?? "Sprawdź parametry."}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
