"use client"

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CATEGORY_LABEL,
  INTENT_LABEL,
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  STATUS_LABEL,
} from "@/constants/keyword-analyzer"
import type { KeywordRow } from "@/lib/calculations/keyword-analyzer"
import { formatNumber } from "@/lib/formatting/number"
import type { KeywordFilters } from "@/lib/keywords/filter"
import { cn } from "@/lib/utils"

export const PAGE_SIZE = 100

interface KeywordTableProps {
  rows: KeywordRow[]
  total: number
  filters: KeywordFilters
  onFiltersChange: (patch: Partial<KeywordFilters>) => void
  page: number
  onPageChange: (page: number) => void
}

const STATUS_STYLE = {
  unique: "text-muted-foreground",
  duplicate: "bg-destructive/15 text-[#f59a9a]",
  "near-duplicate": "bg-warning/15 text-[#f7cf7c]",
}

export function KeywordTable({
  rows,
  total,
  filters,
  onFiltersChange,
  page,
  onPageChange,
}: KeywordTableProps) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Szukaj w frazach"
            value={filters.query}
            onChange={(e) => onFiltersChange({ query: e.target.value })}
            placeholder="Szukaj: buty, kurtki, -tanie"
            className="pl-9"
          />
        </div>
        <SelectField
          label="Status"
          hideLabel
          value={filters.status}
          options={STATUS_FILTER_OPTIONS}
          onChange={(status) => onFiltersChange({ status })}
        />
        <SelectField
          label="Sortowanie"
          hideLabel
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => onFiltersChange({ sort })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular">
          {formatNumber(rows.length)} z {formatNumber(total)} fraz
        </span>
        {filters.topic && (
          <button
            type="button"
            onClick={() => onFiltersChange({ topic: null })}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary/15 px-2.5 text-xs text-foreground transition-colors hover:bg-primary/25"
          >
            Temat: {filters.topic}
            <X className="size-3.5" aria-label="Usuń filtr tematu" />
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
          Żadna fraza nie pasuje do filtrów.
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="w-12 py-2 pr-3 font-medium">
                  Lp.
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Słowo kluczowe
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Kategoria
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Słowa
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Możliwa intencja
                </th>
                <th scope="col" className="py-2 font-medium">
                  Działanie
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="align-top transition-colors hover:bg-[#141925]"
                >
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground tabular">
                    {row.id + 1}
                  </td>
                  <td className="max-w-72 py-2.5 pr-3">
                    <span className="font-medium break-words">{row.keyword}</span>
                    {row.original.trim() !== row.keyword && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        oryginał: {row.original.trim()}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs whitespace-nowrap">
                      {CATEGORY_LABEL[row.category]}
                    </span>
                    {row.tags.length > 1 && (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        też:{" "}
                        {row.tags
                          .filter((t) => t !== row.category)
                          .map((t) => CATEGORY_LABEL[t].toLowerCase())
                          .join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular">{row.wordCount}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-xs whitespace-nowrap",
                        STATUS_STYLE[row.status]
                      )}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.generic && row.status === "unique" && (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        bardzo ogólna
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-[#c9cfdb]">
                    {INTENT_LABEL[row.intent]}
                  </td>
                  <td className="max-w-80 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    {row.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav
          aria-label="Strony tabeli"
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeft />
            Poprzednie
          </Button>
          <span className="text-sm text-muted-foreground tabular">
            Strona {current + 1} z {pages}
          </span>
          <Button
            variant="outline"
            disabled={current >= pages - 1}
            onClick={() => onPageChange(current + 1)}
          >
            Następne
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  )
}
