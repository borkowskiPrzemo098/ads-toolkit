"use client"

import { useDeferredValue, useMemo, useState } from "react"
import {
  ChevronDown,
  Lightbulb,
  SearchCheck,
  Target,
  TriangleAlert,
  Info,
} from "lucide-react"
import { NumberField } from "@/components/forms/number-field"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { Panel } from "@/components/layout/panel"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/forms/select-field"
import { runAudit } from "@/lib/auditor/audit"
import { intentContext } from "@/lib/auditor/intent"
import type { Decisions } from "@/lib/auditor/term-decisions"
import {
  AREA_LABEL,
  CONFIDENCE_LABEL,
  SEVERITY_LABEL,
  type Finding,
  type FindingArea,
  type Severity,
} from "@/lib/auditor/findings"
import type { AuditDataset } from "@/lib/auditor/join"
import { METHOD_NOTES } from "@/lib/auditor/thresholds"
import { formatNumber, parseDecimal } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import { comparisonOptions } from "@/lib/auditor/periods"
import { profitModel } from "@/lib/auditor/profitability"
import { buildActionPlan, type TaskStatus } from "@/lib/auditor/action-plan"
import { formatMoney } from "@/lib/auditor/format"
import { ActionPlanPanel } from "./action-plan-panel"
import { EfficiencyIndexPanel } from "./efficiency-index-panel"
import { ReportPanel } from "./report-panel"
import { PeriodsPanel } from "./periods-panel"
import { ProfitabilityPanel, type ProfitForm } from "./profitability-panel"
import { RecommendationsPanel } from "./recommendations-panel"
import { SearchTermsPanel, type IntentInputs } from "./search-terms-panel"
import { SchedulePanel, SegmentPanel } from "./segment-panel"

type AreaFilter = "all" | FindingArea
type Tab =
  | "recommendations"
  | "index"
  | "findings"
  | "searchTerms"
  | "devices"
  | "locations"
  | "schedule"
  | "profit"
  | "periods"
  | "plan"
  | "report"
type KindFilter = "all" | "problem" | "opportunity" | "data"

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-destructive text-[#0b0d12]",
  high: "bg-[#ff4f8b]/18 text-[#ff8db3] ring-[#ff4f8b]/40",
  medium: "bg-warning/15 text-warning ring-warning/35",
  low: "bg-[#36d6ff]/12 text-[#7fe3fb] ring-[#36d6ff]/30",
  info: "bg-[#1a202c] text-[#c9cfdb] ring-border",
}

const KIND_ICON = { problem: TriangleAlert, opportunity: Lightbulb, data: Info } as const

