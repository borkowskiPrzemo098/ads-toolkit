import Link from "next/link"
import { ArrowLeft, Check, CircleDashed } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import type { ToolSlug } from "@/types/tool"
import { Panel } from "./panel"
import { RecordVisit } from "./record-visit"
import { ToolHeader } from "./tool-header"

/**
 * Stand-in for a tool whose logic is not built yet. Uses the same header and panels the
 * finished tool will use, and lists only what the tool will really do.
 */
export function ToolPlaceholder({ slug }: { slug: ToolSlug }) {
  const tool = TOOL_BY_SLUG[slug]

  return (
    <>
      <RecordVisit slug={slug} />
      <ToolHeader tool={tool} />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3.5 text-sm sm:items-center">
        <CircleDashed
          className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0"
          aria-hidden="true"
        />
        <p className="text-[#f7cf7c]">
          To narzędzie jest w budowie. Obliczenia udostępnimy dopiero wtedy, gdy przejdą
          testy poprawności.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Co wprowadzisz" description="Dane potrzebne do obliczeń.">
          <ItemList items={tool.inputs} />
        </Panel>
        <Panel title="Co otrzymasz" description="Wyniki i funkcje narzędzia.">
          <ItemList items={tool.outputs} accent />
        </Panel>
      </div>

      <Link
        href="/"
        className={buttonVariants({ variant: "ghost", className: "mt-8 -ml-3" })}
      >
        <ArrowLeft />
        Wróć do panelu
      </Link>
    </>
  )
}

function ItemList({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0"
        >
          <Check
            className={
              accent
                ? "mt-0.5 size-4 shrink-0 text-success"
                : "mt-0.5 size-4 shrink-0 text-muted-foreground"
            }
            aria-hidden="true"
          />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}
