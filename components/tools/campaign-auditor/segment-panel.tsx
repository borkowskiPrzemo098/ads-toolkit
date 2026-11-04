"use client"

import { NeonBars } from "@/components/charts/neon-bars"
import { TimeSeriesChart } from "@/components/charts/lazy"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { NEON_SERIES } from "@/constants/neon"
import {
  formatCompactMoney,
  formatCompactNumber,
  formatMoney,
} from "@/lib/auditor/format"
import type {
  ScheduleAnalysis,
  Segment,
  SegmentAnalysis,
} from "@/lib/auditor/rules/segments"
import { formatNumber, formatPercent } from "@/lib/formatting/number"

/** Segment table: the comparison spec 5D/5E asks for (CTR, CPC, CPA, ROAS per segment). */
export function SegmentTable({
  segments,
  label,
  currency,
}: {
  segments: Segment[]
  label: string
  currency: string | null
}) {
  const money = (v: number) => formatMoney(v, currency)
  const k = (r: { ok: boolean; value?: number }, f: (v: number) => string) =>
    r.ok ? f((r as { value: number }).value) : "N/D"
  return (
    <TableScroll label={`${label}: porównanie wskaźników`}>
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{label}</th>
            <th className="px-3 py-2 text-right font-medium">Koszt</th>
            <th className="px-3 py-2 text-right font-medium">Udział</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">Śr. CPC</th>
            <th className="px-3 py-2 text-right font-medium">Konw.</th>
            <th className="px-3 py-2 text-right font-medium">Wsp. konw.</th>
            <th className="px-3 py-2 text-right font-medium">CPA</th>
            <th className="py-2 pl-3 text-right font-medium">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3 font-medium">
                {s.label}
                {s.thin && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    za mało danych
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                {money(s.metrics.cost ?? 0)}
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                {formatPercent(s.costShare * 100, 0)}
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                {k(s.kpis.ctr, (v) => formatPercent(v, 2))}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                {k(s.kpis.cpc, money)}
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                {formatNumber(
                  s.metrics.conversions ?? 0,
                  (s.metrics.conversions ?? 0) % 1 ? 1 : 0
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular">
                {k(s.kpis.conversionRate, (v) => formatPercent(v, 2))}
              </td>
              <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                {k(s.kpis.cpa, money)}
              </td>
              <td className="py-2.5 pl-3 text-right tabular">
                {k(s.kpis.roas, (v) => formatPercent(v, 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )
}

export function SegmentPanel({
  analysis,
  label,
  currency,
}: {
  analysis: SegmentAnalysis
  label: string
  currency: string | null
}) {
  const money = (v: number) => formatMoney(v, currency)
  const withCpa = analysis.segments.filter((s) => s.kpis.cpa.ok && !s.thin).slice(0, 12)
  return (
    <Panel
      title={label}
      description={`Z raportu „${analysis.report.name}”. Porównanie ze średnią tego raportu; segmenty z małą liczbą kliknięć nie są oceniane.`}
    >
      <div className="flex flex-col gap-6">
        <SegmentTable segments={analysis.segments} label={label} currency={currency} />
        {withCpa.length > 1 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">CPA</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Średnio: {analysis.base.cpa ? money(analysis.base.cpa) : "N/D"}. Krótszy
              słupek = taniej.
            </p>
            <NeonBars
              caption={`${label}: CPA`}
              bars={withCpa.map((s, i) => ({
                label: s.label,
                value: s.kpis.cpa.ok ? s.kpis.cpa.value : 0,
                display: s.kpis.cpa.ok ? money(s.kpis.cpa.value) : "N/D",
                note: `${formatNumber(s.metrics.conversions ?? 0, (s.metrics.conversions ?? 0) % 1 ? 1 : 0)} konw.`,
                color: NEON_SERIES[i % NEON_SERIES.length],
              }))}
            />
          </div>
        )}
      </div>
    </Panel>
  )
}

export function SchedulePanel({
  analysis,
  currency,
}: {
  analysis: ScheduleAnalysis
  currency: string | null
}) {
  const hourPoints = (pick: (s: Segment) => number | null) =>
    analysis.hours.map((s) => ({ label: s.key, value: pick(s) }))
  return (
    <Panel
      title="Godziny i dni tygodnia"
      description={`Z raportu „${analysis.report.name}”${analysis.weeks ? `, ok. ${analysis.weeks} ${analysis.weeks === 1 ? "tydzień" : "tygodnie"}` : ""}.`}
    >
      <div className="flex flex-col gap-6">
        {analysis.hours.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Konwersje według godziny</h3>
              <TimeSeriesChart
                title="Konwersje"
                kind="bar"
                color="#2ef2a0"
                points={hourPoints((s) => s.metrics.conversions)}
                format={(v) => formatNumber(v, v % 1 ? 1 : 0)}
                compact={formatCompactNumber}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">CPA według godziny</h3>
              <TimeSeriesChart
                title="CPA"
                kind="bar"
                color="#ff8a3d"
                points={hourPoints((s) => (s.kpis.cpa.ok ? s.kpis.cpa.value : null))}
                format={(v) => formatMoney(v, currency)}
                compact={(v) => formatCompactMoney(v, currency)}
              />
            </div>
          </div>
        )}
        {analysis.days.length > 0 && (
          <SegmentTable
            segments={analysis.days}
            label="Dzień tygodnia"
            currency={currency}
          />
        )}
      </div>
    </Panel>
  )
}
