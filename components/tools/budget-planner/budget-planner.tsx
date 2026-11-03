"use client"

import { useMemo, useState } from "react"
import { BookmarkPlus, Info, RotateCcw } from "lucide-react"
import { ProfitCurveChart } from "@/components/charts/lazy"
import { ExportButtons } from "@/components/export/export-buttons"
import { NumberField } from "@/components/forms/number-field"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { KpiTile } from "@/components/layout/kpi-tile"
import { MobileResultBar } from "@/components/layout/mobile-result-bar"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { BUDGET_FIELDS, SCENARIOS } from "@/constants/budget-planner"
import { TOOL_BY_SLUG } from "@/constants/tools"
import {
  budgetRange,
  DEFAULT_SCENARIOS,
  forecastBudget,
  optimalBudget,
  simulateBudgets,
  type ScenarioId,
  type SimulationPoint,
} from "@/lib/calculations/budget-planner"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import {
  budgetCsvRows,
  budgetReport,
  type SavedVariant,
} from "@/lib/export/budget-planner"
import {
  budgetPlannerNotes,
  DAILY_BUDGET_NOTE,
  FORECAST_DISCLAIMER,
} from "@/lib/export/budget-planner-text"
import {
  CURRENCY_SUFFIX,
  formatCurrency,
  formatNumber,
  formatPercent,
  parseDecimal,
  type Currency,
} from "@/lib/formatting/number"
import {
  EMPTY_BUDGET_FORM,
  scenarioToForm,
  validateBudgetForm,
  validateScenarioForm,
  type BudgetField,
  type ScenarioField,
  type ScenarioForm,
} from "@/lib/validators/budget-planner"
import { ScenarioTable } from "./scenario-table"
import { VariantsTable } from "./variants-table"

const SCENARIO_IDS = SCENARIOS.map((s) => s.id)
const INITIAL_SCENARIO_FORMS = Object.fromEntries(
  SCENARIO_IDS.map((id) => [id, scenarioToForm(DEFAULT_SCENARIOS[id])])
) as Record<ScenarioId, ScenarioForm>

/** Assumed CPC rise when the budget doubles. Editable next to the chart. */
const DEFAULT_CPC_GROWTH = "10"
const MAX_VARIANTS = 6
const FILE_BASE = "plan-budzetu"
const RESULTS_ID = "prognoza"

const mapScenarios = <T,>(fn: (id: ScenarioId) => T) =>
  Object.fromEntries(SCENARIO_IDS.map((id) => [id, fn(id)])) as Record<ScenarioId, T>

