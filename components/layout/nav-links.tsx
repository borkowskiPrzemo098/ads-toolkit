"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { TOOLS, toolHref } from "@/constants/tools"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", label: "Panel główny", icon: LayoutDashboard, hue: "#7c6cff" },
  ...TOOLS.map((t) => ({
    href: toolHref(t.slug),
    label: t.navLabel ?? t.name,
    icon: t.icon,
    hue: t.hue,
  })),
]

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Nawigacja główna">
      <ul className="flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, icon: Icon, hue }, i) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <li key={href} className={cn(i === 1 && "mt-5")}>
              {i === 1 && (
                <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">
                  Narzędzia
                </p>
              )}
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                style={{ "--hue": hue } as React.CSSProperties}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground transition-colors duration-150",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active &&
                    "bg-[color-mix(in_oklab,var(--hue)_13%,transparent)] font-medium text-sidebar-accent-foreground ring-1 ring-[color-mix(in_oklab,var(--hue)_30%,transparent)] ring-inset hover:bg-[color-mix(in_oklab,var(--hue)_18%,transparent)]"
                )}
              >
                <Icon
                  className={cn(
                    // Each tool's hue shows on hover, and stays lit on the current page.
                    "size-4 shrink-0 text-(--hue) opacity-70 transition-[opacity,filter] duration-150 group-hover:opacity-100",
                    active && "opacity-100 drop-shadow-[0_0_6px_var(--hue)]"
                  )}
                  strokeWidth={1.75}
                />
                <span className="truncate">{label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-(--hue) shadow-[0_0_8px_2px_var(--hue)]"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
