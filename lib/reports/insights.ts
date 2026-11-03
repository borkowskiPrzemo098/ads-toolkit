import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Currency,
} from "@/lib/formatting/number"
import { budgetUse, change, type PeriodSummary } from "./aggregate"
import { formatPeriod } from "./dates"
import type { Metric } from "./import"

export interface ReportTexts {
  summary: string
  observations: string[]
  conclusions: string[]
  recommendations: string[]
}

/** Changes smaller than this are not worth a separate observation. */
const NOTABLE_CHANGE = 10
const UNDERSPEND = 90
const OVERSPEND = 105

const signed = (pct: number) => `${pct > 0 ? "+" : ""}${formatPercent(pct, 0)}`

/**
 * Builds the report's texts from the numbers only. Every sentence states a fact from the
 * data or suggests what to check; none claims why something happened.
 */
export function buildReportTexts(
  current: PeriodSummary,
  previous: PeriodSummary | null,
  budget: number | null,
  currency: Currency
): ReportTexts {
  const money = (x: number) => formatCurrency(x, currency)
  const t = current.totals
  const k = current.kpis
  const observations: string[] = []
  const conclusions: string[] = []
  const recommendations: string[] = []

  // Summary
  const parts: string[] = []
  if (t.clicks !== null) parts.push(`${formatNumber(t.clicks)} kliknięć`)
  if (t.conversions !== null)
    parts.push(`${formatNumber(t.conversions, t.conversions % 1 ? 1 : 0)} konwersji`)
  const period = current.range
    ? `W okresie ${formatPeriod(current.range.from, current.range.to)}`
    : "W raportowanym okresie"
  let summary = `${period} kampanie przyniosły ${parts.join(" i ") || "wyniki opisane poniżej"}`
  summary += t.cost !== null ? ` przy koszcie ${money(t.cost)}.` : "."
  if (k.roas.ok) summary += ` ROAS wyniósł ${formatPercent(k.roas.value, 0)}.`
  if (k.cpa.ok) summary += ` Średni koszt konwersji to ${money(k.cpa.value)}.`

  // Budget
  const use = budgetUse(t.cost, budget)
  if (use.ok) {
    observations.push(
      `Wydano ${money(t.cost!)}, czyli ${formatPercent(use.value, 0)} budżetu ${money(budget!)}.`
    )
    if (use.value < UNDERSPEND)
      conclusions.push(
        `Budżet nie został w pełni wykorzystany (${formatPercent(use.value, 0)}).`
      )
    if (use.value > OVERSPEND)
      conclusions.push(
        `Wydatki przekroczyły zaplanowany budżet o ${formatPercent(use.value - 100, 0)}.`
      )
  }

  // Period comparison
  if (previous) {
    const p = previous.totals
    const pk = previous.kpis
    const metricChanges: [string, number | null, (x: number) => string, number | null][] =
      [
        ["Koszt", change(t.cost, p.cost), money, t.cost],
        ["Kliknięcia", change(t.clicks, p.clicks), (x) => formatNumber(x), t.clicks],
        [
          "Konwersje",
          change(t.conversions, p.conversions),
          (x) => formatNumber(x, x % 1 ? 1 : 0),
          t.conversions,
        ],
        [
          "Wartość konwersji",
          change(t.conversionValue, p.conversionValue),
          money,
          t.conversionValue,
        ],
        [
          "CPA",
          change(k.cpa.ok ? k.cpa.value : null, pk.cpa.ok ? pk.cpa.value : null),
          money,
          k.cpa.ok ? k.cpa.value : null,
        ],
        [
          "ROAS",
          change(k.roas.ok ? k.roas.value : null, pk.roas.ok ? pk.roas.value : null),
          (x) => formatPercent(x, 0),
          k.roas.ok ? k.roas.value : null,
        ],
        [
          "CTR",
          change(k.ctr.ok ? k.ctr.value : null, pk.ctr.ok ? pk.ctr.value : null),
          (x) => formatPercent(x, 2),
          k.ctr.ok ? k.ctr.value : null,
        ],
      ]
    let quiet = 0
    for (const [label, delta, fmt, value] of metricChanges) {
      if (delta === null || value === null) continue
      if (Math.abs(delta) >= NOTABLE_CHANGE) {
        observations.push(
          `${label}: ${fmt(value)} (${signed(delta)} wobec poprzedniego okresu).`
        )
      } else quiet++
    }
    if (quiet > 0)
      observations.push(
        `Pozostałe porównywane wskaźniki (${quiet}) zmieniły się o mniej niż ${NOTABLE_CHANGE}%.`
      )

    const costChange = change(t.cost, p.cost)
    const convChange = change(t.conversions, p.conversions)
    if (costChange !== null && convChange !== null && k.cpa.ok && pk.cpa.ok) {
      if (costChange > convChange + 5) {
        conclusions.push(
          `Koszty rosły szybciej niż liczba konwersji, więc CPA wzrósł z ${money(pk.cpa.value)} do ${money(k.cpa.value)}.`
        )
      } else if (convChange > costChange + 5) {
        conclusions.push(
          `Konwersje rosły szybciej niż koszty, więc CPA spadł z ${money(pk.cpa.value)} do ${money(k.cpa.value)}.`
        )
      }
      const cpaChange = change(k.cpa.value, pk.cpa.value)
      if (cpaChange !== null && cpaChange >= 15) {
        recommendations.push(
          `Sprawdź, które kampanie odpowiadają za wzrost CPA o ${formatPercent(cpaChange, 0)}.`
        )
      }
    }
  }

  // Campaigns
  const campaigns = current.campaigns
  if (campaigns && campaigns.length > 1) {
    if (t.conversions) {
      const top = [...campaigns].sort(
        (a, b) => (b.totals.conversions ?? 0) - (a.totals.conversions ?? 0)
      )[0]
      if (top.totals.conversions) {
        observations.push(
          `Najwięcej konwersji dała kampania „${top.key}”: ${formatNumber(top.totals.conversions, top.totals.conversions % 1 ? 1 : 0)} (${formatPercent((top.totals.conversions / t.conversions) * 100, 0)} wszystkich).`
        )
      }
    }
    if (t.cost) {
      const biggest = campaigns[0]
      observations.push(
        `Największy koszt miała kampania „${biggest.key}”: ${money(biggest.totals.cost ?? 0)} (${formatPercent(((biggest.totals.cost ?? 0) / t.cost) * 100, 0)} wszystkich kosztów).`
      )
    }
    const withCpa = campaigns.filter((c) => c.kpis.cpa.ok)
    if (withCpa.length > 1) {
      const worst = withCpa.reduce((a, b) =>
        (a.kpis.cpa.ok ? a.kpis.cpa.value : 0) >= (b.kpis.cpa.ok ? b.kpis.cpa.value : 0)
          ? a
          : b
      )
      if (worst.kpis.cpa.ok && k.cpa.ok && worst.kpis.cpa.value > k.cpa.value * 1.3) {
        recommendations.push(
          `Przeanalizuj kampanię „${worst.key}”: jej CPA (${money(worst.kpis.cpa.value)}) jest wyższy od średniej ${money(k.cpa.value)}.`
        )
      }
    }
  }
  if (campaigns && t.conversions !== null) {
    const wasted = campaigns.filter(
      (c) => (c.totals.cost ?? 0) > 0 && (c.totals.conversions ?? 0) === 0
    )
    for (const c of wasted.slice(0, 3)) {
      recommendations.push(
        `Sprawdź słowa kluczowe i wyszukiwane hasła w kampanii „${c.key}”: wydała ${money(c.totals.cost!)} bez konwersji.`
      )
    }
    if (wasted.length > 3)
      observations.push(`Kampanii z kosztem i bez konwersji jest ${wasted.length}.`)
  }

  // Best day
  if (current.daily && current.daily.length > 2 && t.conversions) {
    const best = current.daily.reduce((a, b) =>
      (b.totals.conversions ?? 0) > (a.totals.conversions ?? 0) ? b : a
    )
    if (best.totals.conversions) {
      observations.push(
        `Najwięcej konwersji przyniósł dzień ${formatPeriod(best.key, best.key)}: ${formatNumber(best.totals.conversions, best.totals.conversions % 1 ? 1 : 0)}.`
      )
    }
  }

  // Return on ad spend
  if (k.roas.ok) {
    conclusions.push(
      k.roas.value >= 100
        ? `Wartość konwersji pokryła koszt reklamy ${formatNumber(k.roas.value / 100, 1)} raza (ROAS ${formatPercent(k.roas.value, 0)}). To przychód, nie zysk: o rentowności decyduje też marża.`
        : `Wartość konwersji była niższa niż koszt reklamy (ROAS ${formatPercent(k.roas.value, 0)}).`
    )
    if (k.roas.value < 100) {
      recommendations.push(
        "Porównaj ROAS z progiem rentowności dla Twojej marży, zanim zwiększysz budżet."
      )
    }
  } else if (t.conversions && t.conversionValue === null) {
    recommendations.push(
      "Skonfiguruj wartość konwersji w Google Ads, aby kolejne raporty pokazywały ROAS."
    )
  }

  if (use.ok && use.value < UNDERSPEND) {
    recommendations.push(
      k.roas.ok && k.roas.value >= 100
        ? "Kampanie nie wykorzystały budżetu przy zwrocie wyższym niż koszt. Sprawdź ograniczenia stawek, budżety dzienne i kierowanie."
        : "Sprawdź, co ogranicza wydatki: stawki, budżety dzienne albo kierowanie."
    )
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Dane nie wskazują pilnych zmian. Porównaj wyniki z kolejnym okresem, zanim wprowadzisz poprawki."
    )
  }

  return { summary, observations, conclusions, recommendations }
}

export const METRIC_LABELS: Record<Metric, string> = {
  impressions: "Wyświetlenia",
  clicks: "Kliknięcia",
  cost: "Koszt",
  conversions: "Konwersje",
  conversionValue: "Wartość konwersji",
}
