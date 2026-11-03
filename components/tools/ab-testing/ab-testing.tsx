"use client"

import { useMemo, useState } from "react"
import { CircleDashed, FlaskConical, Hourglass, Equal, RotateCcw } from "lucide-react"
import { DifferenceInterval, RateIntervals } from "@/components/charts/interval-chart"
import { ExportButtons } from "@/components/export/export-buttons"
import { SegmentedControl } from "@/components/forms/segmented-control"
import { KpiTile } from "@/components/layout/kpi-tile"
import { Panel } from "@/components/layout/panel"
import { ToolHeader } from "@/components/layout/tool-header"
import { Button } from "@/components/ui/button"
import { TOOL_BY_SLUG } from "@/constants/tools"
import { analyzeAbTest, type Verdict } from "@/lib/calculations/ab-test"
import { abCsvRows, abReport } from "@/lib/export/ab-test"
import {
  abTestNotes,
  formatPValue,
  METHOD_NOTE,
  VERDICT_TITLE,
  verdictText,
} from "@/lib/export/ab-test-text"
import { toCsv } from "@/lib/export/csv"
import { datedFilename, downloadBlob, downloadCsv } from "@/lib/export/download"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Currency,
} from "@/lib/formatting/number"
import { cn } from "@/lib/utils"
import {
  EMPTY_VARIANT_FORM,
  validateVariantForm,
  type VariantField,
  type VariantForm,
} from "@/lib/validators/ab-test"
import { VariantCard } from "./variant-card"

// A cyan, B orange (the tool hue): far apart in hue and lightness, readable for colour-blind users.
const COLORS = { a: "#36d6ff", b: "#ff8a3d" }
const DEFAULT_NAMES = { a: "Wariant A", b: "Wariant B" }
const FILE_BASE = "test-ab"

const VERDICT_STYLE: Record<Verdict, { box: string; icon: typeof FlaskConical }> = {
  significant: {
    box: "border-primary/50 bg-primary/12 text-[#d4ceff]",
    icon: FlaskConical,
  },
  "keep-testing": {
    box: "border-warning/35 bg-warning/10 text-[#f7cf7c]",
    icon: Hourglass,
  },
  "not-significant": { box: "border-[#3a4456] bg-[#141925] text-[#c9cfdb]", icon: Equal },
  insufficient: {
    box: "border-dashed border-[#3a4456] bg-transparent text-muted-foreground",
    icon: CircleDashed,
  },
}

