"use client"

import { useMemo, useState } from "react"
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { blockingIssues } from "@/lib/auditor/import"
import { buildDataset } from "@/lib/auditor/join"
import { normalizeReport } from "@/lib/auditor/normalize"
import { formatNumber } from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import { AuditDashboard } from "./audit-dashboard"
import { DataCheck } from "./data-check"
import { ImportSummary } from "./import-summary"
import { ReportCard } from "./report-card"
import { ReportDropzone } from "./report-dropzone"
import { useAuditImport } from "./use-audit-import"

const tool = TOOL_BY_SLUG["campaign-auditor"]

type Step = "files" | "summary" | "confirmed" | "dashboard"
const STEPS: { id: Step; label: string }[] = [
  { id: "files", label: "Raporty i kolumny" },
  { id: "summary", label: "Podsumowanie" },
  { id: "confirmed", label: "Kontrola danych" },
  { id: "dashboard", label: "Dashboard" },
]

export function CampaignAuditor() {
  const audit = useAuditImport()
  const [step, setStepState] = useState<Step>("files")
  // Each step starts at the top, not where the button of the previous one was.
  const setStep = (next: Step) => {
    setStepState(next)
    window.scrollTo({ top: 0 })
  }
  const hasFiles = audit.files.length > 0
  // The normalised, joined layer is built once the user confirms the import.
  const confirmed = step === "confirmed" || step === "dashboard"
  const dataset = useMemo(
    () =>
      confirmed
        ? buildDataset(
            audit.ready.map((f) =>
              normalizeReport(f.id, f.name, f.table!, f.analysis!, f.skipDuplicates)
            )
          )
        : null,
    [confirmed, audit.ready]
  )
  const blocked = audit.files.filter(
    (f) =>
      f.status === "error" ||
      f.duplicateOf ||
      (f.analysis && blockingIssues(f.analysis).length > 0)
  ).length

  return (
    <>
      <ToolHeader
        tool={tool}
        actions={
          hasFiles && (
            <Button
              variant="ghost"
              onClick={() => {
                audit.clear()
                setStep("files")
              }}
            >
              <RotateCcw />
              Nowy audyt
            </Button>
          )
        }
      />

      <ol
        aria-label="Etapy audytu"
        className="mb-6 flex flex-wrap gap-x-2 gap-y-2 text-sm"
      >
        {STEPS.map((s, i) => {
          const current = STEPS.findIndex((x) => x.id === step)
          const state = i < current ? "done" : i === current ? "current" : "next"
          return (
            <li
              key={s.id}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                state === "current" &&
                  "border-[color-mix(in_oklab,var(--tool)_45%,transparent)] bg-[color-mix(in_oklab,var(--tool)_10%,transparent)] font-medium text-foreground",
                state === "done" && "border-border text-[#c9cfdb]",
                state === "next" && "border-border/60 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-xs font-semibold tabular",
                  state === "next" ? "bg-[#1a202c]" : "bg-(--tool) text-[#0b0d12]"
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </li>
          )
        })}
      </ol>

      {step === "files" && (
        <div className="flex flex-col gap-5">
          <ReportDropzone onFiles={audit.addFiles} compact={hasFiles} />
          {!hasFiles && (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              Pliki czytamy w Twojej przeglądarce. Nie trafiają na żaden serwer i znikają
              po zamknięciu karty. W Google Ads: Raporty → wybierz raport → Pobierz → CSV
              lub Excel.
            </p>
          )}
          {audit.files.map((file) => (
            <ReportCard
              key={file.id}
              file={file}
              onRemove={() => audit.removeFile(file.id)}
              onType={(type) => audit.setType(file.id, type)}
              onMapping={(mapping) => audit.setMapping(file.id, mapping)}
              onResetMapping={() => audit.resetMapping(file.id)}
              onSkipDuplicates={(skip) => audit.setSkipDuplicates(file.id, skip)}
            />
          ))}
          {hasFiles && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={!audit.canConfirm}
                onClick={() => setStep("summary")}
              >
                Przejdź do podsumowania
                <ArrowRight />
              </Button>
              {blocked > 0 && (
                <p className="text-sm text-muted-foreground">
                  {blocked === 1
                    ? "1 plik wymaga poprawy albo usunięcia."
                    : `${formatNumber(blocked)} pliki wymagają poprawy albo usunięcia.`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {step === "summary" && (
        <ImportSummary
          files={audit.ready}
          onBack={() => setStep("files")}
          onConfirm={() => setStep("confirmed")}
        />
      )}

      {step === "confirmed" && dataset && (
        <DataCheck
          data={dataset}
          onBack={() => setStep("files")}
          onNext={() => setStep("dashboard")}
        />
      )}
      {step === "dashboard" && dataset && <AuditDashboard data={dataset} />}
    </>
  )
}
