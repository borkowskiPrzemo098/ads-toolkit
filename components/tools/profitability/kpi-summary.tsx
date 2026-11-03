import { Equal, TrendingDown, TrendingUp } from "lucide-react"
import { KpiTile } from "@/components/layout/kpi-tile"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { profitabilityVerdict } from "@/lib/export/profitability-text"
import { formatCurrency, formatPercent, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

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
        <KpiTile
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
        <KpiTile
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
        <KpiTile
          label="ROI"
          result={r.roi}
          format={(v) => formatPercent(v, 1)}
          tone={r.roi.ok ? (r.roi.value >= 0 ? "good" : "bad") : undefined}
          detail="zysk ÷ wszystkie koszty"
        />
        <KpiTile
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