export function AbTesting() {
  const [forms, setForms] = useState({ a: EMPTY_VARIANT_FORM, b: EMPTY_VARIANT_FORM })
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [currency, setCurrency] = useState<Currency>("PLN")

  const a = useMemo(() => validateVariantForm(forms.a), [forms.a])
  const b = useMemo(() => validateVariantForm(forms.b), [forms.b])
  const result = useMemo(() => analyzeAbTest(a.input, b.input), [a.input, b.input])
  const shownNames = {
    a: names.a.trim() || DEFAULT_NAMES.a,
    b: names.b.trim() || DEFAULT_NAMES.b,
  }

  const setField = (key: "a" | "b") => (field: VariantField, value: string) =>
    setForms((f) => ({ ...f, [key]: { ...f[key], [field]: value } as VariantForm }))

  const touched =
    Object.values(forms.a).some(Boolean) || Object.values(forms.b).some(Boolean)
  const exportData = () => ({
    names: shownNames,
    inputs: { a: a.input, b: b.input },
    result,
    currency,
  })

  const style = VERDICT_STYLE[result.verdict]
  const VerdictIcon = style.icon
  const money = (x: number) => formatCurrency(x, currency)

  return (
    <>
      <ToolHeader
        tool={TOOL_BY_SLUG["ab-testing"]}
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
            <Button
              variant="ghost"
              onClick={() => {
                setForms({ a: EMPTY_VARIANT_FORM, b: EMPTY_VARIANT_FORM })
                setNames(DEFAULT_NAMES)
              }}
              disabled={!touched}
            >
              <RotateCcw />
              Wyczyść
            </Button>
            <ExportButtons
              disabled={!result.a.rate.ok && !result.b.rate.ok}
              onCsv={() =>
                downloadCsv(
                  toCsv(abCsvRows(exportData())),
                  datedFilename(FILE_BASE, "csv")
                )
              }
              onPdf={async () => {
                const { renderTableReport } = await import("@/lib/pdf/table-report")
                downloadBlob(
                  await renderTableReport(abReport(exportData())),
                  datedFilename(FILE_BASE, "pdf")
                )
              }}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <VariantCard
            letter="A"
            color={COLORS.a}
            name={names.a}
            onNameChange={(name) => setNames((n) => ({ ...n, a: name }))}
            form={forms.a}
            onFieldChange={setField("a")}
            errors={a.errors}
            currency={currency}
          />
          <VariantCard
            letter="B"
            color={COLORS.b}
            name={names.b}
            onNameChange={(name) => setNames((n) => ({ ...n, b: name }))}
            form={forms.b}
            onFieldChange={setField("b")}
            errors={b.errors}
            currency={currency}
          />
        </div>

        <section
          aria-live="polite"
          className={cn("flex gap-3.5 rounded-xl border px-5 py-4", style.box)}
        >
          <VerdictIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold">
              {touched ? VERDICT_TITLE[result.verdict] : "Wpisz dane obu wariantów"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed">
              {touched
                ? verdictText(result, shownNames)
                : "Liczba wizyt (albo kliknięć) i konwersji dla A i B wystarczy, by policzyć istotność."}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label={`Konwersja: ${shownNames.a}`}
            result={result.a.rate}
            format={(x) => formatPercent(x, 2)}
          />
          <KpiTile
            label={`Konwersja: ${shownNames.b}`}
            result={result.b.rate}
            format={(x) => formatPercent(x, 2)}
          />
          <KpiTile
            label="Różnica bezwzględna"
            result={result.absoluteDiff}
            format={(x) => `${x > 0 ? "+" : ""}${formatNumber(x * 100, 2)} p.p.`}
            detail="punkty procentowe, B − A"
          />
          <KpiTile
            label="Różnica względna"
            result={result.relativeDiff}
            format={(x) => `${x > 0 ? "+" : ""}${formatPercent(x, 1)}`}
            detail={result.pValue === null ? undefined : formatPValue(result.pValue)}
          />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel
            title="Przedziały ufności 95%"
            description="Zakres, w którym prawdopodobnie leży prawdziwy współczynnik."
          >
            {result.a.rateInterval && result.b.rateInterval ? (
              <div className="flex flex-col gap-7">
                <RateIntervals
                  rows={[
                    {
                      label: shownNames.a,
                      value: result.a.rate.ok ? result.a.rate.value / 100 : 0,
                      interval: result.a.rateInterval,
                      color: COLORS.a,
                    },
                    {
                      label: shownNames.b,
                      value: result.b.rate.ok ? result.b.rate.value / 100 : 0,
                      interval: result.b.rateInterval,
                      color: COLORS.b,
                    },
                  ]}
                />
                {result.diffInterval && result.absoluteDiff.ok && (
                  <DifferenceInterval
                    label={`Różnica (${shownNames.b} − ${shownNames.a})`}
                    diff={result.absoluteDiff.value}
                    interval={result.diffInterval}
                  />
                )}
              </div>
            ) : (
              <p className="grid h-32 place-items-center rounded-lg border border-dashed border-[#2f3848] px-6 text-center text-sm text-muted-foreground">
                Wykres pojawi się po wpisaniu wizyt i konwersji.
              </p>
            )}
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title="Koszt konwersji">
              <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 gap-y-3 text-sm">
                <dt className="text-xs text-muted-foreground">Miara</dt>
                <dd className="text-right text-xs text-muted-foreground">
                  {shownNames.a}
                </dd>
                <dd className="text-right text-xs text-muted-foreground">
                  {shownNames.b}
                </dd>
                <dt>CPA</dt>
                <dd className="text-right font-medium tabular">
                  {result.a.cpa.ok ? money(result.a.cpa.value) : "—"}
                </dd>
                <dd className="text-right font-medium tabular">
                  {result.b.cpa.ok ? money(result.b.cpa.value) : "—"}
                </dd>
                <dt>Koszt wizyty</dt>
                <dd className="text-right tabular">
                  {result.a.costPerVisit.ok ? money(result.a.costPerVisit.value) : "—"}
                </dd>
                <dd className="text-right tabular">
                  {result.b.costPerVisit.ok ? money(result.b.costPerVisit.value) : "—"}
                </dd>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {result.a.cpa.ok && result.b.cpa.ok
                  ? "Różnicy CPA nie testujemy statystycznie. Traktuj ją jako informację, nie dowód."
                  : "Podaj koszt obu wariantów, aby porównać CPA."}
              </p>
            </Panel>

            <Panel title="Planowanie testu">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Wizyty na wariant, by potwierdzić obecną różnicę
                  </dt>
                  <dd className="font-semibold tabular">
                    {result.requiredPerVariant === null
                      ? "—"
                      : formatNumber(result.requiredPerVariant)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Najmniejsza zmiana wykrywalna przy obecnej próbie
                  </dt>
                  <dd className="font-semibold tabular">
                    {result.minimumDetectableRelative === null
                      ? "—"
                      : `±${formatPercent(result.minimumDetectableRelative, 0)}`}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Obie wartości zakładają moc testu 80% i poziom istotności 0,05.
              </p>
            </Panel>
          </div>
        </div>

        <Panel title="Jak czytać wynik">
          <ul className="flex list-disc flex-col gap-2.5 pl-5 text-sm leading-relaxed text-[#c9cfdb] marker:text-muted-foreground">
            {abTestNotes(result).map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>{METHOD_NOTE}</li>
            <li>
              Konwersje liczymy jako wizyty, które skończyły się konwersją. Jeśli jedna
              osoba może konwertować kilka razy, wpisz liczbę konwertujących wizyt.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  )
}
