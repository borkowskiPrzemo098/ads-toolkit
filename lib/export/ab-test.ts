import type { AbTestResult, Interval, VariantInput } from "@/lib/calculations/ab-test"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type Currency,
} from "@/lib/formatting/number"
import type { TableReport } from "@/lib/pdf/table-report"
import type { CsvCell } from "./csv"
import {
  abTestNotes,
  formatPValue,
  METHOD_NOTE,
  VERDICT_TITLE,
  verdictText,
} from "./ab-test-text"

export interface AbExport {
  names: { a: string; b: string }
  inputs: { a: VariantInput; b: VariantInput }
  result: AbTestResult
  currency: Currency
}

const value = (r: { ok: boolean; value?: number }) => (r.ok ? (r.value as number) : null)
const pp = (x: number) => `${formatNumber(x * 100, 2)} p.p.`
const interval = (i: Interval | null, scale = 100) =>
  i ? `${formatNumber(i.low * scale, 2)}–${formatNumber(i.high * scale, 2)}` : ""

export function abCsvRows({ names, inputs, result: r }: AbExport): CsvCell[][] {
  return [
    ["Wskaźnik", names.a, names.b],
    ["Wizyty lub kliknięcia", inputs.a.visitors, inputs.b.visitors],
    ["Konwersje", inputs.a.conversions, inputs.b.conversions],
    ["Koszt", inputs.a.cost, inputs.b.cost],
    ["Współczynnik konwersji (%)", value(r.a.rate), value(r.b.rate)],
    ["Przedział ufności 95% (%)", interval(r.a.rateInterval), interval(r.b.rateInterval)],
    ["CPA", value(r.a.cpa), value(r.b.cpa)],
    ["Koszt wizyty", value(r.a.costPerVisit), value(r.b.costPerVisit)],
    [],
    ["Różnica bezwzględna (p.p.)", r.absoluteDiff.ok ? r.absoluteDiff.value * 100 : null],
    ["Różnica względna (%)", value(r.relativeDiff)],
    ["Przedział ufności różnicy 95% (p.p.)", interval(r.diffInterval)],
    ["z", r.z],
    ["p", r.pValue],
    ["Werdykt", VERDICT_TITLE[r.verdict]],
    ["Wymagane wizyty na wariant (moc 80%)", r.requiredPerVariant],
  ]
}

export function abReport(data: AbExport): TableReport {
  const { names, inputs, result: r, currency } = data
  const missing = "Brak danych"
  const money = (x: number) => formatCurrency(x, currency)
  const fmt = (res: { ok: boolean; value?: number }, f: (n: number) => string) =>
    res.ok ? f(res.value as number) : missing

  const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date())
  return {
    title: "Wynik testu A/B",
    subtitle: `${names.a} i ${names.b} · ${date}`,
    summary: {
      tone:
        r.verdict === "significant"
          ? "positive"
          : r.verdict === "insufficient"
            ? "negative"
            : "neutral",
      text: `${VERDICT_TITLE[r.verdict]}. ${verdictText(r, names)}`,
    },
    tables: [
      {
        heading: "Warianty",
        columns: ["Wskaźnik", names.a, names.b],
        rows: [
          [
            "Wizyty lub kliknięcia",
            inputs.a.visitors === null ? missing : formatNumber(inputs.a.visitors),
            inputs.b.visitors === null ? missing : formatNumber(inputs.b.visitors),
          ],
          [
            "Konwersje",
            inputs.a.conversions === null ? missing : formatNumber(inputs.a.conversions),
            inputs.b.conversions === null ? missing : formatNumber(inputs.b.conversions),
          ],
          [
            "Współczynnik konwersji",
            fmt(r.a.rate, (x) => formatPercent(x, 2)),
            fmt(r.b.rate, (x) => formatPercent(x, 2)),
          ],
          [
            "Przedział ufności 95%",
            r.a.rateInterval ? `${interval(r.a.rateInterval)}%` : missing,
            r.b.rateInterval ? `${interval(r.b.rateInterval)}%` : missing,
          ],
          ["CPA", fmt(r.a.cpa, money), fmt(r.b.cpa, money)],
        ],
      },
      {
        heading: "Porównanie",
        columns: ["Miara", "Wartość"],
        rows: [
          ["Różnica bezwzględna", fmt(r.absoluteDiff, pp)],
          ["Różnica względna", fmt(r.relativeDiff, (x) => formatPercent(x, 1))],
          [
            "Przedział ufności różnicy 95%",
            r.diffInterval ? `${interval(r.diffInterval)} p.p.` : missing,
          ],
          ["Istotność", r.pValue === null ? missing : formatPValue(r.pValue)],
          [
            "Wizyty na wariant do potwierdzenia",
            r.requiredPerVariant === null ? "—" : formatNumber(r.requiredPerVariant),
          ],
        ],
      },
    ],
    notes: [...abTestNotes(r), METHOD_NOTE],
  }
}
