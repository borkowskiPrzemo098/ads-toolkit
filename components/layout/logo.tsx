import Link from "next/link"
import { cn } from "@/lib/utils"

/** Mark: three rising bars inside a rounded tile, the accent bar last. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" fill="#191F2B" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8.5"
        fill="none"
        stroke="#2B3443"
      />
      <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#929BAC" />
      <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#C9CFDB" />
      <rect x="20" y="7" width="4" height="17" rx="1.5" fill="#7C6CFF" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 rounded-lg outline-offset-4", className)}
    >
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-[0.9375rem] font-semibold tracking-tight">
          Ads Toolkit
        </span>
        <span className="block text-xs text-muted-foreground">dla Google Ads</span>
      </span>
    </Link>
  )
}
