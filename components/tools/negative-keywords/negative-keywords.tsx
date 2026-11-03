"use client"

import { useMemo, useState } from "react"
import { Info, RotateCcw, Search } from "lucide-react"
import { NeonBars } from "@/components/charts/neon-bars"
import { ExportButtons } from "@/components/export/export-buttons"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { SelectField } from "@/components/forms/select-field"
import { MobileResultBar } from "@/components/layout/mobile-result-bar"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DECISION_FILTER_OPTIONS,
  MATCH_TYPE_HINT,
  MATCH_TYPE_OPTIONS,
  NEGATIVE_CATEGORIES,
  type DecisionFilter,
} from "@/constants/negative-keywords"
import { NEON_SERIES } from "@/constants/neon"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { splitKeywordText } from "@/lib/calculations/keyword-analyzer"
import {
  buildNegativeList,
  suggestNegatives,
  type MatchType,
  type NegativeAnalysis,
  type SuggestionDecision,
} from "@/lib/calculations/negative-keywords"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { negativeCsvRows, negativePlainList } from "@/lib/export/negative-keywords"
import { formatCurrency, formatNumber, type Currency } from "@/lib/formatting/number"
import { stripDiacritics } from "@/lib/keywords/normalize"
import { NegativeListPanel } from "./negative-list-panel"
import { SuggestionList } from "./suggestion-list"
import { TermsInput, type TermsInputValue } from "./terms-input"

const EMPTY_INPUT: TermsInputValue = {
  text: "",
  importedTerms: null,
  offerWords: "",
  competitors: "",
  customWords: "",
}

const FILE_BASE = "wykluczajace-slowa-kluczowe"
const LIST_ID = "lista-wykluczen"
const splitList = (text: string) => text.split(",")

