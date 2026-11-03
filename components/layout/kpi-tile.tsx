import { CircleCheck, CircleX } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalcResult } from "@/types/calculation"

export interface KpiTileProps {
  label: string
  result: CalcResult
  format: (v: number) => string
  detail?: string
  tone?: "good" | "bad"
  /** true = meets its threshold, false = misses it, null = no threshold known. */
  check?: boolean | null
  meter?: { value: number; threshold: number }
}

/** Headline metric: large value, or a dash with the reason it cannot be computed. */
export function KpiTile({
  label,
  result,
  format,
  detail,
  tone,
  check,
  meter,
}: KpiTileProps) {
  return (
    <div
      className={cn(
        "@container relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-4",
        // Lit top edge: the tool's hue, or the verdict colour when the value has one.
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-linear-to-r before:from-transparent before:via-(--edge) before:to-transparent",
        "[--edge:var(--tool)]",
        tone === "good" && "[--edge:var(--success)]",
        tone === "bad" && "[--edge:var(--destructive)]"
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {result.ok ? (
        <>
          <p
            className={cn(
              // Scales with the tile (container query), so "4 255 319,40 zł" fits instead of being cut.
              "mt-1.5 text-[clamp(1rem,13cqi,1.5rem)] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] tabular",
              // Values without a verdict take the tool's hue, so the result row is never grey.
              !tone && "text-(--tool) neon-text",
              tone === "good" && "text-success neon-text",
              tone === "bad" && "text-destructive neon-text"
            )}
          >
            {format(result.value)}
          </p>
          {meter && <ThresholdMeter {...meter} />}
          {(detail || check != null) && (
            <p className="mt-auto flex items-start gap-1.5 pt-2 text-xs leading-snug text-muted-foreground">
              {check === true && (
                <CircleCheck
                  className="mt-px size-3.5 shrink-0 text-success"
                  aria-label="w normie"
                />
              )}
              {check === false && (
                <CircleX
                  className="mt-px size-3.5 shrink-0 text-destructive"
                  aria-label="poza normą"
                />
              )}
              <span className="min-w-0">{detail}</span>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[1.375rem] font-semibold text-[#4a5466] sm:text-2xl">
            —
          </p>
          <p className="mt-auto pt-2 text-xs leading-snug text-muted-foreground">
            {result.reason}
          </p>
        </>
      )}
    </div>
  )
}

/** ROAS against break-even: the fill is ROAS, the tick is the threshold. */
function ThresholdMeter({ value, threshold }: { value: number; threshold: number }) {
  const scale = Math.max(value, threshold) * 1.25
  const fill = Math.min((value / scale) * 100, 100)
  const tick = (threshold / scale) * 100
  return (
    <div className="relative mt-2.5 h-1.5 rounded-full bg-[#232a37]" aria-hidden="true">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          value >= threshold
            ? "bg-success shadow-[0_0_10px_var(--success)]"
            : "bg-destructive shadow-[0_0_10px_var(--destructive)]"
        )}
        style={{ width: `${fill}%` }}
      />
      <div
        className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground"
        style={{ left: `calc(${tick}% - 1px)` }}
      />
    </div>
  )
}
