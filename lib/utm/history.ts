import { UTM_KEYS, type UtmValues } from "./build"

export interface UtmHistoryItem {
  id: string
  /** ISO timestamp. */
  createdAt: string
  /** Landing page as the user entered it. */
  target: string
  url: string
  values: UtmValues
}

export const MAX_HISTORY = 200

const isValues = (v: unknown): v is UtmValues =>
  typeof v === "object" &&
  v !== null &&
  UTM_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === "string")

/** Parses stored history, dropping anything malformed instead of failing. */
export function parseHistory(raw: string | null): UtmHistoryItem[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data
    .filter(
      (item): item is UtmHistoryItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.target === "string" &&
        typeof item.url === "string" &&
        isValues(item.values)
    )
    .slice(0, MAX_HISTORY)
}

/** Newest first; the same link added again moves to the top instead of duplicating. */
export function addToHistory(
  history: UtmHistoryItem[],
  items: Omit<UtmHistoryItem, "id" | "createdAt">[],
  now = new Date()
): UtmHistoryItem[] {
  const fresh = items.map((item, i) => ({
    ...item,
    id: `${now.getTime()}-${i}`,
    createdAt: now.toISOString(),
  }))
  const urls = new Set(fresh.map((i) => i.url))
  return [...fresh.reverse(), ...history.filter((h) => !urls.has(h.url))].slice(
    0,
    MAX_HISTORY
  )
}
