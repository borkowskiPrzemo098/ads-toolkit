"use client"

import { useMemo, useState } from "react"
import { Download, ListChecks } from "lucide-react"
import { SelectField } from "@/components/forms/select-field"
import { TextField } from "@/components/forms/text-field"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/auditor/format"
import { INTENT_LABEL, UNWANTED_LABEL, type Intent } from "@/lib/auditor/intent"
import type { SearchTermAnalysis, TermSuggestion } from "@/lib/auditor/rules/search-terms"
import {
  DECISION_LABEL,
  decisionsCsv,
  DEFAULT_MATCH,
  listFor,
  MATCH_LABEL,
  plainList,
  type Decisions,
  type TermDecision,
} from "@/lib/auditor/term-decisions"
import type { MatchType } from "@/lib/calculations/negative-keywords"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { formatNumber } from "@/lib/formatting/number"
import { stripDiacritics } from "@/lib/keywords/normalize"
import { cn } from "@/lib/utils"

const PAGE = 50
const ALL = "all"
const NONE = "none"

const SUGGESTION: Record<
  Exclude<TermSuggestion, null>,
  { label: string; className: string }
> = {
  exclude: {
    label: "Sugestia: wyklucz",
    className: "bg-[#ff4f8b]/15 text-[#ff8db3] ring-[#ff4f8b]/35",
  },
  watch: {
    label: "Obserwuj (mała próba)",
    className: "bg-warning/12 text-warning ring-warning/30",
  },
  add: {
    label: "Sugestia: nowe słowo",
    className: "bg-success/12 text-success ring-success/30",
  },
}

export interface IntentInputs {
  offer: string
  brands: string
  competitors: string
}

