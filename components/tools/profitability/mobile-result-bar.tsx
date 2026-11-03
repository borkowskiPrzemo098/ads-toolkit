"use client"

import { useEffect, useState } from "react"
import { ArrowDown } from "lucide-react"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { formatCurrency, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

interface MobileResultBarProps {
  result: ProfitabilityResult
  currency: Currency
  targetId: string
}

/**
 * Phones show the form first, so this bar keeps the net profit in view while typing.
 * It hides once the results section itself is on screen.
 */
export function MobileResultBar({ result, currency, targetId }: MobileResultBarProps) {
  const [resultsVisible, setResultsVisible] = useState(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return
    const observer = new IntersectionObserver(([entry]) =>
      setResultsVisible(entry.isIntersecting)
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  if (!result.netProfit.ok || resultsVisible) return null

  const profit = result.netProfit.value
  return (
    <a
      href={`#${targetId}`}
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-xl border border-[#2f3848] bg-popover/95 px-4 py-3 shadow-[0_8px_30px_rgb(0_0_0/0.5)] backdrop-blur-md lg:hidden"
    >
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">Zysk netto</span>
        <span
          className={cn(
            "text-lg font-semibold tabular",
            result.status === "profit" && "text-success",
            result.status === "loss" && "text-destructive"
          )}
        >
          {formatCurrency(profit, currency)}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-[#b3a9ff]">
        Zobacz wyniki
        <ArrowDown className="size-4" aria-hidden="true" />
      </span>
    </a>
  )
}
