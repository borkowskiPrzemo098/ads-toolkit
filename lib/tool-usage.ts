import { TOOL_BY_SLUG } from "@/constants/tools"
import type { ToolSlug } from "@/types/tool"

export type ToolUsage = Partial<Record<ToolSlug, number>>

/** Parses stored usage counts, dropping anything that is not a known tool with a positive count. */
export function parseToolUsage(raw: string | null): ToolUsage {
  if (!raw) return {}
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {}

  const usage: ToolUsage = {}
  for (const [slug, count] of Object.entries(data)) {
    if (slug in TOOL_BY_SLUG && Number.isInteger(count) && (count as number) > 0) {
      usage[slug as ToolSlug] = count as number
    }
  }
  return usage
}

/** Most used first; ties keep the registry order. */
export function topTools(usage: ToolUsage, limit = 3): ToolSlug[] {
  return (Object.keys(TOOL_BY_SLUG) as ToolSlug[])
    .filter((slug) => (usage[slug] ?? 0) > 0 && !TOOL_BY_SLUG[slug].hidden)
    .sort((a, b) => (usage[b] ?? 0) - (usage[a] ?? 0))
    .slice(0, limit)
}
