import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-9 rounded-lg [&_svg]:size-[18px]",
  md: "size-11 rounded-xl [&_svg]:size-5",
  lg: "size-14 rounded-2xl [&_svg]:size-6",
}

interface ToolIconProps {
  icon: LucideIcon
  size?: keyof typeof SIZES
  /** Solid accent tile for featured tools and page headers. */
  solid?: boolean
  className?: string
}

export function ToolIcon({ icon: Icon, size = "md", solid, className }: ToolIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center",
        SIZES[size],
        solid
          ? "bg-primary text-primary-foreground"
          : "bg-primary/12 text-[#a89dff] ring-1 ring-primary/20 ring-inset",
        className
      )}
    >
      <Icon strokeWidth={1.75} />
    </span>
  )
}
