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
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {result.ok ? (
        <>
          <p
            className={cn(
              "mt-1.5 truncate text-[1.375rem] font-semibold tracking-tight tabular sm:text-2xl",
              tone === "good" && "text-success",
              tone === "bad" && "text-destructive"
            )}
          >
            {format(result.value)}
          </p>
          {meter && <ThresholdMeter {...meter} />}
          {(detail || check != null) && (
            <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
              {check === true && (
                <CircleCheck
                  className="size-3.5 shrink-0 text-success"
                  aria-label="w normie"
                />
              )}
              {check === false && (
                <CircleX
                  className="size-3.5 shrink-0 text-destructive"
                  aria-label="poza normą"
                />
              )}
              <span className="truncate">{detail}</span>
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
          value >= threshold ? "bg-success" : "bg-destructive"
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