export function NegativeKeywords() {
  const [input, setInput] = useState(EMPTY_INPUT)
  const [analysis, setAnalysis] = useState<NegativeAnalysis | null>(null)
  const [analyzedInput, setAnalyzedInput] = useState<TermsInputValue | null>(null)
  // Decisions survive re-analysis: suggestion ids are stable (category + stem).
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({})
  const [defaultMatch, setDefaultMatch] = useState<MatchType>("broad")
  const [filter, setFilter] = useState<DecisionFilter>("all")
  const [query, setQuery] = useState("")
  const [currency, setCurrency] = useState<Currency>("PLN")

  const stale = analysis !== null && analyzedInput !== input

  const analyze = () => {
    const terms =
      input.importedTerms ??
      splitKeywordText(input.text, "auto").map((term) => ({
        term,
        clicks: null,
        impressions: null,
        cost: null,
        conversions: null,
      }))
    setAnalysis(
      suggestNegatives(terms, {
        offerWords: splitList(input.offerWords),
        competitors: splitList(input.competitors),
        customWords: splitList(input.customWords),
      })
    )
    setAnalyzedInput(input)
  }

  const list = useMemo(
    () =>
      analysis
        ? buildNegativeList(analysis, decisions, defaultMatch)
        : { entries: [], duplicatesRemoved: 0, rejected: [] },
    [analysis, decisions, defaultMatch]
  )

  const searched = useMemo(() => {
    if (!analysis) return []
    const q = stripDiacritics(query.trim().toLocaleLowerCase("pl-PL"))
    if (!q) return analysis.suggestions
    return analysis.suggestions.filter(
      (s) =>
        s.forms.some((f) => stripDiacritics(f).includes(q)) ||
        s.termIndexes.some((i) => stripDiacritics(analysis.terms[i].term).includes(q))
    )
  }, [analysis, query])

  const accepted = useMemo(
    () =>
      analysis
        ? analysis.suggestions.filter((s) => decisions[s.id]?.status === "accepted")
        : [],
    [analysis, decisions]
  )
  const acceptedCost = useMemo(() => {
    if (!analysis?.stats.hasMetrics) return null
    const terms = new Set(accepted.flatMap((s) => s.termIndexes))
    return [...terms].reduce((sum, i) => sum + (analysis.terms[i].cost ?? 0), 0)
  }, [analysis, accepted])

  // Per category: how many search terms it covers, and their cost when the import had metrics.
  const byCategory = useMemo(() => {
    if (!analysis) return []
    return NEGATIVE_CATEGORIES.flatMap((c) => {
      const terms = new Set(
        analysis.suggestions
          .filter((s) => s.category === c.id)
          .flatMap((s) => s.termIndexes)
      )
      if (!terms.size) return []
      const cost = [...terms].reduce((sum, i) => sum + (analysis.terms[i].cost ?? 0), 0)
      return [{ id: c.id, label: c.label, terms: terms.size, cost }]
    })
  }, [analysis])

  const NEW_DECISION: SuggestionDecision = { status: "pending", matchType: null }

  const decide = (id: string, patch: Partial<SuggestionDecision>) =>
    setDecisions((all) => ({ ...all, [id]: { ...(all[id] ?? NEW_DECISION), ...patch } }))

  const bulk = (ids: string[], status: SuggestionDecision["status"]) =>
    setDecisions((all) => {
      const next = { ...all }
      for (const id of ids) next[id] = { ...(all[id] ?? NEW_DECISION), status }
      return next
    })

  const reset = () => {
    setInput(EMPTY_INPUT)
    setAnalysis(null)
    setAnalyzedInput(null)
    setDecisions({})
    setQuery("")
    setFilter("all")
  }

  const exportCsv = () =>
    analysis &&
    downloadCsv(toCsv(negativeCsvRows(list, analysis)), datedFilename(FILE_BASE, "csv"))

  const exportText = () =>
    downloadBlob(
      new Blob([negativePlainList(list)], { type: "text/plain;charset=utf-8" }),
      datedFilename(FILE_BASE, "txt")
    )

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["negative-keywords"]}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <SegmentedControl
              label="Waluta kosztów"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "PLN", label: "PLN" },
                { value: "EUR", label: "EUR" },
              ]}
            />
            <Button variant="ghost" onClick={reset} disabled={!input.text && !analysis}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons
              disabled={list.entries.length === 0}
              onCsv={exportCsv}
              onText={exportText}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <p className="flex gap-3 rounded-xl border border-[#2f3848] bg-[#141925] px-4 py-3 text-sm leading-relaxed text-[#c9cfdb]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#a89dff]" aria-hidden="true" />
          To sugestie, nie gotowa lista. Słowo niepożądane w jednej firmie bywa cenne w
          innej, np. „tanie” w sklepie premium i w dyskoncie. Do eksportu trafia tylko to,
          co zaakceptujesz.
        </p>

        <Panel title="Wyszukiwane hasła">
          <TermsInput
            value={input}
            onChange={(patch) => setInput((v) => ({ ...v, ...patch }))}
            onAnalyze={analyze}
            stale={stale}
          />
        </Panel>

        {analysis && (
          <>
            {stale && (
              <p className="rounded-lg border border-warning/30 bg-warning/8 px-4 py-2.5 text-sm text-[#f7cf7c]">
                Dane zmieniły się od ostatniego wyszukiwania. Sugestie poniżej dotyczą
                poprzedniej wersji.
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Stat
                label="Unikalnych zapytań"
                value={formatNumber(analysis.stats.uniqueTerms)}
              />
              <Stat
                label="Scalonych powtórzeń"
                value={formatNumber(analysis.stats.duplicateTerms)}
              />
              <Stat label="Sugestii" value={formatNumber(analysis.suggestions.length)} />
              <Stat label="Do wykluczenia" value={formatNumber(accepted.length)} accent />
              {acceptedCost !== null && (
                <Stat
                  label="Koszt wykluczanych zapytań"
                  value={formatCurrency(acceptedCost, currency)}
                />
              )}
            </dl>

            {byCategory.length > 0 && (
              <Panel
                title={
                  analysis.stats.hasMetrics
                    ? "Koszt zapytań według kategorii"
                    : "Zapytania według kategorii"
                }
                description="Ile zapytań obejmują sugestie z każdej kategorii. Jedno zapytanie może trafić do kilku kategorii."
              >
                <NeonBars
                  caption="Zapytania objęte sugestiami w każdej kategorii"
                  bars={byCategory.map((c, i) => ({
                    label: c.label,
                    value: analysis.stats.hasMetrics ? c.cost : c.terms,
                    display: analysis.stats.hasMetrics
                      ? formatCurrency(c.cost, currency)
                      : formatNumber(c.terms),
                    note: analysis.stats.hasMetrics
                      ? `${formatNumber(c.terms)} zapyt.`
                      : undefined,
                    color: NEON_SERIES[(i + 2) % NEON_SERIES.length],
                  }))}
                />
              </Panel>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <Panel title="Sugestie wykluczeń">
                <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem]">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      aria-label="Szukaj w sugestiach i zapytaniach"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Szukaj w sugestiach i zapytaniach"
                      className="pl-9"
                    />
                  </div>
                  <SelectField
                    label="Pokaż"
                    hideLabel
                    value={filter}
                    options={DECISION_FILTER_OPTIONS}
                    onChange={setFilter}
                  />
                </div>
                <SuggestionList
                  analysis={analysis}
                  suggestions={searched}
                  decisions={decisions}
                  currency={currency}
                  filter={filter}
                  onDecide={decide}
                  onBulk={bulk}
                />
              </Panel>

              <div
                id={LIST_ID}
                className="flex scroll-mt-20 flex-col gap-5 lg:sticky lg:top-6"
              >
                <Panel title="Domyślne dopasowanie">
                  <SelectField
                    label="Typ dopasowania wykluczeń"
                    hideLabel
                    value={defaultMatch}
                    options={MATCH_TYPE_OPTIONS}
                    onChange={setDefaultMatch}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {MATCH_TYPE_HINT[defaultMatch]} Wykluczenia nie obejmują odmian,
                    dlatego eksportujemy każdą formę słowa z zapytań.
                  </p>
                </Panel>
                <Panel title="Twoja lista wykluczeń">
                  <NegativeListPanel list={list} />
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>

      <MobileResultBar
        label="Twoja lista wykluczeń"
        value={
          list.entries.length ? `${formatNumber(list.entries.length)} pozycji` : null
        }
        tone="good"
        targetId={LIST_ID}
      />
    </>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          accent
            ? "mt-1 text-2xl font-semibold tracking-tight text-(--tool) tabular neon-text"
            : "mt-1 text-2xl font-semibold tracking-tight tabular"
        }
      >
        {value}
      </dd>
    </div>
  )
}
