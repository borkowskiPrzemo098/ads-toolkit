import { PROFITABILITY_GROUPS } from "@/constants/profitability"
import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { formatMetric } from "@/lib/formatting/metric"
import type { Currency } from "@/lib/formatting/number"

interface MetricsTableProps {
  result: ProfitabilityResult
  currency: Currency
}

/** Every metric with its formula; metrics that cannot be computed say why. */
export function MetricsTable({ result, currency }: MetricsTableProps) {
  const derived: Partial<Record<string, boolean>> = {
    revenue: result.revenueDerived,
    avgOrderValue: result.avgOrderValueDerived,
  }

  return (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
      {PROFITABILITY_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">
            {group.title}
          </h3>
          <dl className="divide-y divide-border">
            {group.metrics.map((metric) => {
              const r = result[metric.key]
              const value = formatMetric(r, metric.kind, currency)
              return (
                <div
                  key={metric.key}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <dt className="min-w-0">
                    <span className="text-sm">{metric.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {r.ok ? metric.help : r.reason}
                    </span>
                  </dt>
                  <dd className="shrink-0 text-right">
                    <span
                      className={
                        value
                          ? "text-sm font-semibold tabular"
                          : "text-sm font-semibold text-[#4a5466]"
                      }
                    >
                      {value ?? "—"}
                    </span>
                    {derived[metric.key] && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        wyliczone
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </div>
  )
}
