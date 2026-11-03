"use client"

import Link from "next/link"
import { History } from "lucide-react"
import { TOOL_BY_SLUG, toolHref } from "@/constants/tools"
import { useToolUsage } from "@/hooks/use-tool-usage"
import { topTools } from "@/lib/tool-usage"

/** Most used tools, counted only in this browser. Renders nothing until hydrated. */
export function MostUsed() {
  const usage = useToolUsage()
  if (usage === null) return <div className="h-9" aria-hidden="true" />

  const top = topTools(usage)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden="true" />
        {top.length
          ? "Najczęściej używasz:"
          : "Tu pojawią się narzędzia, których używasz najczęściej."}
      </span>
      {top.map((slug) => {
        const tool = TOOL_BY_SLUG[slug]
        const Icon = tool.icon
        return (
          <Link
            key={slug}
            href={toolHref(slug)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm transition-colors duration-150 hover:border-[#3a4456] hover:bg-[#141925]"
          >
            <Icon
              className="size-4 text-[#a89dff]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {tool.name}
          </Link>
        )
      })}
    </div>
  )
}
