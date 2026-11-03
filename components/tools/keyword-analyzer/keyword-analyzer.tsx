"use client"

import { useMemo, useState, useTransition } from "react"
import { Info, RotateCcw } from "lucide-react"
import { ExportButtons } from "@/components/export/export-buttons"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { HEURISTIC_NOTE } from "@/constants/keyword-analyzer"
import { TOOL_BY_SLUG } from "@/constants/tools"
import {
  analyzeKeywords,
  splitKeywordText,
  type KeywordAnalysis,
  type Separator,
} from "@/lib/calculations/keyword-analyzer"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { keywordCsvRows, keywordPlainList } from "@/lib/export/keyword-analyzer"
import {
  DEFAULT_FILTERS,
  filterKeywordRows,
  type KeywordFilters,
} from "@/lib/keywords/filter"
import { KeywordInput } from "./keyword-input"
import { KeywordOverview } from "./keyword-overview"
import { KeywordTable } from "./keyword-table"
import { KeywordTopics } from "./keyword-topics"

const FILE_BASE = "analiza-slow-kluczowych"
type View = "table" | "topics"

export function KeywordAnalyzer() {
  const [text, setText] = useState("")
  const [separator, setSeparator] = useState<Separator>("auto")
  const [brands, setBrands] = useState("")
  const [analysis, setAnalysis] = useState<KeywordAnalysis | null>(null)
  const [analyzedInput, setAnalyzedInput] = useState<string | null>(null)
  const [filters, setFilters] = useState<KeywordFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [view, setView] = useState<View>("table")
  const [busy, startTransition] = useTransition()

  const inputKey = `${separator}\u0000${brands}\u0000${text}`
  const stale = analysis !== null && analyzedInput !== inputKey

  const analyze = () =>
    startTransition(() => {
      const result = analyzeKeywords(splitKeywordText(text, separator), {
        brands: brands.split(","),
      })
      setAnalysis(result)
      setAnalyzedInput(inputKey)
      setFilters(DEFAULT_FILTERS)
      setPage(0)
    })

  const filtered = useMemo(
    () => (analysis ? filterKeywordRows(analysis.rows, filters) : []),
    [analysis, filters]
  )
  const rowsById = useMemo(
    () => new Map((analysis?.rows ?? []).map((r) => [r.id, r])),
    [analysis]
  )

  const updateFilters = (patch: Partial<KeywordFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  const reset = () => {
    setText("")
    setBrands("")
    setSeparator("auto")
    setAnalysis(null)
    setAnalyzedInput(null)
    setFilters(DEFAULT_FILTERS)
  }

  const exportCsv = () =>
    analysis &&
    downloadCsv(toCsv(keywordCsvRows(analysis.rows)), datedFilename(FILE_BASE, "csv"))

  const exportText = () =>
    downloadBlob(
      new Blob([keywordPlainList(filtered)], { type: "text/plain;charset=utf-8" }),
      datedFilename("slowa-kluczowe", "txt")
    )

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["keyword-analyzer"]}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <Button variant="ghost" onClick={reset} disabled={!text && !analysis}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons
              disabled={!analysis || analysis.rows.length === 0}
              onCsv={exportCsv}
              onText={exportText}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <p className="flex gap-3 rounded-xl border border-[#2f3848] bg-[#141925] px-4 py-3 text-sm leading-relaxed text-[#c9cfdb]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#a89dff]" aria-hidden="true" />
          {HEURISTIC_NOTE}
        </p>

        <Panel title="Lista do analizy">
          <KeywordInput
            text={text}
            onTextChange={setText}
            separator={separator}
            onSeparatorChange={setSeparator}
            brands={brands}
            onBrandsChange={setBrands}
            onAnalyze={analyze}
            busy={busy}
            stale={stale}
          />
        </Panel>

        {analysis && (
          <>
            {stale && (
              <p className="rounded-lg border border-warning/30 bg-warning/8 px-4 py-2.5 text-sm text-[#f7cf7c]">
                Lista lub ustawienia zmieniły się od ostatniej analizy. Wyniki poniżej
                dotyczą poprzedniej wersji.
              </p>
            )}

            {analysis.rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
                Na liście nie ma żadnej frazy. Sprawdź sposób rozdzielania.
              </p>
            ) : (
              <>
                <KeywordOverview
                  stats={analysis.stats}
                  filters={filters}
                  onFiltersChange={updateFilters}
                />

                <Panel
                  title="Wyniki"
                  action={
                    <SegmentedControl
                      label="Widok wyników"
                      value={view}
                      onChange={setView}
                      options={[
                        { value: "table", label: "Tabela" },
                        { value: "topics", label: `Grupy (${analysis.topics.length})` },
                      ]}
                    />
                  }
                >
                  {view === "table" ? (
                    <KeywordTable
                      rows={filtered}
                      total={analysis.rows.length}
                      filters={filters}
                      onFiltersChange={updateFilters}
                      page={page}
                      onPageChange={setPage}
                    />
                  ) : (
                    <KeywordTopics
                      topics={analysis.topics}
                      rowsById={rowsById}
                      onOpenTopic={(topic) => {
                        updateFilters({ topic })
                        setView("table")
                      }}
                    />
                  )}
                </Panel>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Eksport CSV zawiera wszystkie frazy z listy, także duplikaty, z
                  oryginalnym zapisem. TXT zawiera frazy z bieżącego widoku tabeli, po
                  jednej w wierszu.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
