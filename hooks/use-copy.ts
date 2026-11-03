"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Fallback for browsers or embedded views that block the async clipboard API: a hidden
 * textarea and the legacy copy command, which still works on a user click.
 */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

/** Clipboard copy with a short "copied" state per item id. */
export function useCopy(resetAfterMs = 1800) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string, id = "default") => {
      let ok = false
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        ok = legacyCopy(text)
      }
      setFailed(!ok)
      if (ok) {
        setCopiedId(id)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopiedId(null), resetAfterMs)
      }
      return ok
    },
    [resetAfterMs]
  )

  return { copy, copiedId, failed }
}
