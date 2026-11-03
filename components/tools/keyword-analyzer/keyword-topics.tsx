"use client"

import { ArrowRight } from "lucide-react"
import type { KeywordRow, KeywordTopic } from "@/lib/calculations/keyword-analyzer"
import { formatNumber } from "@/lib/formatting/number"

const PREVIEW = 8

interface KeywordTopicsProps {
  topics: KeywordTopic[]
  rowsById: Map<number, KeywordRow>
  onOpenTopic: (name: string) => void
}

/** Topic groups: each phrase joins the group of its most common subject word. */
export function KeywordTopics({ topics, rowsById, onOpenTopic }: KeywordTopicsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Fraza trafia do grupy najczęstszego słowa, które opisuje temat. Pomijamy słowa
        typu „tanie”, „kup” czy nazwy miast. To punkt wyjścia do grup reklam, nie gotowy
        podział.
      </p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {topics.map((topic) => {
          const unique = topic.rowIds
            .map((id) => rowsById.get(id)!)
            .filter((r) => r.status !== "duplicate")
          return (
            <li
              key={topic.name}
              className="flex flex-col rounded-xl border border-border bg-background/40 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="truncate font-semibold">{topic.name}</h3>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {formatNumber(unique.length)} fraz
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {unique.slice(0, PREVIEW).map((row) => (
                  <li
                    key={row.id}
                    className="max-w-full truncate rounded-md bg-secondary px-2 py-0.5 text-xs text-[#c9cfdb]"
                  >
                    {row.keyword}
                  </li>
                ))}
                {unique.length > PREVIEW && (
                  <li className="px-1 py-0.5 text-xs text-muted-foreground">
                    i {formatNumber(unique.length - PREVIEW)} więcej
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => onOpenTopic(topic.name)}
                className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-sm font-medium text-[#b3a9ff] transition-colors hover:text-foreground"
              >
                Pokaż w tabeli
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
