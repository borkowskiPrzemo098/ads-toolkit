"use client"

import { useCallback, useSyncExternalStore } from "react"

const CHANGE_EVENT = "ads-toolkit:session-value"

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Raw string kept in sessionStorage: it survives a reload but disappears with the tab, so
 * nothing lingers on a shared computer. Returns undefined before hydration.
 */
export function useSessionValue(key: string) {
  const value = useSyncExternalStore(
    (onChange) => {
      const handler = (e: Event) => {
        if (!(e instanceof CustomEvent) || e.detail === key) onChange()
      }
      window.addEventListener(CHANGE_EVENT, handler)
      return () => window.removeEventListener(CHANGE_EVENT, handler)
    },
    () => read(key),
    () => undefined
  )

  const write = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.sessionStorage.removeItem(key)
        else window.sessionStorage.setItem(key, next)
      } catch {
        // Storage blocked or full: history is a convenience, the tool still works.
      }
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }))
    },
    [key]
  )

  return [value, write] as const
}