/** Spec 5C: classify, decide, export. Every decision is the user's; nothing is applied alone. */
export function SearchTermsPanel({
  analysis,
  currency,
  inputs,
  onInputs,
  decisions,
  onDecisions,
}: {
  analysis: SearchTermAnalysis
  currency: string | null
  inputs: IntentInputs
  onInputs: (i: IntentInputs) => void
  decisions: Decisions
  onDecisions: (d: Decisions) => void
}) {
  const [intent, setIntent] = useState<Intent | typeof ALL>(ALL)
  const [suggestion, setSuggestion] = useState<
    Exclude<TermSuggestion, null> | typeof ALL | typeof NONE
  >(ALL)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const money = (v: number) => formatMoney(v, currency)

  const rows = useMemo(() => {
    const q = stripDiacritics(query.trim().toLocaleLowerCase("pl-PL"))
    return analysis.rows.filter(
      (r) =>
        (intent === ALL || r.intent.intent === intent) &&
        (suggestion === ALL ||
          (suggestion === NONE ? r.suggestion === null : r.suggestion === suggestion)) &&
        (!q || stripDiacritics(r.term.toLocaleLowerCase("pl-PL")).includes(q))
    )
  }, [analysis.rows, intent, suggestion, query])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE)

  const decide = (key: string, decision: TermDecision | null, match?: MatchType) => {
    const next = { ...decisions }
    if (!decision) delete next[key]
    else
      next[key] = {
        decision,
        match: match ?? next[key]?.match ?? DEFAULT_MATCH[decision],
      }
    onDecisions(next)
  }
  const suggestedExclusions = analysis.rows.filter(
    (r) => r.suggestion === "exclude" && !decisions[r.key]
  )
  const exclusions = listFor(analysis.rows, decisions, "exclude")
  const additions = listFor(analysis.rows, decisions, "add")

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Twoja oferta"
        description="Słowa oferty pozwalają rozpoznać zapytania niepowiązane. Klasyfikacja intencji to heurystyka na podstawie słów w haśle, nie pewna ocena."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TextField
            label="Słowa opisujące ofertę"
            value={inputs.offer}
            onChange={(offer) => onInputs({ ...inputs, offer })}
            placeholder="np. buty, obuwie, nike"
            hint="Oddziel przecinkami."
          />
          <TextField
            label="Twoja marka"
            value={inputs.brands}
            onChange={(brands) => onInputs({ ...inputs, brands })}
            placeholder="np. biegam"
          />
          <TextField
            label="Konkurencja"
            value={inputs.competitors}
            onChange={(competitors) => onInputs({ ...inputs, competitors })}
            placeholder="np. decathlon"
          />
        </div>
      </Panel>

      <Panel
        title={`Wyszukiwane hasła (${formatNumber(analysis.rows.length)})`}
        description={`Z raportu „${analysis.report.name}”. Wykluczenie sugerujemy dopiero od ${analysis.minClicks} kliknięć bez konwersji; mniejsze próby oznaczamy „Obserwuj”.`}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_14rem]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="term-search" className="text-sm font-medium">
              Szukaj
            </label>
            <Input
              id="term-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="fragment hasła"
            />
          </div>
          <SelectField
            label="Intencja"
            value={intent}
            onChange={(v) => {
              setIntent(v)
              setPage(0)
            }}
            options={[
              { value: ALL, label: "Wszystkie" },
              ...(Object.keys(INTENT_LABEL) as Intent[]).map((i) => ({
                value: i,
                label: INTENT_LABEL[i],
              })),
            ]}
          />
          <SelectField
            label="Sugestia"
            value={suggestion}
            onChange={(v) => {
              setSuggestion(v)
              setPage(0)
            }}
            options={[
              { value: ALL, label: "Wszystkie" },
              { value: "exclude", label: "Do wykluczenia" },
              { value: "watch", label: "Do obserwacji" },
              { value: "add", label: "Nowe słowa kluczowe" },
              { value: NONE, label: "Bez sugestii" },
            ]}
          />
        </div>

        {suggestedExclusions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mb-4"
            onClick={() => {
              const next = { ...decisions }
              for (const r of suggestedExclusions)
                next[r.key] = { decision: "exclude", match: "exact" }
              onDecisions(next)
            }}
          >
            <ListChecks />
            Oznacz sugerowane wykluczenia ({formatNumber(suggestedExclusions.length)})
          </Button>
        )}

        <TableScroll label="Wyszukiwane hasła z decyzjami">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Hasło</th>
                <th className="px-3 py-2 font-medium">Intencja</th>
                <th className="px-3 py-2 text-right font-medium">Klikn.</th>
                <th className="px-3 py-2 text-right font-medium">Koszt</th>
                <th className="px-3 py-2 text-right font-medium">Konw.</th>
                <th className="px-3 py-2 font-medium">Sugestia</th>
                <th className="py-2 pl-3 font-medium">Twoja decyzja</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const d = decisions[r.key]
                return (
                  <tr
                    key={r.key}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="max-w-[16rem] py-2.5 pr-3 [overflow-wrap:anywhere]">
                      <span className="font-medium">{r.term}</span>
                      {r.isKeyword && (
                        <span className="block text-xs text-muted-foreground">
                          już jest słowem kluczowym
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {INTENT_LABEL[r.intent.intent]}
                      {r.intent.unwanted && (
                        <span className="block text-xs text-warning">
                          {UNWANTED_LABEL[r.intent.unwanted]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {formatNumber(r.metrics.clicks ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                      {money(r.metrics.cost ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      {formatNumber(
                        r.metrics.conversions ?? 0,
                        (r.metrics.conversions ?? 0) % 1 ? 1 : 0
                      )}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5">
                      {r.suggestion && (
                        <span
                          className={cn(
                            "inline-block rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                            SUGGESTION[r.suggestion].className
                          )}
                        >
                          {SUGGESTION[r.suggestion].label}
                        </span>
                      )}
                      {r.reason && (
                        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                          {r.reason}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3">
                      <div className="flex flex-col gap-1.5">
                        <select
                          aria-label={`Decyzja: ${r.term}`}
                          value={d?.decision ?? NONE}
                          onChange={(e) =>
                            decide(
                              r.key,
                              e.target.value === NONE
                                ? null
                                : (e.target.value as TermDecision)
                            )
                          }
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm [color-scheme:dark]"
                        >
                          <option value={NONE}>— brak —</option>
                          {(Object.keys(DECISION_LABEL) as TermDecision[]).map((k) => (
                            <option key={k} value={k}>
                              {DECISION_LABEL[k]}
                            </option>
                          ))}
                        </select>
                        {(d?.decision === "exclude" || d?.decision === "add") && (
                          <select
                            aria-label={`Dopasowanie: ${r.term}`}
                            value={d.match}
                            onChange={(e) =>
                              decide(r.key, d.decision, e.target.value as MatchType)
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm [color-scheme:dark]"
                          >
                            {(Object.keys(MATCH_LABEL) as MatchType[]).map((m) => (
                              <option key={m} value={m}>
                                {MATCH_LABEL[m]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
        {pages > 1 && (
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Poprzednie
            </Button>
            <span className="tabular">
              {page + 1} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
            >
              Następne
            </Button>
          </div>
        )}
      </Panel>

      <Panel
        title="Eksport decyzji"
        description="Trafiają tu tylko hasła oznaczone w tabeli. Listę wklejasz w Google Ads; aplikacja niczego nie zmienia na koncie."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ExportBox
            title="Wykluczenia"
            count={exclusions.length}
            onTxt={() =>
              downloadBlob(
                new Blob([plainList(exclusions)], { type: "text/plain;charset=utf-8" }),
                datedFilename("wykluczenia", "txt")
              )
            }
            onCsv={() =>
              downloadCsv(
                decisionsCsv(exclusions, "Wykluczenie"),
                datedFilename("wykluczenia", "csv")
              )
            }
          />
          <ExportBox
            title="Nowe słowa kluczowe"
            count={additions.length}
            onTxt={() =>
              downloadBlob(
                new Blob([plainList(additions)], { type: "text/plain;charset=utf-8" }),
                datedFilename("nowe-slowa-kluczowe", "txt")
              )
            }
            onCsv={() =>
              downloadCsv(
                decisionsCsv(additions, "Słowo kluczowe"),
                datedFilename("nowe-slowa-kluczowe", "csv")
              )
            }
          />
        </div>
      </Panel>
    </div>
  )
}

function ExportBox({
  title,
  count,
  onTxt,
  onCsv,
}: {
  title: string
  count: number
  onTxt: () => void
  onCsv: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <p className="text-sm font-semibold">
        {title}: <span className="text-(--tool) tabular">{formatNumber(count)}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!count}
          onClick={onTxt}
          aria-label={`${title}: pobierz TXT`}
        >
          <Download />
          TXT
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!count}
          onClick={onCsv}
          aria-label={`${title}: pobierz CSV`}
        >
          <Download />
          CSV
        </Button>
      </div>
    </div>
  )
}
