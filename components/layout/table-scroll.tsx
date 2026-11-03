import type { ReactNode } from "react"

/**
 * Wide table inside a panel: bleeds to the panel edges and scrolls sideways on phones.
 * Focusable and named, so keyboard users can scroll it with the arrow keys (WCAG 2.1.1).
 */
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-5 overflow-x-auto rounded-md px-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:-mx-6 sm:px-6"
    >
      {children}
    </div>
  )
}
