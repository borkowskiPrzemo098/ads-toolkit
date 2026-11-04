import { DEVICE_LABEL } from "../dashboard"
import { confidenceOf, type Finding, type FindingArea } from "../findings"
import {
  addInto,
  emptyMetrics,
  kpisOf,
  sumMetrics,
  type Kpis,
  type Metrics,
} from "../metrics"
import type { NormalizedRecord, NormalizedReport } from "../normalize"
import { clicksToJudge, pHigher, pLower } from "../stats"
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
 * Devices, locations, days and hours (spec 5D–5F). Each segment is compared with the average
 * of the same report. Recommendations only: the tool never changes bids.
 */

export interface Segment {
  key: string
  label: string
  metrics: Metrics
  kpis: Kpis
  costShare: number
  valueShare: number | null
  /** Too few clicks to judge conversion. */
  thin: boolean
}

export interface SegmentAnalysis {
  report: NormalizedReport
  segments: Segment[]
  base: Baseline
  minClicks: number
  result: RuleResult
}

const DAY_LABEL = [
  "",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
]

interface Spec {
  area: FindingArea
  dimension: string
  /** Report types to read from, in order of preference. */
  types: NormalizedReport["type"][]
  keyOf: (r: NormalizedRecord) => string | null
  labelOf: (key: string) => string
  /** Words for findings: "urządzenie", "lokalizacja"… */
  noun: string
  action: { high: string; best: string }
}

const SPECS = {
  device: {
    area: "device",
    dimension: "Urządzenie",
    types: ["device"],
    keyOf: (r) => r.dims.device ?? null,
    labelOf: (k) => DEVICE_LABEL[k as keyof typeof DEVICE_LABEL] ?? k,
    noun: "Urządzenie",
    action: {
      high: "Sprawdź, jak strona docelowa i formularz działają na tym urządzeniu. Korektę stawek dla urządzenia rozważ po tej weryfikacji; aplikacja niczego nie zmienia na koncie.",
      best: "To urządzenie daje najwięcej wartości: dbaj o jego doświadczenie na stronie i rozważ dodatnią korektę stawek, jeśli CPA na to pozwala.",
    },
  },
  location: {
    area: "location",
    dimension: "Lokalizacja",
    types: ["location"],
    keyOf: (r) => r.dims.location ?? null,
    labelOf: (k) => k,
    noun: "Lokalizacja",
    action: {
      high: "Sprawdź, czy oferta i dostawa są tam tak samo atrakcyjne. Korektę stawek lub wykluczenie lokalizacji rozważ po zebraniu większej ilości danych.",
      best: "Lokalizacja z dobrymi wynikami: rozważ dodatnią korektę stawek albo osobną kampanię z dopasowaną ofertą.",
    },
  },
} satisfies Record<string, Spec>

function pickReport(ctx: RuleContext, spec: Spec): NormalizedReport | null {
  return (
    ctx.data.reports
      .filter(
        (r) =>
          spec.types.includes(r.type) &&
          r.records.some((x) => spec.keyOf(x) !== null && x.metrics.cost !== null)
      )
      .sort((a, b) => b.records.length - a.records.length)[0] ?? null
  )
}

function segmentsOf(
  report: NormalizedReport,
  spec: Pick<Spec, "keyOf" | "labelOf">
): { segments: Segment[]; base: Baseline } {
  const map = new Map<string, Metrics>()
  for (const r of report.records) {
    const k = spec.keyOf(r)
    if (k === null) continue
    map.set(k, addInto(map.get(k) ?? emptyMetrics(), r.metrics))
  }
  const totals = sumMetrics([...map.values()])
  const base = baselineOf(totals)
  const minClicks = base.cr ? clicksToJudge(base.cr) : Infinity
  const segments = [...map].map(([key, metrics]) => ({
    key,
    label: spec.labelOf(key),
    metrics,
    kpis: kpisOf(metrics),
    costShare: totals.cost ? (metrics.cost ?? 0) / totals.cost : 0,
    valueShare: totals.conversionValue
      ? (metrics.conversionValue ?? 0) / totals.conversionValue
      : null,
    thin: (metrics.clicks ?? 0) < minClicks,
  }))
  return { segments, base }
}

