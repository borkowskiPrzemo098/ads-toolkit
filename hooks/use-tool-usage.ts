"use client"

import { useMemo, useSyncExternalStore } from "react"
import { parseToolUsage, type ToolUsage } from "@/lib/tool-usage"
import type { ToolSlug } from "@/types/tool"

// Only tool names and visit counts are stored here, never campaign data.
const STORAGE_KEY = "ads-toolkit.tool-usage.v1"
const CHANGE_EVENT = "ads-toolkit:tool-usage"

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export function recordToolVisit(slug: ToolSlug) {
  try {
    const usage = parseToolUsage(readRaw())
    usage[slug] = (usage[slug] ?? 0) + 1
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Storage blocked (private mode, policy): usage stats are a convenience, skip silently.
  }
}

/** Returns null during SSR and before hydration, so the server and client markup match. */
export function useToolUsage(): ToolUsage | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined)
  return useMemo(() => (raw === undefined ? null : parseToolUsage(raw)), [raw])
}