/** Step 5: findings of the rule engine, each with evidence, cause, action and its source. */
export function AuditFindings({ data }: { data: AuditDataset }) {
  const [cpa, setCpa] = useState("")
  const [roas, setRoas] = useState("")
  const [area, setArea] = useState<AreaFilter>("all")
  const [kind, setKind] = useState<KindFilter>("all")
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [methodOpen, setMethodOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("recommendations")
  const [inputs, setInputs] = useState<IntentInputs>({
    offer: "",
    brands: "",
    competitors: "",
  })
  const [decisions, setDecisions] = useState<Decisions>({})
  // Typing stays responsive: the audit reruns on the deferred values, after a pause.
  const deferredInputs = useDeferredValue(inputs)
  const intent = useMemo(
    () =>
      intentContext(
        deferredInputs.offer,
        deferredInputs.brands,
        deferredInputs.competitors
      ),
    [deferredInputs]
  )
  const deferredCpa = useDeferredValue(cpa)
  const deferredRoas = useDeferredValue(roas)

  const targets = useMemo(() => {
    const c = parseDecimal(deferredCpa)
    const r = parseDecimal(deferredRoas)
    return { cpa: c && c > 0 ? c : null, roas: r && r > 0 ? r : null }
  }, [deferredCpa, deferredRoas])
  const result = useMemo(() => runAudit(data, targets, intent), [data, targets, intent])
  const [profitForm, setProfitForm] = useState<ProfitForm>({
    aov: "",
    marginPct: "",
    productCost: "",
    shippingCost: "",
    otherCost: "",
    targetProfit: "",
  })
  const profit = useMemo(() => {
    const n = (v: string) => {
      const x = parseDecimal(v)
      return x !== null && x >= 0 ? x : null
    }
    return profitModel(data, {
      aov: n(profitForm.aov),
      marginPct: n(profitForm.marginPct),
      productCost: n(profitForm.productCost),
      shippingCost: n(profitForm.shippingCost),
      otherCost: n(profitForm.otherCost),
      targetProfit: n(profitForm.targetProfit),
    })
  }, [data, profitForm])
  const periodsAvailable = useMemo(() => comparisonOptions(data).length > 0, [data])
  const tasks = useMemo(
    () => buildActionPlan(result.findings, (v) => formatMoney(v, data.currency)),
    [result.findings, data.currency]
  )
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({})
  const areas = [...new Set(result.findings.map((f) => f.area))]
  const tabs: { id: Tab; label: string }[] = [
    { id: "recommendations", label: "Rekomendacje" },
    { id: "index", label: "Indeks efektywności" },
    { id: "findings", label: "Wykrycia" },
    ...(result.searchTerms
      ? [{ id: "searchTerms" as const, label: "Wyszukiwane hasła" }]
      : []),
    ...(result.devices ? [{ id: "devices" as const, label: "Urządzenia" }] : []),
    ...(result.locations ? [{ id: "locations" as const, label: "Lokalizacje" }] : []),
    ...(result.schedule ? [{ id: "schedule" as const, label: "Godziny i dni" }] : []),
    { id: "profit", label: "Rentowność" },
    ...(periodsAvailable
      ? [{ id: "periods" as const, label: "Porównanie okresów" }]
      : []),
    { id: "plan", label: "Plan działań" },
    { id: "report", label: "Raport PDF i CSV" },
  ]
  const areaFindings = (a: FindingArea) => result.findings.filter((f) => f.area === a)
  const shown = result.findings.filter(
    (f) => (area === "all" || f.area === area) && (kind === "all" || f.kind === kind)
  )
  const count = (pred: (f: Finding) => boolean) => result.findings.filter(pred).length

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            [
              "Problemy wysokie",
              count(
                (f) =>
                  f.kind === "problem" &&
                  (f.severity === "high" || f.severity === "critical")
              ),
              "#ff4f8b",
            ],
            [
              "Pozostałe problemy",
              count(
                (f) =>
                  f.kind === "problem" &&
                  f.severity !== "high" &&
                  f.severity !== "critical"
              ),
              "#ffc23d",
            ],
            ["Możliwości", count((f) => f.kind === "opportunity"), "#2ef2a0"],
            ["Informacje o danych", count((f) => f.kind === "data"), "#36d6ff"],
          ] as const
        ).map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card px-4 py-3.5"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className="mt-1 text-2xl font-semibold tracking-tight tabular neon-text"
              style={{ color }}
            >
              {formatNumber(value)}
            </dd>
          </div>
        ))}
      </dl>

      {tabs.length > 1 && (
        <div>
          <div
            role="tablist"
            aria-label="Widok audytu"
            className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-9 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                  tab === t.id
                    ? "bg-[color-mix(in_oklab,var(--tool)_14%,transparent)] text-foreground ring-1 ring-[color-mix(in_oklab,var(--tool)_40%,transparent)] ring-inset"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "recommendations" && (
        <RecommendationsPanel groups={result.recommendations} />
      )}
      {tab === "index" && <EfficiencyIndexPanel index={result.index} />}
      {tab === "profit" && (
        <ProfitabilityPanel
          model={profit}
          form={profitForm}
          onForm={setProfitForm}
          currency={data.currency}
          hasValue={(data.totals.conversionValue ?? 0) > 0}
        />
      )}
      {tab === "periods" && <PeriodsPanel data={data} />}
      {tab === "plan" && (
        <ActionPlanPanel
          tasks={tasks}
          statuses={statuses}
          onStatus={(id, status) => setStatuses((s) => ({ ...s, [id]: status }))}
        />
      )}
      {tab === "report" && (
        <ReportPanel
          data={data}
          result={result}
          tasks={tasks}
          statuses={statuses}
          profit={profit}
        />
      )}

      {tab === "searchTerms" && result.searchTerms && (
        <>
          <SearchTermsPanel
            analysis={result.searchTerms}
            currency={data.currency}
            inputs={inputs}
            onInputs={setInputs}
            decisions={decisions}
            onDecisions={setDecisions}
          />
          <AreaFindings findings={areaFindings("searchTerm")} />
        </>
      )}
      {tab === "devices" && result.devices && (
        <>
          <SegmentPanel
            analysis={result.devices}
            label="Urządzenie"
            currency={data.currency}
          />
          <AreaFindings findings={areaFindings("device")} />
        </>
      )}
      {tab === "locations" && result.locations && (
        <>
          <SegmentPanel
            analysis={result.locations}
            label="Lokalizacja"
            currency={data.currency}
          />
          <AreaFindings findings={areaFindings("location")} />
        </>
      )}
      {tab === "schedule" && result.schedule && (
        <>
          <SchedulePanel analysis={result.schedule} currency={data.currency} />
          {result.schedule.result.notes.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
          <AreaFindings findings={areaFindings("schedule")} />
        </>
      )}

      {tab === "findings" && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <SelectField
                label="Obszar"
                value={area}
                onChange={setArea}
                className="w-full sm:w-56"
                options={[
                  { value: "all", label: "Wszystkie obszary" },
                  ...areas.map((a) => ({ value: a, label: AREA_LABEL[a] })),
                ]}
              />
              {/* Four options do not fit a 320px phone: the control scrolls sideways there. */}
              <div className="max-w-full overflow-x-auto">
                <SegmentedControl
                  label="Rodzaj"
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "all", label: "Wszystkie" },
                    { value: "problem", label: "Problemy" },
                    { value: "opportunity", label: "Możliwości" },
                    { value: "data", label: "Dane" },
                  ]}
                />
              </div>
              <Button
                variant="outline"
                aria-expanded={targetsOpen}
                onClick={() => setTargetsOpen(!targetsOpen)}
              >
                <Target />
                {targets.cpa || targets.roas ? "Cele: ustawione" : "Cele (opcjonalnie)"}
                <ChevronDown
                  className={cn(
                    "transition-transform duration-150",
                    targetsOpen && "rotate-180"
                  )}
                />
              </Button>
            </div>
            {targetsOpen && (
              <div className="grid max-w-xl grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
                <NumberField
                  label="Docelowy CPA"
                  value={cpa}
                  onChange={setCpa}
                  optional
                  hint="Zastępuje średni CPA konta w regułach."
                />
                <NumberField
                  label="Docelowy ROAS"
                  value={roas}
                  onChange={setRoas}
                  suffix="%"
                  optional
                  hint="Np. 400 = 400%. Zastępuje ROAS konta."
                />
              </div>
            )}
          </div>

          {result.notes.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {result.notes.map((n) => (
                <li key={n} className="flex items-start gap-2">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          )}

          {shown.length === 0 ? (
            <Panel>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <SearchCheck className="size-4 text-success" aria-hidden="true" />
                Brak wykryć w tym zakresie.
              </p>
            </Panel>
          ) : (
            <ol aria-label="Wyniki audytu" className="flex flex-col gap-4">
              {shown.map((f) => (
                <li key={f.id}>
                  <FindingCard finding={f} />
                </li>
              ))}
            </ol>
          )}

          <div>
            <Button
              variant="ghost"
              aria-expanded={methodOpen}
              onClick={() => setMethodOpen(!methodOpen)}
            >
              <ChevronDown
                className={cn(
                  "transition-transform duration-150",
                  methodOpen && "rotate-180"
                )}
              />
              Jak liczymy
            </Button>
            {methodOpen && (
              <ul className="mt-2 flex max-w-3xl list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground">
                {METHOD_NOTES.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AreaFindings({ findings }: { findings: Finding[] }) {
  if (!findings.length) return null
  return (
    <ol aria-label="Wykrycia w tym obszarze" className="flex flex-col gap-4">
      {findings.map((f) => (
        <li key={f.id}>
          <FindingCard finding={f} />
        </li>
      ))}
    </ol>
  )
}

function FindingCard({ finding: f }: { finding: Finding }) {
  const Icon = KIND_ICON[f.kind]
  return (
    <article
      aria-label={`${f.title}: ${f.subject}`}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card",
        "before:absolute before:inset-x-0 before:top-0 before:h-0.5",
        f.kind === "problem" &&
          (f.severity === "high" || f.severity === "critical") &&
          "before:bg-[#ff4f8b] before:shadow-[0_0_12px_#ff4f8b]",
        f.kind === "problem" && f.severity === "medium" && "before:bg-warning",
        f.kind === "opportunity" &&
          "before:bg-success before:shadow-[0_0_12px_var(--success)]"
      )}
    >
      <header className="flex flex-col gap-2 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon
            className={cn(
              "mt-0.5 size-5 shrink-0",
              f.kind === "problem"
                ? "text-[#ff8db3]"
                : f.kind === "opportunity"
                  ? "text-success"
                  : "text-[#7fe3fb]"
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-0.5 text-sm [overflow-wrap:anywhere] text-[#d6dbe5]">
              {f.subject}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 pl-8 sm:pl-0">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-transparent ring-inset",
              SEVERITY_STYLE[f.severity]
            )}
          >
            Ważność: {SEVERITY_LABEL[f.severity]}
          </span>
          <span className="rounded-md bg-[#1a202c] px-2 py-0.5 text-xs text-[#c9cfdb] ring-1 ring-border ring-inset">
            Pewność: {CONFIDENCE_LABEL[f.confidence]}
          </span>
        </div>
      </header>
      <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
        <p className="text-sm leading-relaxed">{f.situation}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-background/50 p-3 text-sm sm:grid-cols-2">
          {f.evidence.map((e) => (
            <div
              key={e.label}
              className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3"
            >
              <dt className="[overflow-wrap:anywhere] text-muted-foreground">
                {e.label}
              </dt>
              <dd className="font-medium tabular sm:text-right">{e.value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 gap-4 text-sm leading-relaxed md:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
              Możliwa przyczyna
            </h4>
            <p>{f.cause}</p>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold text-(--tool)">
              Rekomendowane działanie
            </h4>
            <p>{f.action}</p>
          </div>
        </div>
        {f.impact && (
          <p className="rounded-lg border border-[color-mix(in_oklab,var(--tool)_30%,transparent)] bg-[color-mix(in_oklab,var(--tool)_6%,transparent)] px-3 py-2 text-sm">
            {f.impact}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Źródło: {f.source.report} · {f.source.dimension}
          {f.source.period && ` · ${f.source.period}`} · {f.source.method}
        </p>
      </div>
    </article>
  )
}