export function analyzeSegment(
  ctx: RuleContext,
  which: keyof typeof SPECS
): SegmentAnalysis | null {
  const spec: Spec = SPECS[which]
  const report = pickReport(ctx, spec)
  if (!report) return null
  const { segments, base } = segmentsOf(report, spec)
  segments.sort((a, b) => (b.metrics.cost ?? 0) - (a.metrics.cost ?? 0))
  const minClicks = base.cr ? clicksToJudge(base.cr) : Infinity
  const { money } = ctx
  const source = (method: string) => ({
    report: report.name,
    dimension: spec.dimension,
    period: periodOf(report),
    method,
  })
  const findings: Finding[] = []
  const flagged = new Set<string>()
  const ev = (s: Segment) => [
    { label: "Koszt", value: `${money(s.metrics.cost ?? 0)} (${share(s.costShare)})` },
    { label: "Kliknięcia", value: n0(s.metrics.clicks) },
    { label: "Konwersje", value: n1(s.metrics.conversions) },
    {
      label: "CPA",
      value: s.kpis.cpa.ok
        ? `${money(s.kpis.cpa.value)} (średnio: ${base.cpa ? money(base.cpa) : "N/D"})`
        : "N/D",
    },
    {
      label: "Współczynnik konwersji",
      value: s.kpis.conversionRate.ok
        ? `${pct(s.kpis.conversionRate.value, 2)} (średnio: ${base.cr ? pct(base.cr * 100, 2) : "N/D"})`
        : "N/D",
    },
    ...(s.kpis.roas.ok
      ? [
          {
            label: "ROAS",
            value: `${pct(s.kpis.roas.value, 0)} (średnio: ${base.roas !== null ? pct(base.roas, 0) : "N/D"})`,
          },
        ]
      : []),
  ]

  if (base.cr && base.cpa) {
    for (const s of segments) {
      const clicks = s.metrics.clicks ?? 0
      const conv = s.metrics.conversions ?? 0
      const cost = s.metrics.cost ?? 0
      if (s.thin || !clicks || !cost || s.costShare < T.materialCostShare) continue
      const needed = Math.min(0.999, cost / (base.cpa * clicks))
      const p = pLower(conv, clicks, needed)
      const cpa = conv ? cost / conv : Infinity
      if (cpa >= base.cpa * T.highCpaRatio && p < T.alpha) {
        flagged.add(s.key)
        findings.push({
          id: `${spec.area}:cpa:${s.key}`,
          rule: spec.area === "device" ? "D1" : "L1",
          area: spec.area,
          kind: "problem",
          severity: s.costShare >= 0.3 ? "high" : "medium",
          confidence: confidenceOf(p),
          title: `${spec.noun} z wysokim CPA`,
          subject: s.label,
          situation: conv
            ? `CPA jest ${n1(Math.round((cpa / base.cpa) * 10) / 10)}× wyższy niż średnio w tym raporcie.`
            : `${n0(clicks)} kliknięć bez konwersji.`,
          evidence: ev(s),
          cause:
            "Słabsza konwersja (np. wygoda zakupu, czas dostawy) albo droższe kliknięcia w tym segmencie.",
          action: spec.action.high,
          source: source(`CPA ≥ ${T.highCpaRatio}× średni CPA raportu; test dwumianowy`),
          cost,
        })
        continue
      }
      const pCr = pLower(conv, clicks, base.cr)
      if (pCr < T.alpha && conv / clicks < base.cr * T.lowCrRatio) {
        flagged.add(s.key)
        findings.push({
          id: `${spec.area}:cr:${s.key}`,
          rule: spec.area === "device" ? "D2" : "L2",
          area: spec.area,
          kind: "problem",
          severity: "medium",
          confidence: confidenceOf(pCr),
          title: `${spec.noun} z niskim współczynnikiem konwersji`,
          subject: s.label,
          situation:
            "Konwersja wyraźnie niższa niż średnio, przy wystarczającej liczbie kliknięć.",
          evidence: ev(s),
          cause: "Możliwe problemy z działaniem strony lub formularza w tym segmencie.",
          action: spec.action.high,
          source: source(
            "współczynnik konwersji względem średniej raportu; test dwumianowy"
          ),
          cost,
        })
      }
    }

    // Best segment: highest conversion value (or conversions) with better-than-average results.
    const best = [...segments]
      .filter(
        (s) =>
          !s.thin &&
          !flagged.has(s.key) &&
          (s.metrics.conversions ?? 0) >= T.swingMinConversions
      )
      .sort(
        (a, b) =>
          (b.metrics.conversionValue ?? b.metrics.conversions ?? 0) -
          (a.metrics.conversionValue ?? a.metrics.conversions ?? 0)
      )[0]
    if (best && segments.length > 1) {
      const p = pHigher(best.metrics.conversions ?? 0, best.metrics.clicks ?? 0, base.cr)
      findings.push({
        id: `${spec.area}:best`,
        rule: spec.area === "device" ? "D3" : "L3",
        area: spec.area,
        kind: p < T.alpha ? "opportunity" : "data",
        severity: "info",
        confidence: p < T.alpha ? confidenceOf(p) : "low",
        title:
          best.metrics.conversionValue !== null
            ? `${spec.noun} z największą wartością konwersji`
            : `${spec.noun} z największą liczbą konwersji`,
        subject: best.label,
        situation:
          best.valueShare !== null
            ? `Odpowiada za ${share(best.valueShare)} wartości konwersji przy ${share(best.costShare)} kosztu.`
            : `Odpowiada za największą liczbę konwersji (${n1(best.metrics.conversions)}).`,
        evidence: ev(best),
        cause:
          p < T.alpha
            ? "Konwersja wyraźnie wyższa niż średnio."
            : "Duży udział wynika głównie z wolumenu, nie z lepszej konwersji.",
        action:
          p < T.alpha
            ? spec.action.best
            : "Traktuj jako informację o strukturze ruchu, nie jako sygnał do zmiany stawek.",
        source: source(
          "największa wartość (lub liczba) konwersji; test dwumianowy względem średniej"
        ),
        cost: best.metrics.cost ?? 0,
      })
    }
  }

  if (which === "location") {
    const big = segments.find((s) => s.costShare >= T.concentrationShare)
    if (big && segments.length > 1)
      findings.push({
        id: "location:share",
        rule: "L4",
        area: "location",
        kind: "data",
        severity: "info",
        confidence: "high",
        title: "Większość budżetu w jednej lokalizacji",
        subject: big.label,
        situation: `${share(big.costShare)} kosztu raportu lokalizacji.`,
        evidence: ev(big),
        cause: "Naturalne dla dużych miast albo efekt kierowania.",
        action: "Upewnij się, że to zgodne z zasięgiem oferty.",
        source: source("udział w koszcie raportu lokalizacji"),
        cost: big.metrics.cost ?? 0,
      })
  }

  const thin = segments.filter((s) => s.thin && (s.metrics.cost ?? 0) > 0)
  if (thin.length && base.cr)
    findings.push({
      id: `${spec.area}:thin`,
      rule: spec.area === "device" ? "D0" : "L0",
      area: spec.area,
      kind: "data",
      severity: "info",
      confidence: "high",
      title: `${spec.noun === "Urządzenie" ? "Urządzenia" : "Lokalizacje"} wymagające dalszej analizy`,
      subject:
        thin
          .slice(0, 6)
          .map((s) => s.label)
          .join(", ") + (thin.length > 6 ? "…" : ""),
      situation: `Mniej niż ${minClicks} kliknięć: za mało, by ocenić skuteczność.`,
      evidence: thin.slice(0, 6).map((s) => ({
        label: s.label,
        value: `${n0(s.metrics.clicks)} klikn., ${money(s.metrics.cost ?? 0)}, ${n1(s.metrics.conversions)} konw.`,
      })),
      cause: "Mały ruch.",
      action: "Nie zmieniaj stawek dla tych segmentów na podstawie obecnych danych.",
      source: source(`minimalna liczba kliknięć: ${minClicks}`),
      cost: thin.reduce((s, x) => s + (x.metrics.cost ?? 0), 0),
    })

  return { report, segments, base, minClicks, result: { findings, notes: [] } }
}

