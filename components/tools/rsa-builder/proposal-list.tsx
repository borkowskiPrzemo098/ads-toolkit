"use client"

import { Check, Plus } from "lucide-react"
import { FORMULAS, missingInputs, type Proposal, type RsaBrief } from "@/lib/rsa/formulas"
import { limitOf, type AssetKind } from "@/lib/rsa/limits"
import { cn } from "@/lib/utils"

const FIELD_LABEL: Record<keyof RsaBrief, string> = {
  brand: "nazwę firmy",
  product: "produkt",
  keywords: "słowa kluczowe",
  benefits: "korzyści",
  audience: "grupę docelową",
  ctas: "wezwanie do działania",
  price: "cenę",
  problem: "problem klienta",
  offer: "informacje o ofercie",
}

interface ProposalListProps {
  kind: AssetKind
  proposals: Proposal[]
  brief: RsaBrief
  /** Normalised texts already in the ad. */
  used: Set<string>
  full: boolean
  onAdd: (proposal: Proposal) => void
}

export const normalizeText = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")

export function ProposalList({
  kind,
  proposals,
  brief,
  used,
  full,
  onAdd,
}: ProposalListProps) {
  const ofKind = proposals.filter((p) => p.kind === kind)
  const limit = limitOf(kind)

  return (
    <div className="flex flex-col gap-6">
      {full && (
        <p className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-[#f7cf7c]">
          Reklama ma już maksymalną liczbę{" "}
          {kind === "headline" ? "nagłówków (15)" : "tekstów (4)"}. Usuń któryś, aby dodać
          nowy.
        </p>
      )}
      {FORMULAS.map((formula) => {
        const items = ofKind.filter((p) => p.formula === formula.id)
        const missing = missingInputs(brief, formula.id)
        if (items.length === 0 && missing.length === 0) return null
        return (
          <section key={formula.id} aria-labelledby={`f-${kind}-${formula.id}`}>
            <h3 id={`f-${kind}-${formula.id}`} className="text-sm font-semibold">
              {formula.label}
            </h3>
            <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
              {formula.description}
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Uzupełnij {missing.map((m) => FIELD_LABEL[m]).join(" i ")}, aby zobaczyć
                propozycje.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((p) => {
                  const added = used.has(normalizeText(p.text))
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={added || full}
                        onClick={() => onAdd(p)}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150",
                          added
                            ? "border-success/30 bg-success/6 text-muted-foreground"
                            : "border-border bg-background/40 hover:border-[#3a4456] hover:bg-[#141925] disabled:opacity-50"
                        )}
                        aria-label={added ? `Dodano: ${p.text}` : `Dodaj: ${p.text}`}
                      >
                        <span className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground">
                          {added ? (
                            <Check className="size-4 text-success" aria-hidden="true" />
                          ) : (
                            <Plus className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">{p.text}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {p.length}/{limit}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
