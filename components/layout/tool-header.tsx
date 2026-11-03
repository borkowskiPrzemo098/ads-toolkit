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
    <header className="mb-8">
      <nav
        aria-label="Ścieżka"
        className="mb-5 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link href="/" className="rounded transition-colors hover:text-foreground">
          Panel główny
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-foreground">{tool.name}</span>
      </nav>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ToolIcon icon={tool.icon} size="lg" solid />
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
