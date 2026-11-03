import { formatCurrency, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

interface ProfitWaterfallProps {
  revenue: number
  costOfGoods: number
  adSpend: number
  extraCosts: number
  netProfit: number
  currency: Currency
}

interface Step {
  label: string
  /** Bar spans from `from` to `to` in currency units. */
  from: number
  to: number
  /** Signed amount shown on the bar. */
  amount: number
  tone: "revenue" | "cost" | "ads" | "profit" | "loss"
}

const TONE = {
  revenue: "bg-[#c9cfdb]",
  cost: "bg-[#4a5466]",
  ads: "bg-primary",
  profit: "bg-success",
  loss: "bg-destructive",
}

/**
 * Revenue walked down to profit: each cost is a floating bar, the result lands on zero.
 * Values are labelled on every bar (five at most), with an equivalent table for readers.
 */
export function ProfitWaterfall(props: ProfitWaterfallProps) {
  const { revenue, costOfGoods, adSpend, extraCosts, netProfit, currency } = props

  const afterGoods = revenue - costOfGoods
  const afterAds = afterGoods - adSpend
  const steps: Step[] = [
    { label: "Przychód", from: 0, to: revenue, amount: revenue, tone: "revenue" },
    {
      label: "Koszt towaru",
      from: afterGoods,
      to: revenue,
      amount: -costOfGoods,
      tone: "cost",
    },
    { label: "Reklama", from: afterAds, to: afterGoods, amount: -adSpend, tone: "ads" },
    ...(extraCosts > 0
      ? [
          {
            label: "Koszty dodatkowe",
            from: afterAds - extraCosts,
            to: afterAds,
            amount: -extraCosts,
            tone: "cost" as const,
          },
        ]
      : []),
    {
      label: netProfit >= 0 ? "Zysk netto" : "Strata netto",
      from: Math.min(0, netProfit),
      to: Math.max(0, netProfit),
      amount: netProfit,
      tone: netProfit >= 0 ? "profit" : "loss",
    },
  ]

  const max = Math.max(revenue, ...steps.map((s) => s.to), 1)
  const min = Math.min(0, ...steps.map((s) => s.from))
  const span = max - min
  const pos = (v: number) => ((v - min) / span) * 100
  const money = (v: number) => formatCurrency(v, currency, 0)
  const signedMoney = (v: number) => (v < 0 ? `−${money(-v)}` : money(v))

  return (
    <figure>
      {/* Padding gives value labels above the tallest bar and below a loss room to sit. */}
      <div className={cn("pt-5", netProfit < 0 && "pb-6")}>
        <div
          className="relative grid h-56 gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          <div
            className="pointer-events-none absolute inset-x-0 h-px bg-[#3a4456]"
            style={{ bottom: `${pos(0)}%` }}
          />
          {steps.map((step) => {
            const bottom = pos(step.from)
            const height = Math.max(pos(step.to) - bottom, 0.6)
            const negative = step.tone === "loss"
            return (
              <div key={step.label} className="group relative">
                <div
                  className={cn(
                    "absolute inset-x-1 rounded-[4px] transition-opacity duration-150 group-hover:opacity-85 sm:inset-x-3",
                    TONE[step.tone]
                  )}
                  style={{ bottom: `${bottom}%`, height: `${height}%` }}
                />
                <span
                  className="absolute inset-x-0 text-center text-[11px] font-medium text-foreground tabular sm:text-xs"
                  style={
                    negative
                      ? { top: `calc(${100 - bottom}% + 4px)` }
                      : { bottom: `calc(${bottom + height}% + 4px)` }
                  }
                >
                  {signedMoney(step.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div
        className="mt-2 grid gap-2 border-t border-border pt-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {steps.map((step) => (
          <span
            key={step.label}
            className="text-center text-[11px] leading-tight text-muted-foreground sm:text-xs"
          >
            {step.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Przychód rozbity na koszty i zysk</caption>
        <tbody>
          {steps.map((step) => (
            <tr key={step.label}>
              <th scope="row">{step.label}</th>
              <td>{signedMoney(step.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
