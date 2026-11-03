import type { LucideIcon } from "lucide-react"

export type ToolSlug =
  | "profitability"
  | "budget-planner"
  | "keyword-analyzer"
  | "negative-keywords"
  | "utm-builder"
  | "rsa-builder"
  | "ab-testing"
  | "ppc-reports"

export interface ToolMeta {
  slug: ToolSlug
  /** Full name used in page titles and the sidebar. */
  name: string
  /** Shorter label for the sidebar when `name` does not fit. */
  navLabel?: string
  /** One-line description shown on cards. */
  description: string
  /** The question this tool answers for the user. */
  question: string
  icon: LucideIcon
  /** Neon identity colour: icon tile, header glow, nav, panel edges. Always used with dark text. */
  hue: string
  featured?: boolean
  /** What the tool produces; listed on the featured dashboard tiles. */
  outputs: string[]
}
