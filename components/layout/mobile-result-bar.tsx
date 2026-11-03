"use client"

import { useEffect, useState } from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileResultBarProps {
  label: string
  /** Formatted headline value; the bar hides while it is null. */
  value: string | null
  tone?: "good" | "bad"
  targetId: string
}

/**
 * Phones show the form first, so this bar keeps the headline result in view while typing.
 * It hides once the results section itself is on screen.
 */
export function MobileResultBar({ label, value, tone, targetId }: MobileResultBarProps) {
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

  if (value === null || resultsVisible) return null

  return (
    <a
      href={`#${targetId}`}
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-xl border border-[#2f3848] bg-popover/95 px-4 py-3 shadow-[0_8px_30px_rgb(0_0_0/0.5)] backdrop-blur-md lg:hidden"
    >
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-lg font-semibold tabular",
            tone === "good" && "text-success",
            tone === "bad" && "text-destructive"
          )}
        >
          {value}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-[#b3a9ff]">
        Zobacz wyniki
        <ArrowDown className="size-4" aria-hidden="true" />
      </span>
    </a>
  )
}
