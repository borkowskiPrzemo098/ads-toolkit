"use client"

import { useMemo, useState } from "react"
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
import { runAudit } from "@/lib/auditor/audit"
import {
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

type AreaFilter = "all" | FindingArea
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

  const targets = useMemo(() => {
    const c = parseDecimal(cpa)
    const r = parseDecimal(roas)
    return { cpa: c && c > 0 ? c : null, roas: r && r > 0 ? r : null }
  }, [cpa, roas])
  const result = useMemo(() => runAudit(data, targets), [data, targets])
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            label="Obszar"
            value={area}
            onChange={setArea}
            options={[
              { value: "all", label: "Wszystko" },
              { value: "campaign", label: "Kampanie" },
              { value: "keyword", label: "Słowa kluczowe" },
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
    </div>
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
