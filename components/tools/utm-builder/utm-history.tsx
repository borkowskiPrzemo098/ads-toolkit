"use client"

import { Check, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import type { UtmHistoryItem } from "@/lib/utm/history"

interface UtmHistoryProps {
  items: UtmHistoryItem[]
  onRemove: (id: string) => void
  onClear: () => void
}

const TIME = new Intl.DateTimeFormat("pl-PL", { timeStyle: "short" })

export function UtmHistory({ items, onRemove, onClear }: UtmHistoryProps) {
  const { copy, copiedId } = useCopy()

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-6 text-sm text-muted-foreground">
        Skopiowane linki pojawią się tutaj. Historia zostaje tylko w tej karcie
        przeglądarki i znika po jej zamknięciu.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {item.values.utm_campaign}{" "}
                <span className="font-normal text-muted-foreground">
                  · {item.values.utm_source} / {item.values.utm_medium} ·{" "}
                  {TIME.format(new Date(item.createdAt))}
                </span>
              </p>
              <p className="mt-1 font-mono text-xs leading-5 break-all text-muted-foreground">
                {item.url}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Kopiuj link"
              onClick={() => copy(item.url, item.id)}
            >
              {copiedId === item.id ? <Check /> : <Copy />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Usuń z historii"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        <Trash2 />
        Wyczyść historię
      </Button>
    </div>
  )
}
