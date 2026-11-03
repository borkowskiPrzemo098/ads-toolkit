import { ALL_PROFITABILITY_METRICS, type MetricDef } from "@/constants/profitability"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { formatDelta, formatMetric } from "@/lib/formatting/metric"
import type { Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import { TableScroll } from "@/components/layout/table-scroll"

interface ComparisonTableProps {
  campaigns: { name: string; result: ProfitabilityResult }[]
  currency: Currency
}

function deltaTone(metric: MetricDef, delta: number) {
  if (metric.better === null || delta === 0) return "text-muted-foreground"
  const improved = metric.better === "higher" ? delta > 0 : delta < 0
  return improved ? "text-success" : "text-destructive"
}

export function ComparisonTable({ campaigns, currency }: ComparisonTableProps) {
  const [a, b] = campaigns

  return (
    <TableScroll label="Tabela porównania kampanii">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">
          Porównanie: {a.name} i {b.name}. Różnica to {b.name} minus {a.name}.
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 text-left font-medium">
              Wskaźnik
            </th>
            <th
              scope="col"
              className="max-w-40 truncate px-3 py-2 text-right font-medium"
            >
              {a.name}
            </th>
            <th
              scope="col"
              className="max-w-40 truncate px-3 py-2 text-right font-medium"
            >
              {b.name}
            </th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">
              Różnica
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ALL_PROFITABILITY_METRICS.map((metric) => {
            const ra = a.result[metric.key]
            const rb = b.result[metric.key]
            return (
              <tr key={metric.key}>
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  {metric.label}
                </th>
                {[ra, rb].map((r, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-2.5 text-right",
                      r.ok ? "font-medium tabular" : "text-[#4a5466]"
                    )}
                  >
                    {formatMetric(r, metric.kind, currency) ?? "—"}
                  </td>
                ))}
                <td
                  className={cn(
                    "py-2.5 pl-3 text-right font-medium tabular",
                    ra.ok && rb.ok
                      ? deltaTone(metric, rb.value - ra.value)
                      : "text-[#4a5466]"
                  )}
                >
                  {ra.ok && rb.ok
                    ? formatDelta(ra.value, rb.value, metric.kind, currency)
                    : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableScroll>
  )
}