export interface ScheduleAnalysis {
  report: NormalizedReport
  days: Segment[]
  hours: Segment[]
  base: Baseline
  /** How many times each weekday occurs in the period; null when the period is unknown. */
  weeks: number | null
  result: RuleResult
}

/** Days of the week and hours of the day (spec 5F). */
export function analyzeSchedule(ctx: RuleContext): ScheduleAnalysis | null {
  const report =
    ctx.data.reports
      .filter(
        (r) => r.type === "schedule" && r.records.some((x) => x.metrics.cost !== null)
      )
      .sort((a, b) => b.records.length - a.records.length)[0] ?? null
  if (!report) return null
  const { money } = ctx
  const days = segmentsOf(report, {
    keyOf: (r) => (r.dims.dayOfWeek ? String(r.dims.dayOfWeek) : null),
    labelOf: (k) => DAY_LABEL[Number(k)],
  })
  const hours = segmentsOf(report, {
    keyOf: (r) => (r.dims.hour !== undefined ? String(r.dims.hour) : null),
    labelOf: (k) => `${k}:00–${k}:59`,
  })
  days.segments.sort((a, b) => Number(a.key) - Number(b.key))
  hours.segments.sort((a, b) => Number(a.key) - Number(b.key))
  const base = days.segments.length ? days.base : hours.base
  const p = report.period
  const weeks = p
    ? Math.floor((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 / 7) + 1
    : null
  const shortPeriod = weeks === null || weeks < 4
  const findings: Finding[] = []
  const notes: string[] = []
  if (shortPeriod)
    notes.push(
      weeks === null
        ? "Raport godzin nie podaje okresu, więc nie wiadomo, ile razy wystąpił każdy dzień tygodnia. Wnioski o dniach i godzinach traktuj jako wstępne."
        : `Okres obejmuje ok. ${weeks} ${weeks === 1 ? "tydzień" : "tygodnie"}: każdy dzień tygodnia wystąpił najwyżej ${weeks} razy. Wnioski o dniach i godzinach traktuj jako wstępne.`
    )

  const source = (dimension: string, method: string) => ({
    report: report.name,
    dimension,
    period: periodOf(report),
    method,
  })
  const extremes = (list: Segment[], dimension: string, noun: string) => {
    if (!base.cr || !base.cpa || list.length < 3) return
    const judged = list.filter((s) => !s.thin && (s.metrics.cost ?? 0) > 0)
    const scored = judged.map((s) => {
      const clicks = s.metrics.clicks ?? 0
      const conv = s.metrics.conversions ?? 0
      const needed = Math.min(0.999, (s.metrics.cost ?? 0) / (base.cpa! * clicks))
      return { s, low: pLower(conv, clicks, needed), high: pHigher(conv, clicks, needed) }
    })
    const worst = scored
      .filter((x) => x.low < T.alpha)
      .sort((a, b) => a.low - b.low)
      .slice(0, 3)
    const bestOnes = scored
      .filter((x) => x.high < T.alpha)
      .sort((a, b) => a.high - b.high)
      .slice(0, 3)
    const evidence = (xs: typeof scored) =>
      xs.map(({ s }) => ({
        label: s.label,
        value: `CPA ${s.kpis.cpa.ok ? money(s.kpis.cpa.value) : "N/D"}, ${n1(s.metrics.conversions)} konw., ${money(s.metrics.cost ?? 0)}`,
      }))
    if (worst.length)
      findings.push({
        id: `schedule:worst:${dimension}`,
        rule: "H1",
        area: "schedule",
        kind: "problem",
        severity: shortPeriod ? "info" : "low",
        confidence: shortPeriod ? "low" : confidenceOf(worst[0].low),
        title: `${noun} z najsłabszymi wynikami`,
        subject: worst.map((x) => x.s.label).join(", "),
        situation: worst.some((x) => !(x.s.metrics.conversions ?? 0))
          ? `Koszt bez konwersji albo CPA wyraźnie wyższy niż średnio (${money(base.cpa)}).`
          : `CPA wyraźnie wyższy niż średnio (${money(base.cpa)}).`,
        evidence: evidence(worst),
        cause:
          "Inna intencja użytkowników w tym czasie, mniejsza dostępność obsługi albo przypadek przy krótkim okresie.",
        action: shortPeriod
          ? "Zbierz dane z co najmniej 4 tygodni, zanim zmienisz harmonogram reklam."
          : "Rozważ obniżenie stawek w tym czasie (harmonogram reklam). Sprawdź najpierw, czy wzorzec powtarza się w kolejnych tygodniach.",
        source: source(dimension, "CPA względem średniej raportu; test dwumianowy"),
        cost: worst.reduce((s, x) => s + (x.s.metrics.cost ?? 0), 0),
      })
    if (bestOnes.length)
      findings.push({
        id: `schedule:best:${dimension}`,
        rule: "H2",
        area: "schedule",
        kind: "opportunity",
        severity: "info",
        confidence: shortPeriod ? "low" : confidenceOf(bestOnes[0].high),
        title: `${noun} z najlepszymi wynikami`,
        subject: bestOnes.map((x) => x.s.label).join(", "),
        situation: `CPA wyraźnie niższy niż średnio (${money(base.cpa)}).`,
        evidence: evidence(bestOnes),
        cause: "W tym czasie użytkownicy częściej kupują.",
        action:
          "Upewnij się, że kampanie nie wyczerpują budżetu przed tym czasem; rozważ wyższe stawki w harmonogramie.",
        source: source(dimension, "CPA względem średniej raportu; test dwumianowy"),
        cost: bestOnes.reduce((s, x) => s + (x.s.metrics.cost ?? 0), 0),
      })
  }
  extremes(days.segments, "Dzień tygodnia", "Dni tygodnia")
  extremes(hours.segments, "Godzina", "Godziny")

  return {
    report,
    days: days.segments,
    hours: hours.segments,
    base,
    weeks,
    result: { findings, notes },
  }
}
