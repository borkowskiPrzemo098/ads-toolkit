"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ChartSeries } from "@/lib/reports/model"

interface MetricBarChartProps {
  title: string
  series: ChartSeries
  format: (value: number) => string
  compact: (value: number) => string
}

/** Single-series bar chart for the light report page; one y-axis, labelled in the title. */
export function MetricBarChart({ title, series, format, compact }: MetricBarChartProps) {
  const data = series.labels.map((label, i) => ({ label, value: series.values[i] }))
  return (
    <figure className="rounded-lg bg-[#f4f5f8] p-3">
      <figcaption className="mb-1 px-1 text-xs font-semibold text-[#14171e]">
        {title}
      </figcaption>
      <div className="h-40" role="img" aria-label={`Wykres: ${title}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e5eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#626a7a" }}
              tickLine={false}
              axisLine={{ stroke: "#d4d8e0" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fontSize: 11, fill: "#626a7a" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "rgb(124 108 255 / 0.08)" }}
              content={({ active, payload, label }) =>
                active && payload?.[0]?.value !== undefined ? (
                  <div className="rounded-md border border-[#e2e5eb] bg-white px-2.5 py-1.5 text-xs text-[#14171e] shadow-sm">
                    <p className="text-[#626a7a]">{label}</p>
                    <p className="font-semibold tabular">
                      {format(Number(payload[0].value))}
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar
              dataKey="value"
              fill="#7c6cff"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
