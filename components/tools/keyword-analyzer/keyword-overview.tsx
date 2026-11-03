"use client"

import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  LENGTH_LABEL,
} from "@/constants/keyword-analyzer"
import type { KeywordStats, LengthGroup } from "@/lib/calculations/keyword-analyzer"
import { formatNumber } from "@/lib/formatting/number"
import type { KeywordFilters } from "@/lib/keywords/filter"
import { cn } from "@/lib/utils"

interface KeywordOverviewProps {
  stats: KeywordStats
  filters: KeywordFilters
  onFiltersChange: (patch: Partial<KeywordFilters>) => void
}

/** Counters plus category and length chips that double as filters. */
export function KeywordOverview({
  stats,
  filters,
  onFiltersChange,
}: KeywordOverviewProps) {
  const counters = [
    { label: "Fraz na liście", value: stats.analyzed },
    { label: "Unikalnych", value: stats.unique },
    {
      label: "Duplikatów",
      value: stats.duplicates,
      tone: stats.duplicates > 0 ? "bad" : undefined,
    },
    {
      label: "Podobnych",
      value: stats.nearDuplicates,
      tone: stats.nearDuplicates > 0 ? "warn" : undefined,
    },
    { label: "Bardzo ogólnych", value: stats.generic },
  ] as const

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {counters.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <dt className="text-xs text-muted-foreground">{c.label}</dt>
            <dd
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight tabular",
                "tone" in c && c.tone === "bad" && "text-destructive",
                "tone" in c && c.tone === "warn" && "text-warning"
              )}
            >
              {formatNumber(c.value)}
            </dd>
          </div>
        ))}
      </dl>

      {(stats.empty > 0 || stats.overLimit > 0) && (
        <p className="text-xs text-muted-foreground">
          {stats.empty > 0 && `Pominięto ${formatNumber(stats.empty)} pustych wierszy. `}
          {stats.overLimit > 0 &&
            `${formatNumber(stats.overLimit)} fraz ponad limit nie zostało przeanalizowanych; podziel listę.`}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <ChipRow label="Kategoria">
          <Chip
            active={filters.category === "all"}
            onClick={() => onFiltersChange({ category: "all" })}
          >
            Wszystkie
          </Chip>
          {CATEGORY_ORDER.filter((c) => stats.byCategory[c]).map((c) => (
            <Chip
              key={c}
              active={filters.category === c}
              count={stats.byCategory[c]}
              onClick={() =>
                onFiltersChange({ category: filters.category === c ? "all" : c })
              }
            >
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Długość">
          <Chip
            active={filters.length === "all"}
            onClick={() => onFiltersChange({ length: "all" })}
          >
            Wszystkie
          </Chip>
          {(Object.keys(LENGTH_LABEL) as LengthGroup[]).map((l) => (
            <Chip
              key={l}
              active={filters.length === l}
              count={stats.byLength[l]}
              onClick={() =>
                onFiltersChange({ length: filters.length === l ? "all" : l })
              }
            >
              {LENGTH_LABEL[l]}
            </Chip>
          ))}
        </ChipRow>
      </div>
    </div>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors duration-150",
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border bg-card text-[#c9cfdb] hover:border-[#3a4456] hover:bg-[#141925]"
      )}
    >
      {children}
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular">
          {formatNumber(count)}
        </span>
      )}
    </button>
  )
}
