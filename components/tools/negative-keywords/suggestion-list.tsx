"use client"

import { Check, TriangleAlert, X } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import {
  MATCH_TYPE_OPTIONS,
  NEGATIVE_CATEGORIES,
  type DecisionFilter,
} from "@/constants/negative-keywords"
import type {
  MatchType,
  NegativeAnalysis,
  NegativeSuggestion,
  SuggestionDecision,
} from "@/lib/calculations/negative-keywords"
import { formatCurrency, formatNumber, type Currency } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"

const PREVIEW_TERMS = 3

interface SuggestionListProps {
  analysis: NegativeAnalysis
  suggestions: NegativeSuggestion[]
  decisions: Record<string, SuggestionDecision>
  currency: Currency
  filter: DecisionFilter
  onDecide: (id: string, patch: Partial<SuggestionDecision>) => void
  onBulk: (ids: string[], status: SuggestionDecision["status"]) => void
}

const statusOf = (decisions: Record<string, SuggestionDecision>, id: string) =>
  decisions[id]?.status ?? "pending"

export function SuggestionList(props: SuggestionListProps) {
  const { suggestions, decisions, filter } = props
  const visible = suggestions.filter(
    (s) => filter === "all" || statusOf(decisions, s.id) === filter
  )

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
        {suggestions.length === 0
          ? "Nie znaleźliśmy sugestii. Dodaj słowa oferty, konkurencję albo własne słowa."
          : "Brak sugestii w tym widoku."}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {NEGATIVE_CATEGORIES.map((category) => {
        const items = visible.filter((s) => s.category === category.id)
        if (items.length === 0) return null
        const safeToAccept = items.filter((s) => !(s.conversions && s.conversions > 0))
        const skipped = items.length - safeToAccept.length
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <header className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 id={`cat-${category.id}`} className="font-semibold tracking-tight">
                  {category.label}{" "}
                  <span className="font-normal text-muted-foreground tabular">
                    {items.length}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {category.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={safeToAccept.length === 0}
                  onClick={() =>
                    props.onBulk(
                      safeToAccept.map((s) => s.id),
                      "accepted"
                    )
                  }
                  title={
                    skipped
                      ? `Pomija ${skipped} z konwersjami; o nich zdecyduj osobno.`
                      : undefined
                  }
                >
                  <Check />
                  Wyklucz wszystkie
                  {skipped > 0 && (
                    <span className="text-muted-foreground">(bez {skipped})</span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    props.onBulk(
                      items.map((s) => s.id),
                      "rejected"
                    )
                  }
                >
                  <X />
                  Zostaw wszystkie
                </Button>
              </div>
            </header>
            <ul className="flex flex-col gap-2">
              {items.map((s) => (
                <SuggestionRow key={s.id} suggestion={s} {...props} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function SuggestionRow({
  suggestion: s,
  analysis,
  decisions,
  currency,
  onDecide,
}: SuggestionListProps & { suggestion: NegativeSuggestion }) {
  const status = statusOf(decisions, s.id)
  const matchType = decisions[s.id]?.matchType ?? null
  const terms = s.termIndexes.map((i) => analysis.terms[i])
  const hasConversions = (s.conversions ?? 0) > 0
  const label = s.forms.join(", ")

  return (
    <li
      className={cn(
        "grid gap-3 rounded-xl border p-3.5 transition-colors duration-150 sm:grid-cols-[auto_minmax(0,1fr)_11rem] sm:items-start",
        status === "accepted" && "border-success/40 bg-success/6",
        status === "rejected" && "border-border bg-transparent opacity-60",
        status === "pending" && "border-border bg-background/40"
      )}
    >
      <div className="flex gap-1.5" role="group" aria-label={`Decyzja: ${label}`}>
        <DecisionButton
          active={status === "accepted"}
          tone="accept"
          onClick={() =>
            onDecide(s.id, { status: status === "accepted" ? "pending" : "accepted" })
          }
        >
          <Check />
          Wyklucz
        </DecisionButton>
        <DecisionButton
          active={status === "rejected"}
          tone="reject"
          onClick={() =>
            onDecide(s.id, { status: status === "rejected" ? "pending" : "rejected" })
          }
        >
          <X />
          Zostaw
        </DecisionButton>
      </div>

      <div className="min-w-0">
        <p className="flex flex-wrap gap-1.5">
          {s.forms.map((form) => (
            <span
              key={form}
              className="rounded-md bg-secondary px-2 py-0.5 text-sm font-medium"
            >
              {form}
            </span>
          ))}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {formatNumber(terms.length)}{" "}
          {terms.length === 1 ? "zapytanie" : terms.length < 5 ? "zapytania" : "zapytań"}:{" "}
          {terms
            .slice(0, PREVIEW_TERMS)
            .map((t) => t.term)
            .join(" · ")}
          {terms.length > PREVIEW_TERMS && " · …"}
        </p>
        {terms.length > PREVIEW_TERMS && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-[#b3a9ff] hover:text-foreground">
              Pokaż wszystkie zapytania
            </summary>
            <ul className="mt-1.5 flex flex-col gap-0.5 pl-1">
              {terms.map((t) => (
                <li key={t.term}>{t.term}</li>
              ))}
            </ul>
          </details>
        )}
        {(s.cost !== null || s.clicks !== null) && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#c9cfdb] tabular">
            {s.cost !== null && <span>Koszt {formatCurrency(s.cost, currency)}</span>}
            {s.clicks !== null && <span>{formatNumber(s.clicks)} kliknięć</span>}
            {s.conversions !== null && !hasConversions && <span>0 konwersji</span>}
          </p>
        )}
        {hasConversions && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-warning/12 px-2 py-1 text-xs text-[#f7cf7c]">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Te zapytania dały {formatNumber(s.conversions!, 1)} konw. Sprawdź, zanim
            wykluczysz.
          </p>
        )}
      </div>

      <SelectField
        label={`Dopasowanie dla: ${label}`}
        hideLabel
        value={matchType ?? "default"}
        options={[{ value: "default", label: "Domyślne" }, ...MATCH_TYPE_OPTIONS]}
        onChange={(value) =>
          onDecide(s.id, { matchType: value === "default" ? null : (value as MatchType) })
        }
      />
    </li>
  )
}

function DecisionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: "accept" | "reject"
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 [&_svg]:size-4",
        !active &&
          "border-border bg-card text-[#c9cfdb] hover:border-[#3a4456] hover:text-foreground",
        active && tone === "accept" && "border-success bg-success text-[#06261a]",
        active && tone === "reject" && "border-[#3a4456] bg-secondary text-foreground"
      )}
    >
      {children}
    </button>
  )
}
