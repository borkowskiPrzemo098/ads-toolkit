"use client"

import { Input } from "@/components/ui/input"
import { FORECAST_METRICS, SCENARIO_FIELDS, SCENARIOS } from "@/constants/budget-planner"
import type { BudgetForecast, ScenarioId } from "@/lib/calculations/budget-planner"
import { formatMetric } from "@/lib/formatting/metric"
import type { Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import type { ScenarioField, ScenarioForm } from "@/lib/validators/budget-planner"
import { TableScroll } from "@/components/layout/table-scroll"

interface ScenarioTableProps {
  forms: Record<ScenarioId, ScenarioForm>
  errors: Record<ScenarioId, Partial<Record<ScenarioField, string>>>
  onChange: (id: ScenarioId, field: ScenarioField, value: string) => void
  forecasts: Record<ScenarioId, BudgetForecast>
  currency: Currency
}

/** Editable scenario assumptions on top, the forecast they produce underneath. */
export function ScenarioTable({
  forms,
  errors,
  onChange,
  forecasts,
  currency,
}: ScenarioTableProps) {
  return (
    <TableScroll label="Tabela scenariuszy">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">
          Założenia i prognoza dla scenariuszy: ostrożnego, realistycznego i
          optymistycznego.
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th
              scope="col"
              className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground"
            >
              Zmiana względem Twoich założeń
            </th>
            {SCENARIOS.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="px-2 py-2 text-right text-xs font-medium"
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="16" height="8" aria-hidden="true">
                    <line
                      x1="1"
                      y1="4"
                      x2="15"
                      y2="4"
                      stroke={s.color}
                      strokeWidth="2"
                      strokeDasharray={s.dash}
                      strokeLinecap="round"
                    />
                  </svg>
                  {s.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SCENARIO_FIELDS.map((field) => (
            <tr key={field.key}>
              <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                {field.label}
              </th>
              {SCENARIOS.map((s) => {
                const error = errors[s.id][field.key]
                return (
                  <td key={s.id} className="px-2 py-1.5 text-right">
                    <div className="relative ml-auto w-24">
                      <Input
                        inputMode="decimal"
                        aria-label={`${field.label}, scenariusz ${s.label.toLowerCase()}`}
                        aria-invalid={error ? true : undefined}
                        title={error}
                        value={forms[s.id][field.key]}
                        onChange={(e) => onChange(s.id, field.key, e.target.value)}
                        className="h-9 pr-7 text-right"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tbody className="border-t-2 border-border">
          {FORECAST_METRICS.map((metric) => (
            <tr key={metric.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                {metric.label}
              </th>
              {SCENARIOS.map((s) => {
                const r = forecasts[s.id][metric.key]
                const value = formatMetric(r, metric.kind, currency)
                const isProfit = metric.key === "profit" && r.ok
                return (
                  <td
                    key={s.id}
                    title={r.ok ? undefined : r.reason}
                    className={cn(
                      "px-2 py-2.5 text-right",
                      value ? "font-medium tabular" : "text-[#4a5466]",
                      isProfit && r.value > 0 && "text-success",
                      isProfit && r.value < 0 && "text-destructive"
                    )}
                  >
                    {value ?? "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {SCENARIOS.some((s) => Object.keys(errors[s.id]).length > 0) && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          Zmiany scenariusza muszą mieścić się między −100% a +500%. Błędne pola liczymy
          jako 0%.
        </p>
      )}
    </TableScroll>
  )
}
