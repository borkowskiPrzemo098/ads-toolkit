import { confidenceOf, type Finding } from "../findings"
import { addInto, emptyMetrics, kpisOf, sumMetrics, type Metrics } from "../metrics"
import { nameKey, type NormalizedReport } from "../normalize"
import { median, pLower } from "../stats"
import { T } from "../thresholds"
import { baselineOf, n0, n1, pct, periodOf, type RuleContext } from "./context"
import type { RuleResult } from "./campaigns"

/*
 * Ads (spec 5G). The ad report has results per whole ad, so single RSA headlines are never
 * judged from it. Ads are compared with other ads of the same ad group.
 */

export interface AdRow {
  key: string
  label: string
  adGroup: string
  campaign: string
  strength?: string
  metrics: Metrics
}

const POOR = /^(poor|slab|niska)/i

export function pickAdReport(ctx: RuleContext): NormalizedReport | null {
  return (
    ctx.data.reports
      .filter((r) => r.type === "ad" && r.records.some((x) => x.metrics.cost !== null))
      .sort((a, b) => b.records.length - a.records.length)[0] ?? null
  )
}

export function adRules(
  ctx: RuleContext
): (RuleResult & { rows: AdRow[]; totalCost: number; flaggedCost: number }) | null {
  const report = pickAdReport(ctx)
  if (!report) return null
  const { money } = ctx
  const map = new Map<string, AdRow>()
  for (const r of report.records) {
    const d = r.dims
    const key = d.adId ?? `${nameKey(d.adGroup ?? "")}|${nameKey(d.headline ?? "")}`
    const row = map.get(key) ?? {
      key,
      label: d.headline
        ? `${d.headline}${d.adId ? ` (ID ${d.adId})` : ""}`
        : `Reklama ${d.adId ?? key}`,
      adGroup: d.adGroup ?? "—",
      campaign: d.campaign ?? "—",
      strength: d.adStrength,
      metrics: emptyMetrics(),
    }
    addInto(row.metrics, r.metrics)
    map.set(key, row)
  }
  const rows = [...map.values()]
  const totals = sumMetrics(rows.map((r) => r.metrics))
  const base = baselineOf(totals)
  const totalCost = totals.cost ?? 0
  const source = (method: string) => ({
    report: report.name,
    dimension: "Reklama",
    period: periodOf(report),
    method,
  })
  const findings: Finding[] = []
  const notes = [
    "Eksport reklam podaje wyniki całej reklamy, dlatego nie oceniamy skuteczności pojedynczych nagłówków i tekstów RSA.",
  ]

  // G1: ads rated poor by Google.
  const poor = rows.filter((r) => r.strength && POOR.test(r.strength))
  if (poor.length) {
    const cost = poor.reduce((s, r) => s + (r.metrics.cost ?? 0), 0)
    findings.push({
      id: "G1",
      rule: "G1",
      area: "ad",
      kind: "problem",
      severity: totalCost && cost / totalCost >= T.highCostShare ? "medium" : "low",
      confidence: "high",
      title: "Reklamy z niską oceną skuteczności (Ad Strength)",
      subject: `${poor.length} ${poor.length === 1 ? "reklama" : "reklam"}`,
      situation: `Google ocenia te reklamy jako słabe. Wydały ${money(cost)}.`,
      evidence: poor
        .slice(0, 6)
        .map((r) => ({
          label: `${r.label} · ${r.adGroup}`,
          value: `${r.strength}, ${money(r.metrics.cost ?? 0)}`,
        })),
      cause:
        "Zwykle zbyt mało unikalnych nagłówków i tekstów albo słabe powiązanie ze słowami kluczowymi.",
      action:
        "Dodaj unikalne nagłówki z głównymi słowami kluczowymi i korzyściami (kreator RSA w aplikacji pomoże w limitach znaków).",
      source: source("kolumna „Skuteczność reklamy” z eksportu Google Ads"),
      cost,
    })
  }

  // G2: an ad converting clearly worse than the other ads in its ad group.
  const groups = new Map<string, AdRow[]>()
  for (const r of rows) groups.set(r.adGroup, [...(groups.get(r.adGroup) ?? []), r])
  for (const [group, ads] of groups) {
    if (ads.length < 2) continue
    for (const ad of ads) {
      const others = sumMetrics(ads.filter((a) => a !== ad).map((a) => a.metrics))
      const otherCr = kpisOf(others).conversionRate
      const clicks = ad.metrics.clicks ?? 0
      const conv = ad.metrics.conversions ?? 0
      if (!otherCr.ok || !otherCr.value || !clicks) continue
      const p = pLower(conv, clicks, otherCr.value / 100)
      if (p >= T.alpha || conv / clicks >= (otherCr.value / 100) * T.lowCrRatio) continue
      findings.push({
        id: `G2:${ad.key}`,
        rule: "G2",
        area: "ad",
        kind: "problem",
        severity: "medium",
        confidence: confidenceOf(p),
        title: "Reklama konwertuje wyraźnie słabiej niż inne w grupie",
        subject: `${ad.label} · ${group}`,
        situation: `Współczynnik konwersji ${pct((conv / clicks) * 100, 2)} wobec ${pct(otherCr.value, 2)} pozostałych reklam w grupie.`,
        evidence: [
          { label: "Kliknięcia", value: n0(clicks) },
          { label: "Konwersje", value: n1(conv) },
          { label: "Koszt", value: money(ad.metrics.cost ?? 0) },
          ...(ad.strength ? [{ label: "Skuteczność reklamy", value: ad.strength }] : []),
        ],
        cause:
          "Przekaz reklamy może słabiej odpowiadać ofercie strony docelowej albo przyciągać mniej zdecydowanych użytkowników.",
        action:
          "Porównaj teksty z lepszą reklamą w tej grupie; rozważ wstrzymanie słabszej wersji po dodaniu nowego wariantu.",
        source: source(
          "porównanie z pozostałymi reklamami tej samej grupy; test dwumianowy"
        ),
        cost: ad.metrics.cost ?? 0,
      })
    }
  }

  // G3: CTR clearly below the median of ads.
  const withCtr = rows.filter(
    (r) => (r.metrics.impressions ?? 0) >= T.minImpressionsForCtr
  )
  const med = median(withCtr.map((r) => (r.metrics.clicks ?? 0) / r.metrics.impressions!))
  if (med && withCtr.length >= 3)
    for (const ad of withCtr) {
      const ctr = (ad.metrics.clicks ?? 0) / ad.metrics.impressions!
      const p = pLower(ad.metrics.clicks ?? 0, ad.metrics.impressions!, med)
      if (ctr >= med * T.lowCtrRatio || p >= T.alpha) continue
      findings.push({
        id: `G3:${ad.key}`,
        rule: "G3",
        area: "ad",
        kind: "problem",
        severity: "low",
        confidence: confidenceOf(p),
        title: "Reklama z bardzo niskim CTR",
        subject: `${ad.label} · ${ad.adGroup}`,
        situation: `CTR ${pct(ctr * 100, 2)} wobec mediany reklam ${pct(med * 100, 2)}.`,
        evidence: [
          { label: "Wyświetlenia", value: n0(ad.metrics.impressions) },
          { label: "Kliknięcia", value: n0(ad.metrics.clicks) },
        ],
        cause: "Nagłówki mogą słabo odpowiadać na zapytania.",
        action: "Dodaj nagłówki z treścią słów kluczowych i wyraźną korzyścią.",
        source: source("CTR względem mediany reklam; test dwumianowy"),
        cost: ad.metrics.cost ?? 0,
      })
    }

  if (!base.cr)
    notes.push("Raport reklam nie ma konwersji: oceniamy tylko CTR i ocenę skuteczności.")
  // Each flagged ad counted once, even when several rules point at it.
  const flagged = new Set([
    ...poor.map((r) => r.key),
    ...findings.filter((f) => f.rule !== "G1").map((f) => f.id.slice(3)),
  ])
  const flaggedCost = rows
    .filter((r) => flagged.has(r.key))
    .reduce((s, r) => s + (r.metrics.cost ?? 0), 0)
  return { findings, notes, rows, totalCost, flaggedCost }
}
