"use client"

import { useMemo, useState } from "react"
import { Database, FilterX, Info } from "lucide-react"
import { NeonBars } from "@/components/charts/neon-bars"
import { TimeSeriesChart } from "@/components/charts/lazy"
import { SelectField } from "@/components/forms/select-field"
import { KpiTile } from "@/components/layout/kpi-tile"
import { Panel } from "@/components/layout/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NEON_SERIES } from "@/constants/neon"
import {
  buildDashboard,
  DEVICE_LABEL,
  filterOptions,
  isUnavailable,
  NO_FILTERS,
  STATUS_LABEL,
  type DashboardFilters,
  type DashboardModel,
} from "@/lib/auditor/dashboard"
import { REPORT_TYPES } from "@/lib/auditor/detect"
import {
  formatCompactMoney,
  formatCompactNumber,
  formatMoney,
} from "@/lib/auditor/format"
import { plural } from "@/lib/auditor/import"
import type { AuditDataset } from "@/lib/auditor/join"
import type { Metric } from "@/lib/auditor/metrics"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { formatPeriod, formatShortDate } from "@/lib/reports/dates"
import { calcFail, calcOk, type CalcResult } from "@/types/calculation"

const ALL = "all"

const MISSING: Record<Metric, string> = {
  impressions: "Raport nie ma kolumny z wyświetleniami.",
  clicks: "Raport nie ma kolumny z kliknięciami.",
  cost: "Raport nie ma kolumny z kosztem.",
  conversions: "Raport nie ma kolumny z konwersjami.",
  conversionValue: "Raport nie ma kolumny z wartością konwersji.",
}

/** Step 4: KPIs, charts and filters. Every number comes from one report, named on screen. */
export function AuditDashboard({ data }: { data: AuditDataset }) {
  const [filters, setFilters] = useState<DashboardFilters>(NO_FILTERS)
  const options = useMemo(() => filterOptions(data), [data])
  const model = useMemo(() => buildDashboard(data, filters), [data, filters])
  const money = (v: number) => formatMoney(v, data.currency)
  const set = (patch: Partial<DashboardFilters>) =>
    setFilters((f) => ({ ...f, ...patch }))
  const active = Object.values(filters).some((v) => v !== null)

  const metric = (m: Metric): CalcResult =>
    model.totals[m] === null ? calcFail(MISSING[m]) : calcOk(model.totals[m]!)

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Filtry"
        action={
          active && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
              <FilterX />
              Wyczyść
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SelectField
            label="Kampania"
            value={filters.campaign ?? ALL}
            options={[{ value: ALL, label: "Wszystkie kampanie" }, ...options.campaigns]}
            onChange={(v) => set({ campaign: v === ALL ? null : v })}
          />
          {options.campaignTypes.length > 0 && (
            <SelectField
              label="Typ kampanii"
              value={filters.campaignType ?? ALL}
              options={[
                { value: ALL, label: "Wszystkie typy" },
                ...options.campaignTypes.map((t) => ({ value: t, label: t })),
              ]}
              onChange={(v) => set({ campaignType: v === ALL ? null : v })}
            />
          )}
          {options.statuses.length > 0 && (
            <SelectField
              label="Stan kampanii"
              value={filters.campaignStatus ?? ALL}
              options={[
                { value: ALL, label: "Wszystkie stany" },
                ...options.statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
              ]}
              onChange={(v) =>
                set({
                  campaignStatus:
                    v === ALL ? null : (v as DashboardFilters["campaignStatus"]),
                })
              }
            />
          )}
          {options.devices.length > 0 && (
            <SelectField
              label="Urządzenie"
              value={filters.device ?? ALL}
              options={[
                { value: ALL, label: "Wszystkie urządzenia" },
                ...options.devices.map((d) => ({ value: d, label: DEVICE_LABEL[d] })),
              ]}
              onChange={(v) =>
                set({ device: v === ALL ? null : (v as DashboardFilters["device"]) })
              }
            />
          )}
          {options.locations.length > 0 && (
            <SelectField
              label="Lokalizacja"
              value={filters.location ?? ALL}
              options={[
                { value: ALL, label: "Wszystkie lokalizacje" },
                ...options.locations.map((l) => ({ value: l, label: l })),
              ]}
              onChange={(v) => set({ location: v === ALL ? null : v })}
            />
          )}
          {options.dates && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-2">
              <DateField
                label="Od"
                value={filters.from}
                min={options.dates.from}
                max={filters.to ?? options.dates.to}
                onChange={(from) => set({ from })}
              />
              <DateField
                label="Do"
                value={filters.to}
                min={filters.from ?? options.dates.from}
                max={options.dates.to}
                onChange={(to) => set({ to })}
              />
            </div>
          )}
        </div>
        {!options.dates && (
          <p className="mt-3 text-xs text-muted-foreground">
            Filtr okresu pojawi się, gdy któryś raport ma kolumnę „Dzień”.
          </p>
        )}
      </Panel>

      <SourceLine model={model} />
      {!data.currency && !model.unavailable && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Raporty nie podają waluty, więc kwoty są pokazane bez symbolu.
        </p>
      )}

      {model.unavailable ? (
        <p
          role="status"
          className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-[#f7cf7c]"
        >
          {model.unavailable}
        </p>
      ) : (
        <>
          <section
            aria-label="Najważniejsze wskaźniki"
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
          >
            <KpiTile label="Koszt" result={metric("cost")} format={money} />
            <KpiTile
              label="Kliknięcia"
              result={metric("clicks")}
              format={(v) => formatNumber(v)}
            />
            <KpiTile
              label="Wyświetlenia"
              result={metric("impressions")}
              format={(v) => formatNumber(v)}
            />
            <KpiTile
              label="CTR"
              result={model.kpis.ctr}
              format={(v) => formatPercent(v, 2)}
              detail="kliknięcia ÷ wyświetlenia"
            />
            <KpiTile
              label="Śr. CPC"
              result={model.kpis.cpc}
              format={money}
              detail="koszt ÷ kliknięcia"
            />
            <KpiTile
              label="Konwersje"
              result={metric("conversions")}
              format={(v) => formatNumber(v, v % 1 ? 1 : 0)}
            />
            <KpiTile
              label="Współczynnik konwersji"
              result={model.kpis.conversionRate}
              format={(v) => formatPercent(v, 2)}
              detail="konwersje ÷ kliknięcia"
            />
            <KpiTile
              label="CPA"
              result={model.kpis.cpa}
              format={money}
              detail="koszt ÷ konwersje"
            />
            <KpiTile
              label="Wartość konwersji"
              result={metric("conversionValue")}
              format={money}
            />
            <KpiTile
              label="ROAS"
              result={model.kpis.roas}
              format={(v) => formatPercent(v, 0)}
              detail="wartość konw. ÷ koszt"
            />
          </section>
          <p className="-mt-2 text-xs text-muted-foreground">
            ROAS to przychód z reklam względem kosztu, nie zysk. Do zysku potrzebna jest
            marża (analiza rentowności w kolejnym etapie).
          </p>

          <TimeCharts model={model} currency={data.currency} />
          <CampaignCharts model={model} money={money} />
        </>
      )}
    </div>
  )
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string | null
  min: string
  max: string
  onChange: (value: string | null) => void
}) {
  const id = `period-${label}`
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value || null)}
        className="tabular [color-scheme:dark]"
      />
    </div>
  )
}

