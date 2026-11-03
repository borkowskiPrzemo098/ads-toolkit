import type {
  KeywordRow,
  KeywordStatus,
  LengthGroup,
} from "@/lib/calculations/keyword-analyzer"
import { normalizeKeyword, stripDiacritics } from "./normalize"
import type { KeywordCategory } from "./signals"

export type StatusFilter = "all" | "clean" | "issues"
export type KeywordSort = "input" | "alpha" | "words-desc" | "category"

export interface KeywordFilters {
  query: string
  category: KeywordCategory | "all"
  length: LengthGroup | "all"
  status: StatusFilter
  topic: string | null
  sort: KeywordSort
}

export const DEFAULT_FILTERS: KeywordFilters = {
  query: "",
  category: "all",
  length: "all",
  status: "all",
  topic: null,
  sort: "input",
}

const ISSUES: KeywordStatus[] = ["duplicate", "near-duplicate"]

/**
 * Comma-separated terms: a row matches when it contains any plain term and none of the
 * terms prefixed with "-". Case and diacritics are ignored. "buty, kurtki, -tanie".
 */
export function parseQuery(query: string) {
  const include: string[] = []
  const exclude: string[] = []
  for (const part of query.split(",")) {
    const negative = part.trim().startsWith("-")
    const term = stripDiacritics(normalizeKeyword(part.trim().replace(/^-/, "")))
    if (!term) continue
    ;(negative ? exclude : include).push(term)
  }
  return { include, exclude }
}

export function filterKeywordRows(
  rows: KeywordRow[],
  filters: KeywordFilters
): KeywordRow[] {
  const { include, exclude } = parseQuery(filters.query)

  const result = rows.filter((row) => {
    if (filters.category !== "all" && row.category !== filters.category) return false
    if (filters.length !== "all" && row.lengthGroup !== filters.length) return false
    if (filters.status === "clean" && ISSUES.includes(row.status)) return false
    if (filters.status === "issues" && !ISSUES.includes(row.status)) return false
    if (filters.topic !== null && row.topic !== filters.topic) return false
    if (include.length || exclude.length) {
      const text = stripDiacritics(row.keyword)
      if (include.length && !include.some((t) => text.includes(t))) return false
      if (exclude.some((t) => text.includes(t))) return false
    }
    return true
  })

  switch (filters.sort) {
    case "alpha":
      return result.sort((a, b) => a.keyword.localeCompare(b.keyword, "pl"))
    case "words-desc":
      return result.sort((a, b) => b.wordCount - a.wordCount || a.id - b.id)
    case "category":
      return result.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id)
    default:
      return result
  }
}
