"use client"

import { History } from "lucide-react"
import { NeonBars } from "@/components/charts/neon-bars"
import { TOOL_BY_SLUG, toolHref } from "@/constants/tools"
import { useToolUsage } from "@/hooks/use-tool-usage"
import { topTools } from "@/lib/tool-usage"

const visits = (n: number) =>
  n === 1
    ? "1 otwarcie"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? `${n} otwarcia`
      : `${n} otwarć`

/**
 * Most used tools as glowing bars, counted only in this browser (localStorage).
 * Renders a placeholder of the same height until hydrated.
 */
export function MostUsed() {
  const usage = useToolUsage()
  if (usage === null) return <div className="h-9" aria-hidden="true" />

  const top = topTools(usage, 4)
  if (!top.length) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden="true" />
        Tu pojawią się narzędzia, których używasz najczęściej.
      </p>
    )
  }

  return (
    <section aria-labelledby="most-used-heading" className="max-w-lg">
      <h2
        id="most-used-heading"
        className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
        <History className="size-4" aria-hidden="true" />
        Najczęściej używasz
      </h2>
      <NeonBars
        caption="Najczęściej używane narzędzia w tej przeglądarce"
        bars={top.map((slug) => ({
          label: TOOL_BY_SLUG[slug].name,
          value: usage[slug] ?? 0,
          display: visits(usage[slug] ?? 0),
          color: TOOL_BY_SLUG[slug].hue,
          href: toolHref(slug),
        }))}
      />
    </section>
  )
}
