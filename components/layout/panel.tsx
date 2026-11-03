import { cn } from "@/lib/utils"

interface PanelProps {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  as?: "section" | "div" | "aside"
}

/** The one container used across tools: inputs, results and explanations. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: PanelProps) {
  return (
    <Tag
      className={cn(
        "relative rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.3),0_8px_24px_-12px_rgb(0_0_0/0.5)]",
        // Lit top edge in the tool's hue.
        "before:pointer-events-none before:absolute before:inset-x-8 before:-top-px before:h-px before:bg-linear-to-r before:from-transparent before:via-(--tool) before:to-transparent before:opacity-70",
        className
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={cn("px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>
    </Tag>
  )
}
