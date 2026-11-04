"use client"

import { formatNumber } from "@/lib/formatting/number"
import type {
  groupRecommendations,
  Priority,
  Recommendation,
} from "@/lib/auditor/recommendations"
import { cn } from "@/lib/utils"

const PRIORITY_STYLE: Record<Priority, string> = {
  Pilny: "bg-destructive text-[#0b0d12]",
  Wysoki: "bg-[#ff4f8b]/18 text-[#ff8db3] ring-[#ff4f8b]/40",
  Średni: "bg-warning/15 text-warning ring-warning/35",
  Niski: "bg-[#1a202c] text-[#c9cfdb] ring-border",
}

const GROUP_COLOR: Record<string, string> = {
  urgent: "#ff4f8b",
  costs: "#ffc23d",
  conversion: "#36d6ff",
  value: "#2ef2a0",
  newKeywords: "#c6f35c",
  exclusions: "#c17bff",
  monitor: "#929bac",
}

/** Spec section 7: problem → evidence → interpretation → action, grouped in seven groups. */
export function RecommendationsPanel({
  groups,
}: {
  groups: ReturnType<typeof groupRecommendations>
}) {
  if (!groups.length)
    return (
      <p className="text-sm text-muted-foreground">
        Brak rekomendacji dla zaimportowanych danych.
      </p>
    )
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Grupy rekomendacji" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#rec-${g.id}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm transition-colors duration-150 hover:border-[#3a4456]"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: GROUP_COLOR[g.id] }}
              aria-hidden="true"
            />
            {g.label}
            <span className="font-semibold tabular" style={{ color: GROUP_COLOR[g.id] }}>
              {formatNumber(g.items.length)}
            </span>
          </a>
        ))}
      </nav>
      {groups.map((g) => (
        <section
          key={g.id}
          id={`rec-${g.id}`}
          aria-labelledby={`rec-h-${g.id}`}
          className="scroll-mt-6"
        >
          <h2
            id={`rec-h-${g.id}`}
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <span
              className="h-5 w-1.5 rounded-full"
              style={{
                background: GROUP_COLOR[g.id],
                boxShadow: `0 0 12px ${GROUP_COLOR[g.id]}`,
              }}
              aria-hidden="true"
            />
            {g.label}
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{g.description}</p>
          <ol className="flex flex-col gap-4">
            {g.items.map((r) => (
              <li key={r.id}>
                <RecommendationCard rec={r} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article
      aria-label={rec.problem}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            PROBLEM
          </p>
          <h3 className="mt-0.5 font-semibold tracking-tight [overflow-wrap:anywhere]">
            {rec.problem}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-transparent ring-inset",
              PRIORITY_STYLE[rec.priority]
            )}
          >
            Priorytet: {rec.priority}
          </span>
          <span className="rounded-md bg-[#1a202c] px-2 py-0.5 text-xs text-[#c9cfdb] ring-1 ring-border ring-inset">
            Pewność: {rec.confidenceLabel}
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 text-sm leading-relaxed lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
            DOWÓD
          </p>
          <dl className="flex flex-col gap-1 rounded-lg bg-background/50 p-3">
            {rec.evidence.map((e) => (
              <div
                key={e.label}
                className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3"
              >
                <dt className="[overflow-wrap:anywhere] text-muted-foreground">
                  {e.label}
                </dt>
                <dd className="font-medium tabular sm:text-right">{e.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">
              INTERPRETACJA
            </p>
            <p>{rec.interpretation}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-(--tool)">
              DZIAŁANIE
            </p>
            <p>{rec.action}</p>
          </div>
          {rec.impact && <p className="text-muted-foreground">{rec.impact}</p>}
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Źródło: {rec.source.report} · {rec.source.dimension}
        {rec.source.period && ` · ${rec.source.period}`}
      </p>
    </article>
  )
}
