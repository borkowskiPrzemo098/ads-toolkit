import { confidenceOf, type Finding } from "../findings"
import {
  classifyTerm,
  INTENT_LABEL,
  UNWANTED_LABEL,
  type IntentContext,
  type IntentResult,
  type UnwantedCategory,
} from "../intent"
import { addInto, emptyMetrics, kpisOf, sumMetrics, type Metrics } from "../metrics"
import type { AuditDataset } from "../join"
import { nameKey, type NormalizedReport } from "../normalize"
import { clicksToJudge } from "../stats"
import { T } from "../thresholds"
import {
  baselineOf,
  n0,
  n1,
  pct,
  periodOf,
  share,
  type Baseline,
  type RuleContext,
} from "./context"
import type { RuleResult } from "./campaigns"

/*
 * Search terms (spec 5C): what people actually typed. Terms are classified by heuristic
 * intent, and the tool SUGGESTS exclusions or new keywords; nothing is applied without the
 * user's decision. An exclusion is suggested only with enough clicks to trust "no conversions".
 */

export type TermSuggestion = "exclude" | "add" | "watch" | null

export interface TermRow {
  key: string
  term: string
  campaigns: string[]
  adGroups: string[]
  /** Keywords that triggered the term, when the report has that column. */
  keywords: string[]
  /** The term is already a keyword (in this report or the keyword report). */
  isKeyword: boolean
  metrics: Metrics
  intent: IntentResult
  suggestion: TermSuggestion
  /** Why the suggestion was made, in plain words. */
  reason: string
}

export interface SearchTermAnalysis {
  report: NormalizedReport
  rows: TermRow[]
  base: Baseline
  /** Clicks after which zero conversions is meaningful. */
  minClicks: number
  result: RuleResult
}

export function pickSearchTermReport(ctx: RuleContext): NormalizedReport | null {
  return (
    ctx.data.reports
      .filter((r) => r.type === "searchTerm" && r.records.some((x) => x.dims.searchTerm))
      .sort((a, b) => b.records.length - a.records.length)[0] ?? null
  )
}

type BaseRow = Omit<TermRow, "intent" | "suggestion" | "reason">

const aggregateCache = new WeakMap<
  AuditDataset,
  { report: NormalizedReport; rows: BaseRow[]; totals: Metrics }
>()

/** Terms merged across ad groups with summed metrics. Independent of the offer words. */
function aggregateTerms(data: AuditDataset, report: NormalizedReport) {
  const cached = aggregateCache.get(data)
  if (cached?.report === report) return cached
  // Existing keywords: from this report's keyword column and from any keyword report.
  const keywordSet = new Set<string>()
  for (const r of data.reports)
    for (const rec of r.records)
      if (rec.dims.keyword) keywordSet.add(nameKey(rec.dims.keyword))

  const map = new Map<string, BaseRow>()
  for (const rec of report.records) {
    const term = rec.dims.searchTerm
    if (!term) continue
    const key = nameKey(term)
    let row = map.get(key)
    if (!row) {
      row = {
        key,
        term,
        campaigns: [],
        adGroups: [],
        keywords: [],
        isKeyword: keywordSet.has(key),
        metrics: emptyMetrics(),
      }
      map.set(key, row)
    }
    addInto(row.metrics, rec.metrics)
    if (rec.dims.campaign && !row.campaigns.includes(rec.dims.campaign))
      row.campaigns.push(rec.dims.campaign)
    if (rec.dims.adGroup && !row.adGroups.includes(rec.dims.adGroup))
      row.adGroups.push(rec.dims.adGroup)
    if (rec.dims.keyword && !row.keywords.includes(rec.dims.keyword))
      row.keywords.push(rec.dims.keyword)
  }
  const rows = [...map.values()].sort(
    (a, b) => (b.metrics.cost ?? 0) - (a.metrics.cost ?? 0)
  )
  const entry = { report, rows, totals: sumMetrics(rows.map((r) => r.metrics)) }
  aggregateCache.set(data, entry)
  return entry
}

