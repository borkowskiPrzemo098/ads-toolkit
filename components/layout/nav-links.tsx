"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { TOOLS, toolHref } from "@/constants/tools"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", label: "Panel główny", icon: LayoutDashboard },
  ...TOOLS.map((t) => ({
    href: toolHref(t.slug),
    label: t.navLabel ?? t.name,
    icon: t.icon,
  })),
]

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Nawigacja główna">
      <ul className="flex flex-col gap-0.5">
        {ITEMS.map(({ href, label, icon: Icon }, i) => {
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
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground transition-colors duration-150",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground",
                    active && "text-primary group-hover:text-primary"
                  )}
                  strokeWidth={1.75}
                />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