function SourceLine({ model }: { model: DashboardModel }) {
  if (!model.source) return null
  const s = model.source
  return (
    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
      <p className="flex items-start gap-2">
        <Database className="mt-0.5 size-4 shrink-0 text-(--tool)" aria-hidden="true" />
        <span>
          Źródło: <span className="font-medium text-foreground">{s.name}</span> (
          {REPORT_TYPES[s.type].label.toLowerCase()}
          {s.period && `, ${formatPeriod(s.period.from, s.period.to)}`}),{" "}
          {formatNumber(model.records)}{" "}
          {plural(model.records, "rekord", "rekordy", "rekordów")} po filtrach.
        </span>
      </p>
      {model.sourceNote && (
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {model.sourceNote}
        </p>
      )}
    </div>
  )
}

function TimeCharts({
  model,
  currency,
}: {
  model: DashboardModel
  currency: string | null
}) {
  if (isUnavailable(model.series))
    return (
      <Panel title="Wyniki w czasie">
        <p className="text-sm text-muted-foreground">{model.series.reason}</p>
      </Panel>
    )
  const { points, granularity, source } = model.series
  const label = (d: string) =>
    granularity === "week" ? `tydz. ${formatShortDate(d)}` : formatShortDate(d)
  const pts = (pick: (p: (typeof points)[number]) => number | null) =>
    points.map((p) => ({ label: label(p.date), value: pick(p) }))
  const hasValue = points.some((p) => p.metrics.conversionValue !== null)

  return (
    <Panel
      title="Wyniki w czasie"
      description={`${granularity === "week" ? "Tygodniowo" : "Dziennie"}, z raportu „${source.name}”.${source !== model.source ? " To inny raport niż źródło wskaźników, więc sumy mogą się różnić." : ""}`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Koszt</h3>
          <TimeSeriesChart
            title="Koszt"
            kind="bar"
            color="#ff4f8b"
            points={pts((p) => p.metrics.cost)}
            format={(v) => formatMoney(v, currency)}
            compact={(v) => formatCompactMoney(v, currency)}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Konwersje</h3>
          <TimeSeriesChart
            title="Konwersje"
            kind="bar"
            color="#2ef2a0"
            points={pts((p) => p.metrics.conversions)}
            format={(v) => formatNumber(v, v % 1 ? 1 : 0)}
            compact={formatCompactNumber}
          />
        </div>
        <div className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">ROAS</h3>
          {hasValue ? (
            <TimeSeriesChart
              title="ROAS"
              kind="line"
              color="#36d6ff"
              points={pts((p) => (p.kpis.roas.ok ? p.kpis.roas.value : null))}
              format={(v) => formatPercent(v, 0)}
              compact={(v) => `${formatNumber(v)}%`}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Raport nie ma kolumny z wartością konwersji, więc ROAS w czasie nie jest
              dostępny.
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}

function CampaignCharts({
  model,
  money,
}: {
  model: DashboardModel
  money: (v: number) => string
}) {
  if (isUnavailable(model.campaigns))
    return (
      <Panel title="Kampanie">
        <p className="text-sm text-muted-foreground">{model.campaigns.reason}</p>
      </Panel>
    )
  const rows = model.campaigns.rows
  const color = (i: number) => NEON_SERIES[i % NEON_SERIES.length]
  const withCpa = rows.filter((r) => r.kpis.cpa.ok)
  const noConversions = rows.filter((r) => !r.kpis.cpa.ok && (r.metrics.cost ?? 0) > 0)

  return (
    <Panel
      title="Kampanie"
      description="Ten sam raport co wskaźniki powyżej, więc słupki sumują się do wartości konta."
    >
      <div className="flex flex-col gap-8">
        <BudgetShare rows={rows} color={color} money={money} />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div>
            <h3 className="mb-3.5 text-sm font-semibold">Koszt według kampanii</h3>
            <NeonBars
              caption="Koszt według kampanii"
              bars={rows.map((r, i) => ({
                label: r.name,
                value: r.metrics.cost ?? 0,
                display: money(r.metrics.cost ?? 0),
                color: color(i),
              }))}
            />
          </div>
          <div>
            <h3 className="mb-3.5 text-sm font-semibold">Konwersje według kampanii</h3>
            <NeonBars
              caption="Konwersje według kampanii"
              bars={rows.map((r, i) => ({
                label: r.name,
                value: r.metrics.conversions ?? 0,
                display:
                  r.metrics.conversions === null
                    ? "N/D"
                    : formatNumber(
                        r.metrics.conversions,
                        r.metrics.conversions % 1 ? 1 : 0
                      ),
                color: color(i),
              }))}
            />
          </div>
          <div className="xl:col-span-2">
            <h3 className="mb-1 text-sm font-semibold">CPA według kampanii</h3>
            <p className="mb-3.5 text-xs text-muted-foreground">
              Koszt pozyskania konwersji. Krótszy słupek = taniej. Porównuj z wolumenem
              konwersji: niski CPA przy kilku konwersjach bywa przypadkiem.
            </p>
            {withCpa.length ? (
              <NeonBars
                caption="CPA według kampanii"
                bars={withCpa.map((r) => ({
                  label: r.name,
                  value: r.kpis.cpa.ok ? r.kpis.cpa.value : 0,
                  display: r.kpis.cpa.ok ? money(r.kpis.cpa.value) : "N/D",
                  note: `${formatNumber(r.metrics.conversions ?? 0, (r.metrics.conversions ?? 0) % 1 ? 1 : 0)} konw.`,
                  color: color(rows.indexOf(r)),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Żadna kampania nie ma konwersji.
              </p>
            )}
            {noConversions.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                CPA: N/D (koszt bez konwersji) —{" "}
                {noConversions
                  .map((r) => `${r.name} (${money(r.metrics.cost ?? 0)})`)
                  .join(", ")}
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function BudgetShare({
  rows,
  color,
  money,
}: {
  rows: Extract<DashboardModel["campaigns"], { rows: unknown }>["rows"]
  color: (i: number) => string
  money: (v: number) => string
}) {
  const shares = rows
    .map((r, i) => ({ ...r, color: color(i) }))
    .filter((r) => (r.costShare ?? 0) > 0)
  if (!shares.length) return null
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">Udział w budżecie</h3>
      <div
        className="flex h-4 overflow-hidden rounded-full bg-[#1a202c]"
        aria-hidden="true"
      >
        {shares.map((r) => (
          <span
            key={r.key}
            className="h-full border-r-2 border-card last:border-0"
            style={{
              width: `${r.costShare! * 100}%`,
              background: r.color,
              boxShadow: `0 0 12px -2px ${r.color}`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {shares.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
              aria-hidden="true"
            />
            <span className="text-[#d6dbe5]">{r.name}</span>
            <span className="font-semibold tabular" style={{ color: r.color }}>
              {formatPercent(r.costShare! * 100, 0)}
            </span>
            <span className="text-muted-foreground tabular">
              {money(r.metrics.cost ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
