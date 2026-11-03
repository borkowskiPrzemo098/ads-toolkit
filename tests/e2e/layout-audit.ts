import type { Page } from "@playwright/test"

/*
 * Layout audit run inside the page: finds what breaks on small or odd screens.
 * Intentional exceptions are marked in the markup, not listed here:
 *   data-truncate-ok   text that is meant to be cut with an ellipsis (full value elsewhere)
 *   aria-hidden="true" decoration (glows) that may extend past the edge without scrolling
 */

export interface LayoutIssue {
  kind: "page-overflow" | "off-screen" | "truncated" | "small-target" | "tiny-text"
  detail: string
}

export async function auditLayout(page: Page, touch: boolean): Promise<LayoutIssue[]> {
  return page.evaluate((touch) => {
    const vw = document.documentElement.clientWidth
    const issues: { kind: string; detail: string }[] = []
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return (
        r.width > 0 &&
        r.height > 0 &&
        cs.visibility !== "hidden" &&
        !el.closest(".sr-only")
      )
    }
    const name = (el: Element) => {
      const text = (el.getAttribute("aria-label") || el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
      return `${el.tagName.toLowerCase()} "${text.slice(0, 50)}"`
    }

    if (document.documentElement.scrollWidth > vw + 1)
      issues.push({
        kind: "page-overflow",
        detail: `page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`,
      })

    const scrollers = [...document.querySelectorAll("body *")].filter((el) =>
      /(auto|scroll)/.test(getComputedStyle(el).overflowX)
    )
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const parentRight = el.parentElement?.getBoundingClientRect().right ?? 0
      if (
        (r.right > vw + 1 || r.left < -1) &&
        parentRight <= vw + 1 &&
        cs.position !== "fixed" &&
        !el.closest("[aria-hidden=true]") &&
        !scrollers.some((s) => s !== el && s.contains(el))
      )
        issues.push({
          kind: "off-screen",
          detail: `${name(el)} reaches x=${Math.round(r.right)}`,
        })

      const ownText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent?.trim()
      )
      if (!ownText) continue
      if (
        !el.closest("[data-truncate-ok]") &&
        (cs.textOverflow === "ellipsis" || cs.overflowX === "hidden") &&
        el.scrollWidth > el.clientWidth + 1
      )
        issues.push({ kind: "truncated", detail: `${name(el)} is cut off` })
      if (parseFloat(cs.fontSize) < 11)
        issues.push({ kind: "tiny-text", detail: `${name(el)} at ${cs.fontSize}` })
    }

    if (touch) {
      const targets = document.querySelectorAll(
        "a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, [role=button], [role=radio], [role=tab]"
      )
      for (const el of targets) {
        if (!visible(el)) continue
        const r = el.getBoundingClientRect()
        // Visually hidden native inputs behind custom controls.
        if (r.width <= 1) continue
        // WCAG 2.5.8 exempts links inside running text.
        if (
          el.tagName === "A" &&
          /inline/.test(getComputedStyle(el).display) &&
          el.closest("p, li")
        )
          continue
        if (r.width < 24 || r.height < 24)
          issues.push({
            kind: "small-target",
            detail: `${name(el)} is ${Math.round(r.width)}×${Math.round(r.height)}px`,
          })
      }
    }
    return issues
  }, touch) as Promise<LayoutIssue[]>
}
