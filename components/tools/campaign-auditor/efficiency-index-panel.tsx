"use client"

import { Panel } from "@/components/layout/panel"
import type { EfficiencyIndex } from "@/lib/auditor/efficiency-index"
import { formatNumber } from "@/lib/formatting/number"

/** Colour by score: the same neon scale everywhere (pink → amber → mint). */
const scoreColor = (s: number) => (s >= 75 ? "#2ef2a0" : s >= 50 ? "#ffc23d" : "#ff4f8b")

/** Spec section 8: optional 0–100 index, with what was assessed and how. Not a Google score. */
export function EfficiencyIndexPanel({ index }: { index: EfficiencyIndex }) {
  const assessed = index.areas.filter((a) => a.score !== null)
  const missing = index.areas.filter((a) => a.score === null)
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="shrink-0">
            <p className="text-sm font-medium text-muted-foreground">
              Indeks efektywności kampanii
            </p>
            {index.overall === null ? (
              <p className="mt-2 text-4xl font-semibold text-[#4a5466]">—</p>
            ) : (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span
                  className="text-6xl font-semibold tracking-tight tabular neon-text"
                  style={{ color: scoreColor(index.overall) }}
                >
                  {index.overall}
                </span>
                <span className="text-xl text-muted-foreground">/ 100</span>
              </p>
            )}
          </div>
          <div className="flex-1 text-sm leading-relaxed text-muted-foreground md:border-l md:border-border md:pl-6">
            <p>
              Ocenione obszary:{" "}
              <span className="font-semibold text-foreground tabular">
                {index.assessed} z {index.areas.length}
              </span>{" "}
              (kompletność audytu {formatNumber(index.completeness * 100)}%).
            </p>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {index.areas.map((a) => (
                <span
                  key={a.area}
                  className="h-2 flex-1 rounded-full"
                  style={{
                    background: a.score === null ? "#1f2632" : scoreColor(a.score),
                  }}
                />
              ))}
            </div>
            <p className="mt-3">
              Każdy obszar: 100 × (1 − udział kosztu w elementach z wykrytymi problemami).
              Wynik ogólny to średnia ocenionych obszarów. Brak danych nie obniża wyniku.
              To wskaźnik tej aplikacji, a nie oficjalna ocena Google.
            </p>
          </div>
        </div>
      </Panel>

      {assessed.length > 0 && (
        <Panel title="Ocenione obszary">
          <ul className="flex flex-col gap-4">
            {assessed.map((a) => (
              <li key={a.area}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{a.label}</span>
                  <span
                    className="text-lg font-semibold tabular"
                    style={{ color: scoreColor(a.score!) }}
                  >
                    {a.score}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2.5 rounded-full bg-[#1a202c]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.score}%`,
                      background: scoreColor(a.score!),
                      boxShadow: `0 0 12px -2px ${scoreColor(a.score!)}`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {a.basis}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {missing.length > 0 && (
        <Panel
          title="Nieocenione obszary"
          description="Brak danych to nie błąd konta. Dodaj raporty, aby ocenić te obszary."
        >
          <ul className="flex flex-col gap-2 text-sm">
            {missing.map((a) => (
              <li key={a.area} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="font-medium sm:w-60 sm:shrink-0">{a.label}</span>
                <span className="text-muted-foreground">{a.basis}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
