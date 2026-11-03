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
        "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.3),0_8px_24px_-12px_rgb(0_0_0/0.5)]",
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
