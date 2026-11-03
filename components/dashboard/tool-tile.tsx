import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { ToolIcon } from "@/components/layout/tool-icon"
import { toolHref } from "@/constants/tools"
import type { ToolMeta } from "@/types/tool"
import { cn } from "@/lib/utils"

const TILE =
  "group relative flex flex-col rounded-xl border border-border bg-card transition-[border-color,background-color,translate] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-[#3a4456] hover:bg-[#141925] has-[a:focus-visible]:border-primary"

/** Whole tile is clickable through a stretched link on the "Otwórz narzędzie" label. */
function OpenLink({ tool }: { tool: ToolMeta }) {
  return (
    <Link
      href={toolHref(tool.slug)}
      className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-[#b3a9ff] outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
    >
      Otwórz narzędzie
      <span className="sr-only">: {tool.name}</span>
      <ArrowRight
        className="size-4 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

export function FeaturedToolTile({ tool }: { tool: ToolMeta }) {
  return (
    <article className={cn(TILE, "p-6 sm:p-7")}>
      <div className="flex items-center gap-3">
        <ToolIcon icon={tool.icon} size="lg" solid />
        <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
      </div>
      <p className="mt-5 text-xl font-semibold tracking-tight text-balance sm:text-[1.375rem]">
        {tool.question}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {tool.description}
      </p>
      <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
        {tool.outputs.slice(0, 3).map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-[#c9cfdb]">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <OpenLink tool={tool} />
    </article>
  )
}

export function ToolTile({ tool }: { tool: ToolMeta }) {
  return (
    <article className={cn(TILE, "p-5")}>
      <div className="flex items-center gap-3">
        <ToolIcon icon={tool.icon} />
        <h3 className="text-[0.9375rem] font-semibold tracking-tight">{tool.name}</h3>
      </div>
      <p className="mt-4 text-[0.9375rem] font-medium text-balance">{tool.question}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {tool.description}
      </p>
      <OpenLink tool={tool} />
    </article>
  )
}
