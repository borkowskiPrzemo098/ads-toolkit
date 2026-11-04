"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { Panel } from "@/components/layout/panel"
import { TableScroll } from "@/components/layout/table-scroll"
import { Button } from "@/components/ui/button"
import { REPORT_TYPES } from "@/lib/auditor/detect"
import type { AuditDataset, CheckStatus, JoinMethod } from "@/lib/auditor/join"
import type { Metrics } from "@/lib/auditor/metrics"
import { formatPeriod } from "@/lib/reports/dates"
import { formatMoney } from "@/lib/auditor/format"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import { IssueList } from "./report-card"

const STATUS: Record<CheckStatus, { label: string; className: string }> = {
  source: { label: "Źródło sum", className: "bg-(--tool) text-[#0b0d12]" },
  match: { label: "Zgodny", className: "bg-success/15 text-success ring-success/30" },
  lower: { label: "Część konta", className: "bg-[#1a202c] text-[#c9cfdb] ring-border" },
  higher: {
    label: "Za wysoki",
    className: "bg-destructive/15 text-destructive ring-destructive/30",
  },
  "other-period": {
    label: "Inny okres",
    className: "bg-warning/15 text-warning ring-warning/30",
  },
  "no-metrics": {
    label: "Bez metryk",
    className: "bg-[#1a202c] text-muted-foreground ring-border",
  },
}

const JOIN_LABEL: Record<JoinMethod, string> = {
  id: "po ID",
  "name→id": "nazwa → ID",
  name: "po nazwie",
  none: "bez kampanii",
}

const num = (v: number | null, digits = 0) => (v === null ? "—" : formatNumber(v, digits))
const share = (d: number | null | undefined) =>
  d === null || d === undefined ? "—" : formatPercent((1 + d) * 100, 0)

/**
 * Step 3: how the reports were joined, before any analysis. Shows where account totals come
 * from and how every other report compares with them, so double counting is visible.
 */
export function DataCheck({
  data,
  onBack,
  onNext,
}: {
  data: AuditDataset
  onBack: () => void
  onNext: () => void
}) {
  const { primary, totals } = data
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, data.currency))
  const name = (id: string) => data.reports.find((r) => r.id === id)!.name

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Sumy konta"
        description={
          primary
            ? `Z raportu „${primary.name}” (${REPORT_TYPES[primary.type].label.toLowerCase()})${primary.period ? `, ${formatPeriod(primary.period.from, primary.period.to)}` : ""}. Raporty szczegółowe nie są do nich dodawane.`
            : "Żaden raport nie zawiera kosztu, więc nie można policzyć sum konta."
        }
      >
        <MetricsRow metrics={totals} money={money} />
        {!data.currency && (
          <p className="mt-4 text-xs text-muted-foreground">
            Raporty nie podają waluty, więc kwoty są pokazane bez symbolu.
          </p>
        )}
      </Panel>

      {data.issues.length > 0 && (
        <Panel title="Do sprawdzenia">
          <IssueList issues={data.issues} />
        </Panel>
      )}

      <Panel
        title="Zgodność raportów"
        description="Każdy raport porównany z sumami konta. Raporty szczegółowe zwykle obejmują tylko część konta; wyższa suma oznacza problem z danymi."
      >
        <TableScroll label="Zgodność raportów z sumami konta">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Raport</th>
                <th className="px-3 py-2 font-medium">Stan</th>
                <th className="px-3 py-2 text-right font-medium">Koszt</th>
                <th className="px-3 py-2 text-right font-medium">% kosztu konta</th>
                <th className="px-3 py-2 text-right font-medium">Kliknięcia</th>
                <th className="px-3 py-2 text-right font-medium">Konwersje</th>
                <th className="py-2 pl-3 font-medium">Wyjaśnienie</th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((c) => (
                <tr
                  key={c.reportId}
                  className="border-b border-border/60 align-top last:border-0"
                >
                  <td className="min-w-[9rem] py-2.5 pr-3 [overflow-wrap:anywhere]">
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {REPORT_TYPES[c.type].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-transparent ring-inset",
                        STATUS[c.status].className
                      )}
                    >
                      {STATUS[c.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                    {money(c.metrics.cost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {c.status === "source" ? "100%" : share(c.diff.cost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {num(c.metrics.clicks)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {num(c.metrics.conversions, 1)}
                  </td>
                  <td className="max-w-[22rem] py-2.5 pl-3 text-xs leading-relaxed text-muted-foreground">
                    {c.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <Panel
        title={`Kampanie (${formatNumber(data.campaigns.length)})`}
        description="Kampanie rozpoznane we wszystkich raportach. Koszt pochodzi wyłącznie z raportu z sumami konta."
      >
        <TableScroll label="Kampanie i raporty, w których występują">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Kampania</th>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 text-right font-medium">Koszt</th>
                <th className="py-2 pl-3 font-medium">Występuje w raportach</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-border/60 align-top last:border-0"
                >
                  <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular">
                    {c.id ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                    {c.primary ? money(c.primary.cost) : "poza sumami"}
                  </td>
                  <td className="py-2.5 pl-3 text-xs text-muted-foreground">
                    {c.reports.map(name).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <Panel
        title="Łączenie raportów"
        description="Jak wiersze każdego raportu zostały przypisane do kampanii. Identyfikator jest najpewniejszy; nazwa to rozwiązanie awaryjne."
      >
        <ul className="flex flex-col gap-2.5 text-sm">
          {data.joins.map((j) => {
            const parts = (Object.keys(JOIN_LABEL) as JoinMethod[])
              .filter((m) => j.campaign[m] > 0)
              .map((m) => `${JOIN_LABEL[m]}: ${formatNumber(j.campaign[m])}`)
            return (
              <li key={j.reportId} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="font-medium [overflow-wrap:anywhere] sm:w-64 sm:shrink-0">
                  {name(j.reportId)}
                </span>
                <span className="text-muted-foreground">{parts.join(" · ")}</span>
              </li>
            )
          })}
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onNext} disabled={!primary}>
          Przejdź do dashboardu
          <ArrowRight />
        </Button>
        <Button variant="outline" size="lg" onClick={onBack}>
          <ArrowLeft />
          Wróć do raportów
        </Button>
      </div>
    </div>
  )
}

function MetricsRow({
  metrics,
  money,
}: {
  metrics: Metrics
  money: (v: number | null) => string
}) {
  const items: [string, string][] = [
    ["Koszt", money(metrics.cost)],
    ["Wyświetlenia", num(metrics.impressions)],
    ["Kliknięcia", num(metrics.clicks)],
    ["Konwersje", num(metrics.conversions, 1)],
    ["Wartość konwersji", money(metrics.conversionValue)],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight text-(--tool) tabular neon-text">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
