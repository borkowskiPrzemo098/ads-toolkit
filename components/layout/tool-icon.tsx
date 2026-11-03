import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-9 rounded-lg [&_svg]:size-[18px]",
  md: "size-11 rounded-xl [&_svg]:size-5",
  lg: "size-14 rounded-2xl [&_svg]:size-6",
}

interface ToolIconProps {
  icon: LucideIcon
  /** The tool's neon hue; falls back to the page's --tool. */
  hue?: string
  size?: keyof typeof SIZES
  /** Solid glowing tile for featured tools and page headers. */
  solid?: boolean
  className?: string
}

export function ToolIcon({
  icon: Icon,
  hue,
  size = "md",
  solid,
  className,
}: ToolIconProps) {
  return (
    <span
      aria-hidden="true"
      style={hue ? ({ "--glow": hue, "--hue": hue } as React.CSSProperties) : undefined}
      className={cn(
        "grid shrink-0 place-items-center [--hue:var(--tool)]",
        SIZES[size],
        solid
          ? "bg-(--hue) bg-linear-to-br from-white/25 to-transparent text-[#0b0d12] glow"
          : "bg-[color-mix(in_oklab,var(--hue)_14%,transparent)] text-(--hue) ring-1 ring-[color-mix(in_oklab,var(--hue)_35%,transparent)] ring-inset",
        className
      )}
    >
      <Icon strokeWidth={solid ? 2 : 1.75} />
    </span>
  )
}
