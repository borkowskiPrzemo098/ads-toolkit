"use client"

import dynamic from "next/dynamic"

/*
 * Recharts is about 100 KB gzipped and the charts only appear once the user has entered data,
 * so it loads in its own chunk. Placeholders keep the final size to avoid layout shift.
 */

export const ProfitCurveChart = dynamic(
  () => import("./profit-curve-chart").then((m) => m.ProfitCurveChart),
  {
    ssr: false,
    // Legend row (1 rem + 0.75 rem gap) plus the h-72 plot.
    loading: () => <div className="h-[19.75rem] w-full" aria-hidden="true" />,
  }
)

export const MetricBarChart = dynamic(
  () => import("./metric-bar-chart").then((m) => m.MetricBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-[#f4f5f8] p-3" aria-hidden="true">
        <div className="mb-1 h-4" />
        <div className="h-40" />
      </div>
    ),
  }
)

export const TimeSeriesChart = dynamic(
  () => import("./time-series-chart").then((m) => m.TimeSeriesChart),
  {
    ssr: false,
    loading: () => <div className="h-52" aria-hidden="true" />,
  }
)