export function BudgetPlanner() {
  const [form, setForm] = useState(EMPTY_BUDGET_FORM)
  const [scenarioForms, setScenarioForms] = useState(INITIAL_SCENARIO_FORMS)
  const [cpcGrowth, setCpcGrowth] = useState(DEFAULT_CPC_GROWTH)
  const [currency, setCurrency] = useState<Currency>("PLN")
  const [variants, setVariants] = useState<SavedVariant[]>([])
  const [variantCounter, setVariantCounter] = useState(1)

  const { input, errors } = useMemo(() => validateBudgetForm(form), [form])
  const scenarios = useMemo(
    () => mapScenarios((id) => validateScenarioForm(scenarioForms[id])),
    [scenarioForms]
  )
  const forecasts = useMemo(
    () => mapScenarios((id) => forecastBudget(input, scenarios[id].adjustment)),
    [input, scenarios]
  )

  const growthValue = parseDecimal(cpcGrowth)
  const growthError =
    cpcGrowth.trim() === ""
      ? "Wpisz 0, jeśli zakładasz stały CPC."
      : growthValue === null || growthValue < 0 || growthValue > 200
        ? "Wpisz wartość od 0 do 200%."
        : null
  const growth = growthError ? 0 : growthValue!

  const optimum = useMemo(
    () => optimalBudget(input, scenarios.realistic.adjustment, growth),
    [input, scenarios, growth]
  )

  const simulation = useMemo(() => {
    if (input.budget === null || input.budget <= 0) return null
    // Stretch the range to show the optimum, but never past 10× the plan.
    const reach =
      optimum?.kind === "optimum"
        ? Math.min(Math.max(3, (optimum.budget / input.budget) * 1.25), 10)
        : 3
    const range = budgetRange(input.budget, 40, 0.1, reach)
    const series = mapScenarios((id) =>
      simulateBudgets(input, scenarios[id].adjustment, growth, range)
    )
    if (SCENARIO_IDS.some((id) => series[id] === null)) return null
    return series as Record<ScenarioId, SimulationPoint[]>
  }, [input, scenarios, growth, optimum])
  const notes = budgetPlannerNotes(forecasts, optimum, growth, currency)

  const realistic = forecasts.realistic
  const hasForecast = realistic.clicks.ok
  const money = (v: number) => formatCurrency(v, currency)

  const setField = (field: BudgetField, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const setScenarioField = (id: ScenarioId, field: ScenarioField, value: string) =>
    setScenarioForms((all) => ({ ...all, [id]: { ...all[id], [field]: value } }))

  const reset = () => {
    setForm(EMPTY_BUDGET_FORM)
    setScenarioForms(INITIAL_SCENARIO_FORMS)
    setCpcGrowth(DEFAULT_CPC_GROWTH)
    setVariants([])
  }

  const saveVariant = () => {
    const parts = [
      input.budget !== null && formatCurrency(input.budget, currency, 0),
      input.cpc !== null && `CPC ${formatCurrency(input.cpc, currency)}`,
    ].filter(Boolean)
    setVariants((list) =>
      [
        ...list,
        {
          id: String(variantCounter),
          name: `${variantCounter}. ${parts.join(", ")}`,
          input,
          forecast: realistic,
        },
      ].slice(-MAX_VARIANTS)
    )
    setVariantCounter((n) => n + 1)
  }

  const restoreVariant = (variant: SavedVariant) => {
    const text = (v: number | null) => (v === null ? "" : String(v).replace(".", ","))
    setForm({
      budget: text(variant.input.budget),
      cpc: text(variant.input.cpc),
      conversionRatePercent: text(variant.input.conversionRatePercent),
      avgOrderValue: text(variant.input.avgOrderValue),
      marginPercent: text(variant.input.marginPercent),
      days: text(variant.input.days),
    })
  }

  const exportData = () => ({
    input,
    scenarios: mapScenarios((id) => scenarios[id].adjustment),
    forecasts,
    variants,
    notes: [FORECAST_DISCLAIMER, ...notes, DAILY_BUDGET_NOTE],
    currency,
  })

  const exportCsv = () =>
    downloadCsv(toCsv(budgetCsvRows(exportData())), datedFilename(FILE_BASE, "csv"))

  const exportPdf = async () => {
    const { renderTableReport } = await import("@/lib/pdf/table-report")
    downloadBlob(
      await renderTableReport(budgetReport(exportData())),
      datedFilename(FILE_BASE, "pdf")
    )
  }

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["budget-planner"]}
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
            <Button variant="ghost" onClick={reset}>
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons disabled={!hasForecast} onCsv={exportCsv} onPdf={exportPdf} />
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:gap-6">
        <Panel
          title="Twoje założenia"
          description="Średnie z poprzednich kampanii albo z planera słów kluczowych."
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {BUDGET_FIELDS.map((field) => (
              <NumberField
                key={field.key}
                className={field.hint ? "col-span-2" : undefined}
                label={field.label}
                value={form[field.key]}
                onChange={(value) => setField(field.key, value)}
                placeholder={field.placeholder}
                suffix={
                  field.unit === "currency"
                    ? CURRENCY_SUFFIX[currency]
                    : (field.unit ?? undefined)
                }
                hint={field.hint}
                error={errors[field.key]}
              />
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <Button
              variant="secondary"
              className="w-full"
              onClick={saveVariant}
              disabled={!hasForecast}
            >
              <BookmarkPlus />
              Zapisz jako wariant
            </Button>
          </div>
        </Panel>

        <div id={RESULTS_ID} className="flex min-w-0 scroll-mt-20 flex-col gap-5">
          <p className="flex gap-3 rounded-xl border border-[#2f3848] bg-[#141925] px-4 py-3 text-sm leading-relaxed text-[#c9cfdb]">
            <Info className="mt-0.5 size-4 shrink-0 text-[#a89dff]" aria-hidden="true" />
            {FORECAST_DISCLAIMER}
          </p>

          <section
            aria-label="Prognoza w scenariuszu realistycznym"
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiTile
                label="Zysk po reklamie"
                result={realistic.profit}
                format={money}
                tone={
                  realistic.profit.ok
                    ? realistic.profit.value >= 0
                      ? "good"
                      : "bad"
                    : undefined
                }
                detail="marża minus budżet"
              />
              <KpiTile label="Przychód" result={realistic.revenue} format={money} />
              <KpiTile
                label="Konwersje"
                result={realistic.conversions}
                format={(v) => formatNumber(v, 1)}
                detail={
                  realistic.cpa.ok ? `CPA ${money(realistic.cpa.value)}` : undefined
                }
              />
              <KpiTile
                label="ROAS"
                result={realistic.roas}
                format={(v) => formatPercent(v, 0)}
                detail={
                  realistic.clicks.ok
                    ? `${formatNumber(Math.round(realistic.clicks.value))} kliknięć`
                    : undefined
                }
              />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <BudgetSplit
                label="Budżet dzienny"
                value={
                  realistic.dailyBudget.ok ? money(realistic.dailyBudget.value) : null
                }
              />
              <BudgetSplit
                label="Budżet tygodniowy"
                value={
                  realistic.weeklyBudget.ok ? money(realistic.weeklyBudget.value) : null
                }
              />
              <BudgetSplit
                label="Maksymalny opłacalny CPC"
                value={
                  realistic.breakEvenCpc.ok ? money(realistic.breakEvenCpc.value) : null
                }
              />
            </dl>
          </section>

          <Panel
            title="Trzy scenariusze"
            description="Zmień procenty, aby sprawdzić, co się stanie, gdy CPC, konwersja albo koszyk wypadną inaczej."
          >
            <ScenarioTable
              forms={scenarioForms}
              errors={mapScenarios((id) => scenarios[id].errors)}
              onChange={setScenarioField}
              forecasts={forecasts}
              currency={currency}
            />
          </Panel>

          <Panel
            title="Zysk przy innym budżecie"
            description="Od 10% do co najmniej 300% Twojego budżetu, dla każdego scenariusza."
          >
            <NumberField
              className="mb-5 max-w-xs"
              label="Wzrost CPC po podwojeniu budżetu"
              suffix="%"
              value={cpcGrowth}
              onChange={setCpcGrowth}
              error={growthError}
              hint="Założenie: większy budżet kupuje droższe kliknięcia. 0% oznacza stały CPC."
            />
            {simulation ? (
              <ProfitCurveChart
                scenarios={SCENARIOS}
                series={simulation}
                currentBudget={input.budget!}
                optimum={optimum?.kind === "optimum" ? optimum : undefined}
                currency={currency}
              />
            ) : (
              <p className="grid h-40 place-items-center rounded-lg border border-dashed border-[#2f3848] px-6 text-center text-sm text-muted-foreground">
                Wykres pojawi się, gdy podasz budżet, CPC, współczynnik konwersji, średnią
                wartość zamówienia i marżę.
              </p>
            )}
          </Panel>

          <Panel
            title="Porównanie wariantów"
            description="Scenariusz realistyczny z CPC, który wpiszesz. Przy większym budżecie podnieś CPC sam: wariant nie stosuje założenia z wykresu."
          >
            <VariantsTable
              variants={variants}
              currency={currency}
              onRestore={restoreVariant}
              onRemove={(id) => setVariants((list) => list.filter((v) => v.id !== id))}
            />
          </Panel>

          <Panel title="Jak czytać prognozę">
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-[#c9cfdb] marker:text-muted-foreground">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              <li>
                Zysk po reklamie to przychód × marża minus budżet. Nie obejmuje kosztów
                stałych firmy.
              </li>
              <li>{DAILY_BUDGET_NOTE}</li>
              <li>
                Przełącznik PLN/EUR zmienia tylko symbol waluty. Kursów nie przeliczamy.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <MobileResultBar
        label="Prognozowany zysk"
        value={realistic.profit.ok ? money(realistic.profit.value) : null}
        tone={
          realistic.profit.ok ? (realistic.profit.value >= 0 ? "good" : "bad") : undefined
        }
        targetId={RESULTS_ID}
      />
    </>
  )
}

function BudgetSplit({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          value ? "mt-0.5 font-semibold tabular" : "mt-0.5 font-semibold text-[#4a5466]"
        }
      >
        {value ?? "—"}
      </dd>
    </div>
  )
}
