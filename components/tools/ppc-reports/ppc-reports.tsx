"use client"

import { useMemo, useState } from "react"
import { Info, RotateCcw } from "lucide-react"
import { ExportButtons } from "@/components/export/export-buttons"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { ppcCsvRows } from "@/lib/export/ppc-report"
import { summarize } from "@/lib/reports/aggregate"
import { formatPeriod } from "@/lib/reports/dates"
import { buildReportTexts, type ReportTexts } from "@/lib/reports/insights"
import type { ReportModel } from "@/lib/reports/model"
import { parseNumericForm } from "@/lib/validators/numeric-form"
import { EditableTexts } from "./editable-texts"
import { PeriodSource, type PeriodData } from "./period-source"
import { ReportPreview } from "./report-preview"
import { ReportSettingsFields, type SettingsForm } from "./report-settings"

const EMPTY_SETTINGS_FORM: SettingsForm = {
  clientName: "",
  campaignName: "",
  periodLabel: "",
  comparisonLabel: "",
  budget: "",
  agencyName: "",
  logo: null,
  currency: "PLN",
}

const FILE_BASE = "raport-google-ads"

const labelFor = (data: PeriodData) => {
  const range = summarize(data.rows).range
  return range ? formatPeriod(range.from, range.to) : ""
}

export function PpcReports() {
  const [current, setCurrent] = useState<PeriodData | null>(null)
  const [previous, setPrevious] = useState<PeriodData | null>(null)
  const [form, setForm] = useState<SettingsForm>(EMPTY_SETTINGS_FORM)
  // Texts the user edited, and the generated texts they started from.
  const [edited, setEdited] = useState<{
    texts: ReportTexts
    basis: ReportTexts | null
  } | null>(null)

  const budget = parseNumericForm({ budget: form.budget }, { budget: { greaterThan: 0 } })
  const budgetValue = budget.values.budget

  const currentSummary = useMemo(
    () => (current ? summarize(current.rows) : null),
    [current]
  )
  const previousSummary = useMemo(
    () => (previous ? summarize(previous.rows) : null),
    [previous]
  )

  const generated = useMemo(
    () =>
      currentSummary
        ? buildReportTexts(currentSummary, previousSummary, budgetValue, form.currency)
        : null,
    [currentSummary, previousSummary, budgetValue, form.currency]
  )
  const texts = edited?.texts ?? generated
  // Generated texts are recomputed whenever data, budget or currency change.
  const textsStale = edited !== null && edited.basis !== generated

  const model: ReportModel | null =
    currentSummary && texts
      ? {
          settings: {
            clientName: form.clientName.trim(),
            campaignName: form.campaignName.trim(),
            periodLabel: form.periodLabel.trim(),
            comparisonLabel: form.comparisonLabel.trim(),
            budget: budgetValue,
            agencyName: form.agencyName.trim(),
            logo: form.logo,
            currency: form.currency,
          },
          current: currentSummary,
          previous: previousSummary,
          texts,
        }
      : null

  const setPeriod = (which: "current" | "previous") => (data: PeriodData | null) => {
    if (which === "current") setCurrent(data)
    else setPrevious(data)
    // Fill the period label from the file's dates, unless the user already wrote one.
    const key = which === "current" ? "periodLabel" : "comparisonLabel"
    if (data && !form[key].trim()) setForm((f) => ({ ...f, [key]: labelFor(data) }))
  }

  const reset = () => {
    setCurrent(null)
    setPrevious(null)
    setForm(EMPTY_SETTINGS_FORM)
    setEdited(null)
  }

  const missing = [
    !form.clientName.trim() && "nazwę klienta",
    !form.periodLabel.trim() && "okres raportu",
  ].filter(Boolean)

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["ppc-reports"]}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <Button variant="ghost" onClick={reset} disabled={!current && !previous}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons
              disabled={!model}
              onCsv={() =>
                model &&
                downloadCsv(toCsv(ppcCsvRows(model)), datedFilename(FILE_BASE, "csv"))
              }
              onPdf={async () => {
                if (!model) return
                const { renderPpcReport } = await import("@/lib/pdf/ppc-report")
                downloadBlob(
                  await renderPpcReport(model),
                  datedFilename(FILE_BASE, "pdf")
                )
              }}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <p className="flex gap-3 rounded-xl border border-[#2f3848] bg-[#141925] px-4 py-3 text-sm leading-relaxed text-[#c9cfdb]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#a89dff]" aria-hidden="true" />
          Raport powstaje wyłącznie z danych, które wczytasz. Pliki nie opuszczają Twojego
          komputera, a teksty opisują liczby i sugerują, co sprawdzić. Nie zgadujemy
          przyczyn zmian.
        </p>

        <Panel
          title="1. Dane"
          description="Bieżący okres jest wymagany. Okres porównawczy pozwala pokazać zmiany."
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-label="Bieżący okres" className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Bieżący okres</h3>
              <PeriodSource
                data={current}
                onChange={setPeriod("current")}
                currency={form.currency}
                emptyHint="Wczytaj raport kampanii z Google Ads za okres, którego dotyczy raport."
              />
            </section>
            <section aria-label="Okres porównawczy" className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">
                Okres porównawczy{" "}
                <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
              </h3>
              <PeriodSource
                data={previous}
                onChange={setPeriod("previous")}
                currency={form.currency}
                emptyHint="Np. poprzedni miesiąc albo ten sam miesiąc rok temu."
              />
            </section>
          </div>
        </Panel>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Panel title="2. Ustawienia raportu">
            <ReportSettingsFields
              value={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              budgetError={budget.errors.budget ?? null}
              hasComparison={previous !== null}
            />
          </Panel>

          <Panel title="3. Treść raportu">
            {texts ? (
              <>
                {textsStale && (
                  <p className="mb-4 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-[#f7cf7c]">
                    Dane zmieniły się po edycji tekstów. Przywróć teksty z danych, aby je
                    przeliczyć.
                  </p>
                )}
                <EditableTexts
                  texts={texts}
                  onChange={(next) =>
                    setEdited({ texts: next, basis: edited?.basis ?? generated })
                  }
                  edited={edited !== null}
                  onRegenerate={() => setEdited(null)}
                />
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm text-muted-foreground">
                Teksty pojawią się po wczytaniu danych bieżącego okresu.
              </p>
            )}
          </Panel>
        </div>

        <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="preview-heading" className="text-lg font-semibold tracking-tight">
              Podgląd raportu
            </h2>
            {model && missing.length > 0 && (
              <p className="text-xs text-[#f7cf7c]">Uzupełnij {missing.join(" i ")}.</p>
            )}
          </div>
          {model ? (
            <ReportPreview model={model} />
          ) : (
            <p className="rounded-xl border border-dashed border-[#2f3848] px-4 py-12 text-center text-sm text-muted-foreground">
              Podgląd pojawi się po wczytaniu danych.
            </p>
          )}
        </section>
      </div>
    </>
  )
}
