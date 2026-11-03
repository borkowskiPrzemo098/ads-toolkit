"use client"

import { RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SavedVariant } from "@/lib/export/budget-planner"
import { formatMetric } from "@/lib/formatting/metric"
import { formatCurrency, formatPercent, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

interface VariantsTableProps {
  variants: SavedVariant[]
  currency: Currency
  onRestore: (variant: SavedVariant) => void
  onRemove: (id: string) => void
}

export function VariantsTable({
  variants,
  currency,
  onRestore,
  onRemove,
}: VariantsTableProps) {
  if (variants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-5 text-sm text-muted-foreground">
        Zapisz bieżący plan jako wariant, zmień budżet albo CPC i zapisz kolejny. Warianty
        porównasz tutaj obok siebie. Znikną po zamknięciu karty.
      </p>
    )
  }

  const bestProfit = Math.max(
    ...variants.map((v) => (v.forecast.profit.ok ? v.forecast.profit.value : -Infinity))
  )
  const money = (v: number | null) => (v === null ? "—" : formatCurrency(v, currency))

  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 text-left font-medium">
              Wariant
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Budżet
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              CPC
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Konwersja
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Przychód
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Zysk
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              ROAS
            </th>
            <th scope="col" className="py-2 pl-2">
              <span className="sr-only">Akcje</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {variants.map((v) => {
            const profit = v.forecast.profit
            const best = profit.ok && profit.value === bestProfit && variants.length > 1
            return (
              <tr key={v.id}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {v.name}
                  {best && (
                    <span className="ml-2 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                      najwyższy zysk
                    </span>
                  )}
                </th>
                <td className="px-2 py-2 text-right tabular">{money(v.input.budget)}</td>
                <td className="px-2 py-2 text-right tabular">{money(v.input.cpc)}</td>
                <td className="px-2 py-2 text-right tabular">
                  {v.input.conversionRatePercent === null
                    ? "—"
                    : formatPercent(v.input.conversionRatePercent, 1)}
                </td>
                <td className="px-2 py-2 text-right tabular">
                  {formatMetric(v.forecast.revenue, "currency", currency) ?? "—"}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right font-medium tabular",
                    profit.ok && profit.value > 0 && "text-success",
                    profit.ok && profit.value < 0 && "text-destructive"
                  )}
                >
                  {formatMetric(profit, "currency", currency) ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular">
                  {formatMetric(v.forecast.roas, "percent", currency) ?? "—"}
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Wczytaj ${v.name}`}
                    title="Wczytaj do formularza"
                    onClick={() => onRestore(v)}
                  >
                    <RotateCcw />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Usuń ${v.name}`}
                    title="Usuń wariant"
                    onClick={() => onRemove(v.id)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
