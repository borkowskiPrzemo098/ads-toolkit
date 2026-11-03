import Link from "next/link"
import { cn } from "@/lib/utils"

export interface NeonBar {
  label: string
  value: number
  /** Formatted value printed at the end of the bar. */
  display: string
  /** Neon colour of this bar; defaults to the page's --tool. */
  color?: string
  /** Optional second line under the label (e.g. "4 frazy"). */
  note?: string
  /** Makes the label a link; the list is then read directly instead of the sr-only table. */
  href?: string
}

interface NeonBarsProps {
  bars: NeonBar[]
  /** Caption for screen readers; the same data is in an sr-only table. */
  caption: string
  /** Scale maximum; defaults to the largest value. */
  max?: number
  className?: string
}

/**
 * Horizontal glowing bars: label, bar, value. Lengths are proportional to the value (from
 * zero), every value is printed, and a table carries the data for assistive technology.
 */
export function NeonBars({ bars, caption, max, className }: NeonBarsProps) {
  const top = max ?? Math.max(...bars.map((b) => b.value), 0)
  const linked = bars.some((b) => b.href)
  return (
    <figure className={className}>
      <ul className="flex flex-col gap-3" aria-hidden={linked ? undefined : true}>
        {bars.map((bar) => {
          const width =
            top > 0 ? Math.max((bar.value / top) * 100, bar.value > 0 ? 2 : 0) : 0
          return (
            <li
              key={bar.label}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 [--bar:var(--tool)]"
              style={
                bar.color ? ({ "--bar": bar.color } as React.CSSProperties) : undefined
              }
            >
              <span className="min-w-0">
                {bar.href ? (
                  <Link
                    href={bar.href}
                    className="block truncate rounded text-sm text-[#d6dbe5] transition-colors duration-150 hover:text-(--bar)"
                  >
                    {bar.label}
                  </Link>
                ) : (
                  <span className="block truncate text-sm text-[#d6dbe5]">
                    {bar.label}
                  </span>
                )}
                {bar.note && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {bar.note}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="relative h-3 min-w-0 flex-1 rounded-full bg-[#1a202c]">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      "bg-linear-to-r from-[color-mix(in_oklab,var(--bar)_45%,transparent)] to-(--bar)",
                      "shadow-[0_0_14px_-2px_var(--bar)] transition-[width] duration-500 ease-out-quart"
                    )}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="shrink-0 text-sm font-semibold text-(--bar) tabular">
                  {bar.display}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {!linked && (
        <table className="sr-only">
          <caption>{caption}</caption>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{bar.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