export function analyzeSearchTerms(
  ctx: RuleContext,
  intentCtx: IntentContext
): SearchTermAnalysis | null {
  const report = pickSearchTermReport(ctx)
  if (!report) return null
  const { money, data } = ctx

  const { rows: aggregated, totals } = aggregateTerms(data, report)
  // Fresh rows per run (intent and suggestion change with the offer words); the heavy
  // aggregation above is cached per dataset.
  const rows: TermRow[] = aggregated.map((r) => ({
    ...r,
    intent: classifyTerm(r.term, intentCtx),
    suggestion: null,
    reason: "",
  }))
  const base = baselineOf(totals)
  const minClicks = base.cr ? clicksToJudge(base.cr) : Infinity

  for (const r of rows) {
    const clicks = r.metrics.clicks ?? 0
    const conv = r.metrics.conversions ?? 0
    const cost = r.metrics.cost ?? 0
    const k = kpisOf(r.metrics)
    const offIntent = r.intent.unwanted !== null || r.intent.intent === "unrelated"
    if (conv === 0 && cost > 0 && clicks >= minClicks) {
      r.suggestion = "exclude"
      r.reason = `${n0(clicks)} kliknięć bez konwersji (próg: ${minClicks})${offIntent ? `; ${describeIntent(r.intent)}` : ""}.`
    } else if (conv === 0 && offIntent && cost > 0) {
      r.suggestion = "watch"
      r.reason = `${describeIntent(r.intent)}, ale tylko ${n0(clicks)} kliknięć: za mało, by zalecić wykluczenie.`
    } else if (
      !r.isKeyword &&
      conv >= 2 &&
      base.cpa &&
      k.cpa.ok &&
      k.cpa.value <= base.cpa &&
      !offIntent
    ) {
      r.suggestion = "add"
      r.reason = `${n1(conv)} konwersji przy CPA ${money(k.cpa.value)} (średnio ${money(base.cpa)}); hasło nie jest jeszcze słowem kluczowym.`
    }
  }

  const source = (method: string) => ({
    report: report.name,
    dimension: "Wyszukiwane hasło",
    period: periodOf(report),
    method,
  })
  const totalCost = totals.cost ?? 0
  const findings: Finding[] = []
  const notes: string[] = []
  if (!intentCtx.offerStems.size)
    notes.push(
      "Podaj słowa opisujące ofertę (zakładka „Wyszukiwane hasła”), aby wykrywać zapytania niepowiązane z ofertą."
    )

  const list = (items: TermRow[]) =>
    items.slice(0, 8).map((r) => ({
      label: r.term,
      value: `${money(r.metrics.cost ?? 0)}, ${n0(r.metrics.clicks)} klikn., ${n1(r.metrics.conversions)} konw.`,
    }))
  const costOf = (items: TermRow[]) =>
    items.reduce((s, r) => s + (r.metrics.cost ?? 0), 0)

  // S1: unwanted intents (dictionaries) with cost and no conversions, one finding per category.
  const byUnwanted = new Map<UnwantedCategory, TermRow[]>()
  for (const r of rows)
    if (
      r.intent.unwanted &&
      (r.metrics.conversions ?? 0) === 0 &&
      (r.metrics.cost ?? 0) > 0
    )
      byUnwanted.set(r.intent.unwanted, [...(byUnwanted.get(r.intent.unwanted) ?? []), r])
  for (const [cat, items] of byUnwanted) {
    const cost = costOf(items)
    findings.push({
      id: `S1:${cat}`,
      rule: "S1",
      area: "searchTerm",
      kind: "problem",
      severity: totalCost && cost / totalCost >= T.materialCostShare ? "medium" : "low",
      confidence: "medium",
      title: `Zapytania o „${UNWANTED_LABEL[cat]}” bez konwersji`,
      subject: `${items.length} ${items.length === 1 ? "hasło" : "haseł"}`,
      situation: `Hasła z tej kategorii kosztowały ${money(cost)} (${share(totalCost ? cost / totalCost : 0)} kosztu haseł) i nie dały konwersji.`,
      evidence: list(items),
      cause:
        "Słowa kluczowe w dopasowaniu przybliżonym lub do wyrażenia wyświetlają reklamy także na takie zapytania. Rozpoznanie to heurystyka ze słownika, nie pewna ocena intencji.",
      action:
        "Przejrzyj hasła w zakładce „Wyszukiwane hasła”. Jeśli nie pasują do oferty, oznacz je do wykluczenia; przy małej liczbie kliknięć najpierw obserwuj.",
      impact: `Koszt tych zapytań w okresie raportu: ${money(cost)}.`,
      source: source(
        "słowniki kategorii (praca, darmowe, używane, naprawa, poradniki); brak konwersji"
      ),
      cost,
    })
  }

  // S2: informational queries that spend without converting.
  const info = rows.filter(
    (r) =>
      r.intent.intent === "informational" &&
      !r.intent.unwanted &&
      (r.metrics.conversions ?? 0) === 0 &&
      (r.metrics.cost ?? 0) > 0
  )
  if (info.length)
    findings.push({
      id: "S2",
      rule: "S2",
      area: "searchTerm",
      kind: "problem",
      severity: "low",
      confidence: "low",
      title: "Zapytania informacyjne bez konwersji",
      subject: `${info.length} ${info.length === 1 ? "hasło" : "haseł"}`,
      situation: `Pytania typu „jak”, „co to”, „ile” kosztowały ${money(costOf(info))} bez konwersji.`,
      evidence: list(info),
      cause:
        "Przy celu sprzedażowym takie zapytania rzadko kończą się zakupem; przy celach budowania świadomości mogą być pożądane.",
      action:
        "Jeśli kampania ma cel sprzedażowy, rozważ wykluczenie słów pytających (np. „jak”) w dopasowaniu do wyrażenia.",
      source: source("słowa pytające i poradnikowe w treści hasła"),
      cost: costOf(info),
    })

  // S3: unrelated to the offer (needs offer words).
  const unrelated = rows.filter(
    (r) =>
      r.intent.intent === "unrelated" &&
      r.intent.unwanted === null &&
      (r.metrics.cost ?? 0) > 0
  )
  if (unrelated.length)
    findings.push({
      id: "S3",
      rule: "S3",
      area: "searchTerm",
      kind: "problem",
      severity:
        totalCost && costOf(unrelated) / totalCost >= T.materialCostShare
          ? "medium"
          : "low",
      confidence: "low",
      title: "Zapytania niezwiązane z ofertą",
      subject: `${unrelated.length} ${unrelated.length === 1 ? "hasło" : "haseł"}`,
      situation: `Hasła bez żadnego ze słów opisujących ofertę kosztowały ${money(costOf(unrelated))}.`,
      evidence: list(unrelated),
      cause: "Szerokie dopasowania lub słowa kluczowe o wielu znaczeniach.",
      action:
        "Sprawdź listę i wyklucz hasła, które na pewno nie dotyczą oferty. Uzupełnij słowa oferty, jeśli coś zostało oznaczone błędnie.",
      source: source("brak słów oferty podanych przez użytkownika w treści hasła"),
      cost: costOf(unrelated),
    })

  // S4: individual terms with significant spend and no conversions.
  const zero = rows.filter((r) => r.suggestion === "exclude")
  for (const r of zero.slice(0, 12))
    findings.push({
      id: `S4:${r.key}`,
      rule: "S4",
      area: "searchTerm",
      kind: "problem",
      severity: base.cpa && (r.metrics.cost ?? 0) >= base.cpa * 2 ? "high" : "medium",
      confidence: confidenceOf(Math.pow(1 - (base.cr ?? 0), r.metrics.clicks ?? 0)),
      title: "Wyszukiwane hasło z kosztem bez konwersji",
      subject: r.term,
      situation: r.reason,
      evidence: [
        { label: "Koszt", value: money(r.metrics.cost ?? 0) },
        { label: "Kliknięcia", value: n0(r.metrics.clicks) },
        { label: "Intencja (heurystyka)", value: INTENT_LABEL[r.intent.intent] },
        ...(r.keywords.length
          ? [{ label: "Słowo kluczowe", value: r.keywords.join(", ") }]
          : []),
        ...(r.campaigns.length
          ? [{ label: "Kampania", value: r.campaigns.join(", ") }]
          : []),
      ],
      cause:
        "Hasło może mieć inną intencję niż oferta albo strona docelowa nie odpowiada na nie.",
      action:
        "Jeśli hasło nie pasuje do oferty, dodaj je do wykluczeń w zakładce „Wyszukiwane hasła” (domyślnie dopasowanie ścisłe).",
      impact: `Koszt bez konwersji w okresie raportu: ${money(r.metrics.cost ?? 0)}.`,
      source: source(
        `brak konwersji przy co najmniej ${minClicks} kliknięciach: (1 − ${pct((base.cr ?? 0) * 100, 2)})ⁿ < 5%`
      ),
      cost: r.metrics.cost ?? 0,
    })

  // S5: converting terms that are not keywords yet.
  const add = rows.filter((r) => r.suggestion === "add")
  if (add.length)
    findings.push({
      id: "S5",
      rule: "S5",
      area: "searchTerm",
      kind: "opportunity",
      severity: "info",
      confidence: "medium",
      title: "Potencjalne nowe słowa kluczowe",
      subject: `${add.length} ${add.length === 1 ? "hasło" : "haseł"}`,
      situation:
        "Hasła z co najmniej 2 konwersjami i CPA nie wyższym niż średnio, które nie są jeszcze słowami kluczowymi.",
      evidence: list(add),
      cause:
        "Dodanie ich jako słów kluczowych (np. w dopasowaniu ścisłym) daje kontrolę nad stawką i reklamą dla tych zapytań.",
      action:
        "Wybierz hasła w zakładce „Wyszukiwane hasła” → „Dodaj jako słowo kluczowe” i wyeksportuj listę.",
      source: source(
        "konwersje ≥ 2, CPA ≤ średni CPA haseł, hasło spoza listy słów kluczowych"
      ),
      cost: costOf(add),
    })

  return { report, rows, base, minClicks, result: { findings, notes } }
}

function describeIntent(i: IntentResult): string {
  if (i.unwanted) return `kategoria „${UNWANTED_LABEL[i.unwanted]}”`
  return `intencja: ${INTENT_LABEL[i.intent].toLowerCase()}`
}
