import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { ToolMeta } from "@/types/tool"
import { ToolIcon } from "./tool-icon"

interface ToolHeaderProps {
  tool: ToolMeta
  /** Tool-level actions such as "Wyczyść" or "Eksportuj". */
  actions?: React.ReactNode
}

export function ToolHeader({ tool, actions }: ToolHeaderProps) {
  return (
    <header className="relative mb-8">
      {/* Neon pool in the tool's hue behind the title: the page's colour signature. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 -z-10 h-72 w-[34rem] max-w-[90vw] rounded-full bg-(--tool) opacity-[0.16] blur-[90px]"
      />
      <nav
        aria-label="Ścieżka"
        className="mb-5 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link
          href="/"
          className="-my-0.5 inline-block rounded py-0.5 transition-colors hover:text-foreground"
        >
          Panel główny
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="font-medium text-(--tool)">{tool.name}</span>
      </nav>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ToolIcon icon={tool.icon} hue={tool.hue} size="lg" solid />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              {tool.name}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">
              {tool.description}
            </p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </header>
  )
}
