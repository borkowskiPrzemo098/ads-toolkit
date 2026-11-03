import { CircleCheck, CircleX, Equal, TrendingDown, TrendingUp } from "lucide-react"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { profitabilityVerdict } from "@/lib/export/profitability-text"
import { formatCurrency, formatPercent, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import type { CalcResult } from "@/types/calculation"

interface KpiSummaryProps {
  result: ProfitabilityResult
  currency: Currency
}

const VERDICT_STYLE = {
  positive: { box: "border-success/35 bg-success/10 text-[#6fe0b4]", icon: TrendingUp },
  negative: {
    box: "border-destructive/40 bg-destructive/10 text-[#f59a9a]",
    icon: TrendingDown,
  },
  neutral: { box: "border-warning/35 bg-warning/10 text-[#f7cf7c]", icon: Equal },
}

export function KpiSummary({ result: r, currency }: KpiSummaryProps) {
  const verdict = profitabilityVerdict(r, currency)
  const money = (v: number) => formatCurrency(v, currency)

  const roasAboveThreshold =
    r.roas.ok && r.breakEvenRoas.ok ? r.roas.value >= r.breakEvenRoas.value : null
  const cpaWithinLimit = r.cpa.ok && r.maxCpa.ok ? r.cpa.value <= r.maxCpa.value : null

  return (
    <div className="flex flex-col gap-4">
      {verdict ? (
        <p
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3.5 text-[0.9375rem] font-medium",
            VERDICT_STYLE[verdict.tone].box
          )}
          aria-live="polite"
        >
          {(() => {
            const Icon = VERDICT_STYLE[verdict.tone].icon
            return <Icon className="size-5 shrink-0" aria-hidden="true" />
          })()}
          {verdict.text}
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-[#2f3848] px-4 py-3.5 text-sm text-muted-foreground">
          Podaj koszt reklamy, przychód i marżę, a zobaczysz, czy kampania zarabia.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Zysk netto"
          result={r.netProfit}
          format={money}
          tone={r.status === "profit" ? "good" : r.status === "loss" ? "bad" : undefined}
          detail={
            r.netProfitBasis === "product-cost"
              ? "od kosztu produktu"
              : r.netProfitBasis === "margin"
                ? "od marży"
                : undefined
          }
        />
        <Kpi
          label="ROAS"
          result={r.roas}
          format={(v) => formatPercent(v, 0)}
          check={roasAboveThreshold}
          detail={
            r.breakEvenRoas.ok
              ? `próg ${formatPercent(r.breakEvenRoas.value, 0)}`
              : undefined
          }
          meter={
            r.roas.ok && r.breakEvenRoas.ok
              ? { value: r.roas.value, threshold: r.breakEvenRoas.value }
              : undefined
          }
        />
        <Kpi
          label="ROI"
          result={r.roi}
          format={(v) => formatPercent(v, 1)}
          tone={r.roi.ok ? (r.roi.value >= 0 ? "good" : "bad") : undefined}
          detail="zysk ÷ wszystkie koszty"
        />
        <Kpi
          label="CPA"
          result={r.cpa}
          format={money}
          check={cpaWithinLimit}
          detail={r.maxCpa.ok ? `maks. ${money(r.maxCpa.value)}` : undefined}
        />
      </div>
    </div>
  )
}

interface KpiProps {
  label: string
  result: CalcResult
  format: (v: number) => string
  detail?: string
  tone?: "good" | "bad"
  /** true = meets its threshold, false = misses it, null = no threshold known. */
  check?: boolean | null
  meter?: { value: number; threshold: number }
}

function Kpi({ label, result, format, detail, tone, check, meter }: KpiProps) {
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
