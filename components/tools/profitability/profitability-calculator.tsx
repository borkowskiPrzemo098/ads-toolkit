"use client"

import { useMemo, useState } from "react"
import { Columns2, RotateCcw, X } from "lucide-react"
import { ProfitWaterfall } from "@/components/charts/profit-waterfall"
import { ExportButtons } from "@/components/export/export-buttons"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { MobileResultBar } from "@/components/layout/mobile-result-bar"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { analyzeProfitability } from "@/lib/calculations/profitability"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import { profitabilityCsvRows, profitabilityReport } from "@/lib/export/profitability"
import { profitabilityNotes } from "@/lib/export/profitability-text"
import { formatCurrency, type Currency } from "@/lib/formatting/number"
import {
  EMPTY_PROFITABILITY_FORM,
  validateProfitabilityForm,
  type ProfitabilityField,
  type ProfitabilityForm,
} from "@/lib/validators/profitability"
import { CampaignForm } from "./campaign-form"
import { ComparisonTable } from "./comparison-table"
import { KpiSummary } from "./kpi-summary"
import { MetricsTable } from "./metrics-table"

interface Campaign {
  name: string
  form: ProfitabilityForm
}

const DEFAULT_NAMES = ["Kampania A", "Kampania B"]
const INITIAL: Campaign[] = [{ name: DEFAULT_NAMES[0], form: EMPTY_PROFITABILITY_FORM }]
const FILE_BASE = "rentownosc-kampanii"
const RESULTS_ID = "wyniki"

export function ProfitabilityCalculator() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL)
  const [active, setActive] = useState(0)
  const [currency, setCurrency] = useState<Currency>("PLN")

  const comparing = campaigns.length === 2
  const analyses = useMemo(
    () =>
      campaigns.map((c, i) => {
        const validation = validateProfitabilityForm(c.form)
        return {
          name: c.name.trim() || DEFAULT_NAMES[i],
          validation,
          result: analyzeProfitability(validation.input),
        }
      }),
    [campaigns]
  )
  const current = analyses[active]
  const { result, validation } = current

  const hasData = analyses.some((a) =>
    Object.values(a.result).some((m) => typeof m === "object" && m?.ok)
  )

  const updateCampaign = (patch: Partial<Campaign>) =>
    setCampaigns((list) => list.map((c, i) => (i === active ? { ...c, ...patch } : c)))

  const setField = (field: ProfitabilityField, value: string) =>
    updateCampaign({ form: { ...campaigns[active].form, [field]: value } })

  const startComparison = () => {
    setCampaigns((list) => [
      list[0],
      { name: DEFAULT_NAMES[1], form: { ...list[0].form } },
    ])
    setActive(1)
  }

  const endComparison = () => {
    setCampaigns((list) => [list[0]])
    setActive(0)
  }

  const reset = () => {
    setCampaigns(INITIAL)
    setActive(0)
  }

  const exported = analyses.map(({ name, result }) => ({ name, result }))

  const exportCsv = () =>
    downloadCsv(
      toCsv(profitabilityCsvRows(exported, currency)),
      datedFilename(FILE_BASE, "csv")
    )

  const exportPdf = async () => {
    const { renderTableReport } = await import("@/lib/pdf/table-report")
    const blob = await renderTableReport(profitabilityReport(exported, currency))
    downloadBlob(blob, datedFilename(FILE_BASE, "pdf"))
  }

  const notes = profitabilityNotes(result, currency)
  const adSpend = validation.input.adSpend
  const chart =
    result.revenue.ok && result.costOfGoods.ok && result.netProfit.ok && adSpend !== null
      ? {
          revenue: result.revenue.value,
          costOfGoods: result.costOfGoods.value,
          adSpend,
          extraCosts: validation.input.extraCosts ?? 0,
          netProfit: result.netProfit.value,
        }
      : null

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG.profitability}
        actions={
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <SegmentedControl
              label="Waluta"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "PLN", label: "PLN" },
                { value: "EUR", label: "EUR" },
              ]}
            />
            <Button variant="ghost" onClick={reset} disabled={!hasData && !comparing}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons disabled={!hasData} onCsv={exportCsv} onPdf={exportPdf} />
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:gap-6">
        <Panel
          title="Dane kampanii"
          description={
            comparing
              ? "Przełączaj kampanie, aby edytować ich dane."
              : "Wpisz wyniki z Google Ads za wybrany okres."
          }
        >
          {comparing && (
            <SegmentedControl
              label="Edytowana kampania"
              className="mb-6 flex w-full [&>button]:flex-1 [&>button]:truncate"
              value={String(active)}
              onChange={(v) => setActive(Number(v))}
              options={analyses.map((a, i) => ({ value: String(i), label: a.name }))}
            />
          )}
          <CampaignForm
            key={active}
            name={campaigns[active].name}
            onNameChange={(name) => updateCampaign({ name })}
            form={campaigns[active].form}
            onFieldChange={setField}
            validation={validation}
            currency={currency}
          />
          <div className="mt-6 border-t border-border pt-5">
            {comparing ? (
              <Button variant="ghost" className="-ml-3" onClick={endComparison}>
                <X />
                Zakończ porównanie
              </Button>
            ) : (
              <>
                <Button variant="secondary" className="w-full" onClick={startComparison}>
                  <Columns2 />
                  Porównaj z drugą kampanią
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Druga kampania zaczyna jako kopia pierwszej, więc łatwo sprawdzisz
                  wariant „co jeśli”.
                </p>
              </>
            )}
          </div>
        </Panel>

        <div id={RESULTS_ID} className="flex min-w-0 scroll-mt-20 flex-col gap-5">
          {comparing && (
            <Panel
              title="Porównanie kampanii"
              description={`Różnica to ${analyses[1].name} minus ${analyses[0].name}. Zielony oznacza poprawę.`}
            >
              <ComparisonTable campaigns={exported} currency={currency} />
            </Panel>
          )}

          <section aria-label={`Wyniki: ${current.name}`} className="flex flex-col gap-4">
            {comparing && (
              <h2 className="text-base font-semibold tracking-tight">
                Wyniki: {current.name}
              </h2>
            )}
            <KpiSummary result={result} currency={currency} />
          </section>

          <Panel
            title="Od przychodu do zysku"
            description="Ile z przychodu zostaje po kolejnych kosztach."
          >
            {chart ? (
              <ProfitWaterfall {...chart} currency={currency} />
            ) : (
              <p className="grid h-40 place-items-center rounded-lg border border-dashed border-[#2f3848] px-6 text-center text-sm text-muted-foreground">
                Wykres pojawi się, gdy podasz koszt reklamy, przychód i marżę albo koszt
                produktu.
              </p>
            )}
          </Panel>

          <Panel title="Wszystkie wskaźniki">
            <MetricsTable result={result} currency={currency} />
          </Panel>

          <Panel title="Jak czytać wyniki">
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-[#c9cfdb] marker:text-muted-foreground">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              <li>
                ROAS mówi, ile przychodu daje złotówka reklamy. ROI mówi, ile zysku
                zostaje po wszystkich kosztach. Wysoki ROAS nie oznacza jeszcze zysku.
              </li>
              <li>
                Przełącznik PLN/EUR zmienia tylko symbol waluty. Kursów nie przeliczamy.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <MobileResultBar
        label="Zysk netto"
        value={
          result.netProfit.ok ? formatCurrency(result.netProfit.value, currency) : null
        }
        tone={
          result.status === "profit"
            ? "good"
            : result.status === "loss"
              ? "bad"
              : undefined
        }
        targetId={RESULTS_ID}
      />
    </>
  )
}
