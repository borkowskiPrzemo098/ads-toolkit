import type { Interval } from "@/lib/calculations/ab-test"
import { formatNumber } from "@/lib/formatting/number"

interface Row {
  label: string
  /** Point estimate and interval as proportions (0.05 = 5%). */
  value: number
  interval: Interval
  color: string
}

/** Point estimates with 95% intervals on one shared scale, in percent. */
export function RateIntervals({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.interval.high), 0.0001) * 1.1
  const pos = (v: number) => `${(v / max) * 100}%`
  const pct = (v: number) => `${formatNumber(v * 100, 2)}%`

  return (
    <figure>
      <ul className="flex flex-col gap-5">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground tabular">
                {pct(row.value)} (95%: {pct(row.interval.low)}–{pct(row.interval.high)})
              </span>
            </div>
            {/* Glowing bar = conversion rate from zero; the whisker on it = 95% interval. */}
            <div
              className="relative h-7 rounded-md bg-[#1a202c]"
              style={{ "--bar": row.color } as React.CSSProperties}
              aria-hidden="true"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-linear-to-r from-[color-mix(in_oklab,var(--bar)_40%,transparent)] to-(--bar) shadow-[0_0_20px_-4px_var(--bar)]"
                style={{ width: pos(row.value) }}
              />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-[#f4f6fa]/85"
                style={{
                  left: pos(row.interval.low),
                  width: `calc(${pos(row.interval.high)} - ${pos(row.interval.low)})`,
                }}
              />
              {[row.interval.low, row.interval.high].map((v, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f4f6fa]/85"
                  style={{ left: pos(v) }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div
        className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular"
        aria-hidden="true"
      >
        <span>0%</span>
        <span>{pct(max)}</span>
      </div>
      <figcaption className="sr-only">
        Współczynniki konwersji z 95-procentowymi przedziałami ufności.
      </figcaption>
    </figure>
  )
}

/** The difference B − A with its interval against zero: crossing zero means "could be no effect". */
export function DifferenceInterval({
  diff,
  interval,
  label,
}: {
  diff: number
  interval: Interval
  label: string
}) {
  const extent =
    Math.max(Math.abs(interval.low), Math.abs(interval.high), Math.abs(diff)) * 1.15 ||
    0.01
  const pos = (v: number) => `${((v + extent) / (2 * extent)) * 100}%`
  const pp = (v: number) => `${v > 0 ? "+" : ""}${formatNumber(v * 100, 2)} p.p.`
  const crossesZero = interval.low <= 0 && interval.high >= 0

  return (
    <figure>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular">
          {pp(diff)} (95%: {pp(interval.low)} do {pp(interval.high)})
        </span>
      </div>
      <div className="relative h-8" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[#252d3a]" />
        <div className="absolute inset-y-0 w-px bg-[#929bac]" style={{ left: pos(0) }} />
        <div
          className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${crossesZero ? "bg-[#4a5466]" : "bg-(--tool)/60 shadow-[0_0_14px_var(--tool)]"}`}
          style={{
            left: pos(interval.low),
            width: `calc(${pos(interval.high)} - ${pos(interval.low)})`,
          }}
        />
        <div
          className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${crossesZero ? "bg-[#929bac]" : "bg-(--tool)"}`}
          style={{ left: pos(diff) }}
        />
      </div>
      <div
        className="mt-1 flex justify-between text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span>← wyższy w A</span>
        <span>0</span>
        <span>wyższy w B →</span>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {crossesZero
          ? "Przedział obejmuje zero: dane nie wykluczają braku różnicy."
          : "Przedział nie obejmuje zera."}
      </figcaption>
    </figure>
  )
}
