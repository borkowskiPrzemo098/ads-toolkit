"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ScenarioMeta } from "@/constants/budget-planner"
import type { ScenarioId, SimulationPoint } from "@/lib/calculations/budget-planner"
import {
  formatCompactCurrency,
  formatCurrency,
  type Currency,
} from "@/lib/formatting/number"

interface ProfitCurveChartProps {
  scenarios: ScenarioMeta[]
  series: Record<ScenarioId, SimulationPoint[]>
  currentBudget: number
  optimum?: { budget: number; profit: number }
  currency: Currency
}

const AXIS = { stroke: "#3a4456", fontSize: 11, fill: "#929bac" }

type Row = { budget: number } & Partial<Record<ScenarioId, number>>

/** Profit against budget for each scenario. One y-axis (profit); budget on x. */
export function ProfitCurveChart({
  scenarios,
  series,
  currentBudget,
  optimum,
  currency,
}: ProfitCurveChartProps) {
  // All scenarios share the same budget grid, so rows merge by index.
  const rows: Row[] = series.realistic.map((point, i) => {
    const row: Row = { budget: point.budget }
    for (const s of scenarios) row[s.id] = series[s.id][i]?.profit
    return row
  })
  const compact = (v: number) => formatCompactCurrency(v, currency)

  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {scenarios.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>

      <div
        className="h-72 w-full"
        role="img"
        aria-label="Wykres zysku względem budżetu dla trzech scenariuszy. Te same dane są w tabeli scenariuszy."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#1f2632" />
            <XAxis
              dataKey="budget"
              type="number"
              domain={[0, "auto"]}
              tickFormatter={compact}
              tick={AXIS}
              axisLine={{ stroke: AXIS.stroke }}
              tickLine={false}
              tickCount={6}
            />
            <YAxis
              tickFormatter={compact}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <ReferenceLine y={0} stroke="#4a5466" />
            <ReferenceLine
              x={currentBudget}
              stroke="#929bac"
              strokeDasharray="3 3"
              label={{
                value: "Twój budżet",
                position: "insideTopLeft",
                fill: "#c9cfdb",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ stroke: "#3a4456" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-[#2f3848] bg-popover px-3 py-2.5 text-xs shadow-[0_8px_24px_rgb(0_0_0/0.5)]">
                    <p className="mb-1.5 font-medium text-foreground">
                      Budżet {formatCurrency(Number(label), currency, 0)}
                    </p>
                    {scenarios.map((s) => {
                      const entry = payload.find((p) => p.dataKey === s.id)
                      if (entry?.value === undefined) return null
                      return (
                        <p key={s.id} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: s.color }}
                            />
                            {s.label}
                          </span>
                          <span className="font-medium text-foreground tabular">
                            {formatCurrency(Number(entry.value), currency, 0)}
                          </span>
                        </p>
                      )
                    })}
                  </div>
                ) : null
              }
            />
            {scenarios.map((s) => (
              <Line
                key={s.id}
                dataKey={s.id}
                type="monotone"
                stroke={s.color}
                strokeWidth={2.25}
                // Neon: the line glows in its own colour.
                style={{ filter: `drop-shadow(0 0 5px ${s.color})` }}
                strokeDasharray={s.dash}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#121620" }}
                isAnimationActive={false}
              />
            ))}
            {optimum && (
              <ReferenceDot
                x={optimum.budget}
                y={optimum.profit}
                r={5}
                fill="#7c6cff"
                stroke="#121620"
                strokeWidth={2}
                label={{
                  value: "Najwyższy zysk",
                  position: "top",
                  fill: "#c9cfdb",
                  fontSize: 11,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
