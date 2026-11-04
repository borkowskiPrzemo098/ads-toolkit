"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface TimePoint {
  /** Axis label ("1 paź"). */
  label: string
  /** null = no value that day (e.g. ROAS without cost); drawn as a gap, never as zero. */
  value: number | null
}

interface TimeSeriesChartProps {
  title: string
  points: TimePoint[]
  kind: "bar" | "line"
  color: string
  format: (value: number) => string
  compact: (value: number) => string
}

const AXIS = { fontSize: 11, fill: "#929bac" }

/** One metric over time on the dark dashboard; one y-axis, labelled in the title. */
export function TimeSeriesChart({
  title,
  points,
  kind,
  color,
  format,
  compact,
}: TimeSeriesChartProps) {
  const common = {
    data: points,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#1f2632" />
      <XAxis
        dataKey="label"
        tick={AXIS}
        tickLine={false}
        axisLine={{ stroke: "#3a4456" }}
        interval="preserveStartEnd"
        minTickGap={18}
      />
      <YAxis
        tick={AXIS}
        tickLine={false}
        axisLine={false}
        tickFormatter={compact}
        width={56}
      />
      <Tooltip
        cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
        contentStyle={{
          background: "#141925",
          border: "1px solid #2b3443",
          borderRadius: 10,
          fontSize: 12,
        }}
        labelStyle={{ color: "#c9cfdb" }}
        formatter={(v) => [typeof v === "number" ? format(v) : "N/D", title]}
      />
    </>
  )
  return (
    <figure>
      <div className="h-52" role="img" aria-label={`Wykres: ${title}`}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart {...common}>
              {axes}
              <Bar
                dataKey="value"
                fill={color}
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
                style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
              />
            </BarChart>
          ) : (
            <LineChart {...common}>
              {axes}
              <Line
                dataKey="value"
                stroke={color}
                strokeWidth={2.25}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                style={{ filter: `drop-shadow(0 0 5px ${color})` }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
