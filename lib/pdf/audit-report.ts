import type { jsPDF } from "jspdf"
import { STATUS_LABEL, type Task, type TaskStatus } from "@/lib/auditor/action-plan"
import type { AuditResult } from "@/lib/auditor/audit"
import { REPORT_TYPES } from "@/lib/auditor/detect"
import { AREA_LABEL, SEVERITY_LABEL, type Finding } from "@/lib/auditor/findings"
import { formatMoney } from "@/lib/auditor/format"
import type { AuditDataset } from "@/lib/auditor/join"
import { kpisOf } from "@/lib/auditor/metrics"
import type { ProfitModel } from "@/lib/auditor/profitability"
import type { Segment } from "@/lib/auditor/rules/segments"
import { METHOD_NOTES } from "@/lib/auditor/thresholds"
import { formatNumber, formatPercent } from "@/lib/formatting/number"
import { formatPeriod } from "@/lib/reports/dates"
import type { ReportLogo } from "@/lib/reports/model"
import type { CalcResult } from "@/types/calculation"
import {
  ACCENT,
  addFooters,
  createDocument,
  FONT,
  INK,
  PAGE,
  TONE,
  type Rgb,
} from "./document"

/*
 * Audit report PDF (spec section 10): fourteen sections in a fixed order. A section without
 * data is left out, and the user can hide any section. Text only from the audit model:
 * nothing is added that the analysis did not find.
 */

export type SectionId =
  | "summary"
  | "kpis"
  | "index"
  | "campaigns"
  | "keywords"
  | "searchTerms"
  | "devices"
  | "locations"
  | "schedule"
  | "problems"
  | "recommendations"
  | "plan"
  | "scope"

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "summary", label: "Podsumowanie audytu" },
  { id: "kpis", label: "Najważniejsze KPI" },
  { id: "index", label: "Ocena efektywności konta" },
  { id: "campaigns", label: "Analiza kampanii" },
  { id: "keywords", label: "Analiza słów kluczowych" },
  { id: "searchTerms", label: "Analiza wyszukiwanych haseł" },
  { id: "devices", label: "Analiza urządzeń" },
  { id: "locations", label: "Analiza lokalizacji" },
  { id: "schedule", label: "Analiza godzin i dni" },
  { id: "problems", label: "Najważniejsze wykryte problemy" },
  { id: "recommendations", label: "Rekomendacje optymalizacyjne" },
  { id: "plan", label: "Plan działań" },
  { id: "scope", label: "Zakres i ograniczenia audytu" },
]

export interface AuditReportInput {
  client: string
  account: string
  logo: ReportLogo | null
  hidden: SectionId[]
  data: AuditDataset
  result: AuditResult
  tasks: Task[]
  statuses: Record<string, TaskStatus>
  profit: ProfitModel | null
  generatedAt: Date
}

/** Sections that have data for this audit. */
export function availableSections(
  i: Pick<AuditReportInput, "data" | "result" | "tasks">
): SectionId[] {
  const { data, result, tasks } = i
  const has: Record<SectionId, boolean> = {
    summary: true,
    kpis: !!data.primary,
    index: result.index.assessed > 0,
    campaigns: data.campaigns.some((c) => c.primary),
    keywords: data.reports.some((r) => r.type === "keyword"),
    searchTerms: !!result.searchTerms,
    devices: !!result.devices,
    locations: !!result.locations,
    schedule: !!result.schedule,
    problems: result.findings.some((f) => f.kind === "problem"),
    recommendations: result.findings.length > 0,
    plan: tasks.length > 0,
    scope: true,
  }
  return SECTIONS.map((s) => s.id).filter((id) => has[id])
}

const W = PAGE.width - PAGE.margin * 2
const BOTTOM = PAGE.height - PAGE.margin - 8

interface Col {
  label: string
  width: number
  align?: "left" | "right"
}

class Writer {
  y = PAGE.margin
  constructor(public doc: jsPDF) {}

  font(weight: "normal" | "bold", size: number, color: Rgb = INK.text) {
    this.doc
      .setFont(FONT, weight)
      .setFontSize(size)
      .setTextColor(...color)
    return this
  }
  ensure(h: number) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage()
      this.y = PAGE.margin
    }
  }
  section(title: string) {
    this.ensure(60)
    if (this.y > PAGE.margin) this.y += 6
    this.doc.setFillColor(...ACCENT).rect(PAGE.margin, this.y, 10, 1.2, "F")
    this.y += 7
    this.font("bold", 15)
    this.doc.text(title, PAGE.margin, this.y)
    this.y += 8
  }
  sub(title: string) {
    this.ensure(18)
    this.font("bold", 11)
    this.doc.text(title, PAGE.margin, this.y)
    this.y += 6
  }
  para(text: string, size = 9.5, color: Rgb = INK.text, indent = 0) {
    this.font("normal", size, color)
    const lines = this.doc.splitTextToSize(text, W - indent)
    const lh = size * 0.47
    for (const line of lines) {
      this.ensure(lh)
      this.doc.text(line, PAGE.margin + indent, this.y)
      this.y += lh
    }
    this.y += 1.5
  }
  table(cols: Col[], rows: string[][]) {
    const total = cols.reduce((s, c) => s + c.width, 0)
    const widths = cols.map((c) => (c.width / total) * W)
    const xs = widths.map(
      (_, i) => PAGE.margin + widths.slice(0, i).reduce((a, b) => a + b, 0)
    )
    const header = () => {
      this.font("normal", 7.5, INK.muted)
      cols.forEach((c, i) =>
        this.doc.text(
          c.label,
          c.align === "right" ? xs[i] + widths[i] - 4 : xs[i],
          this.y,
          { align: c.align === "right" ? "right" : "left" }
        )
      )
      this.y += 2
      this.doc
        .setDrawColor(...INK.line)
        .setLineWidth(0.2)
        .line(PAGE.margin, this.y, PAGE.margin + W, this.y)
      this.y += 4.2
    }
    this.ensure(16)
    header()
    for (const row of rows) {
      this.font("normal", 8.5)
      const cells = row.map(
        (cell, i) => this.doc.splitTextToSize(cell, widths[i] - 2) as string[]
      )
      const h = Math.max(...cells.map((c) => c.length)) * 3.9 + 2
      if (this.y + h > BOTTOM) {
        this.doc.addPage()
        this.y = PAGE.margin
        header()
        this.font("normal", 8.5)
      }
      cells.forEach((lines, i) =>
        this.doc.text(
          lines,
          cols[i].align === "right" ? xs[i] + widths[i] - 4 : xs[i],
          this.y,
          { align: cols[i].align === "right" ? "right" : "left" }
        )
      )
      this.y += h - 2
      this.doc
        .setDrawColor(...INK.line)
        .line(PAGE.margin, this.y, PAGE.margin + W, this.y)
      this.y += 4.2
    }
    this.y += 3
  }
  /** Finding block: title, severity, situation, evidence and action. */
  finding(f: Finding) {
    this.ensure(30)
    this.font("bold", 10)
    const title = this.doc.splitTextToSize(`${f.title}: ${f.subject}`, W - 40)
    this.doc.text(title, PAGE.margin, this.y)
    const tone =
      f.kind === "opportunity"
        ? TONE.positive
        : f.severity === "high" || f.severity === "critical"
          ? TONE.negative
          : INK.muted
    this.font("normal", 8, tone)
    this.doc.text(
      `${SEVERITY_LABEL[f.severity]} · pewność ${f.confidence === "high" ? "wysoka" : f.confidence === "medium" ? "średnia" : "niska"}`,
      PAGE.margin + W,
      this.y,
      { align: "right" }
    )
    this.y += title.length * 4.6 + 1
    this.para(f.situation, 9)
    this.para(f.evidence.map((e) => `${e.label}: ${e.value}`).join(" · "), 8.5, INK.muted)
    this.para(`Działanie: ${f.action}`, 9)
    if (f.impact) this.para(f.impact, 8.5, INK.muted)
    this.y += 2
  }
}

const show = (r: CalcResult, f: (v: number) => string) => (r.ok ? f(r.value) : "N/D")

export async function renderAuditReport(input: AuditReportInput): Promise<Blob> {
  const doc = await createDocument()
  const w = new Writer(doc)
  const { data, result } = input
  const money = (v: number) => formatMoney(v, data.currency)
  const shown = new Set(availableSections(input).filter((s) => !input.hidden.includes(s)))
  const period = data.period ? formatPeriod(data.period.from, data.period.to) : null
  const byArea = (area: Finding["area"]) => result.findings.filter((f) => f.area === area)

  // 1. Title page.
  let y = PAGE.margin
  if (input.logo) {
    const { width, height } = input.logo
    const scale = Math.min(48 / width, 18 / height)
    doc.addImage(
      input.logo.dataUrl,
      input.logo.format,
      PAGE.margin,
      y,
      width * scale,
      height * scale
    )
  }
  doc.setFillColor(...ACCENT).rect(PAGE.margin, 92, 14, 1.6, "F")
  y = 104
  w.font("normal", 11, INK.muted)
  doc.text("Audyt kampanii Google Ads", PAGE.margin, y)
  y += 13
  w.font("bold", 28)
  const client = doc.splitTextToSize(input.client || "Audyt konta", W)
  doc.text(client, PAGE.margin, y)
  y += client.length * 11 + 2
  w.font("normal", 11, INK.muted)
  for (const line of [
    input.account && `Konto: ${input.account}`,
    period && `Okres analizy: ${period}`,
    `Data wygenerowania: ${input.generatedAt.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}`,
  ].filter(Boolean) as string[]) {
    doc.text(line, PAGE.margin, y)
    y += 6
  }
  doc.addPage()

  // 2. Summary.
  if (shown.has("summary")) {
    w.section("Podsumowanie audytu")
    const count = (p: (f: Finding) => boolean) => result.findings.filter(p).length
    w.para(
      `Audyt objął ${data.reports.length} ${data.reports.length === 1 ? "raport" : "raporty"}. Wykryto ${count((f) => f.kind === "problem")} problemów (w tym ${count((f) => f.kind === "problem" && (f.severity === "high" || f.severity === "critical"))} o wysokiej ważności) i ${count((f) => f.kind === "opportunity")} możliwości.`
    )
    if (result.index.overall !== null)
      w.para(
        `Indeks efektywności kampanii: ${result.index.overall}/100 (ocenione obszary: ${result.index.assessed} z ${result.index.areas.length}). To wskaźnik tej analizy, a nie ocena Google.`
      )
    const top = result.findings.filter((f) => f.kind === "problem").slice(0, 3)
    if (top.length) {
      w.sub("Najważniejsze sprawy")
      for (const f of top) w.para(`• ${f.title}: ${f.subject}`, 9.5)
    }
  }

  // 3. KPIs.
  if (shown.has("kpis")) {
    w.section("Najważniejsze KPI")
    const t = data.totals
    const k = kpisOf(t)
    const val = (v: number | null, f: (x: number) => string) =>
      v === null ? "N/D" : f(v)
    w.table(
      [
        { label: "Wskaźnik", width: 3 },
        { label: "Wartość", width: 2, align: "right" },
        { label: "Wzór", width: 3 },
      ],
      [
        ["Koszt", val(t.cost, money), ""],
        ["Kliknięcia", val(t.clicks, (v) => formatNumber(v)), ""],
        ["Wyświetlenia", val(t.impressions, (v) => formatNumber(v)), ""],
        ["CTR", show(k.ctr, (v) => formatPercent(v, 2)), "kliknięcia ÷ wyświetlenia"],
        ["Śr. CPC", show(k.cpc, money), "koszt ÷ kliknięcia"],
        ["Konwersje", val(t.conversions, (v) => formatNumber(v, v % 1 ? 1 : 0)), ""],
        [
          "Współczynnik konwersji",
          show(k.conversionRate, (v) => formatPercent(v, 2)),
          "konwersje ÷ kliknięcia",
        ],
        ["CPA", show(k.cpa, money), "koszt ÷ konwersje"],
        ["Wartość konwersji", val(t.conversionValue, money), ""],
        [
          "ROAS",
          show(k.roas, (v) => formatPercent(v, 0)),
          "wartość ÷ koszt (to nie zysk)",
        ],
      ]
    )
    if (data.primary)
      w.para(
        `Źródło: ${data.primary.name}. Raporty szczegółowe nie są dodawane do sum.`,
        8.5,
        INK.muted
      )
    if (input.profit?.ready) {
      w.sub("Rentowność (szacunek na podstawie wpisanych założeń)")
      w.table(
        [
          { label: "Pozycja", width: 4 },
          { label: "Wartość", width: 2, align: "right" },
          { label: "Źródło", width: 2 },
        ],
        input.profit.lines.map((l) => [
          l.label,
          show(
            l.value,
            l.kind === "money"
              ? money
              : l.kind === "percent"
                ? (v) => formatPercent(v, 1)
                : (v) => formatNumber(v)
          ),
          l.origin === "google"
            ? "Google Ads"
            : l.origin === "manual"
              ? "Wpisane"
              : "Szacunek",
        ])
      )
    }
  }

  // 4. Index.
  if (shown.has("index")) {
    w.section("Ocena efektywności konta")
    w.para(
      `Indeks efektywności kampanii: ${result.index.overall}/100. Każdy obszar: 100 × (1 − udział kosztu w elementach z wykrytymi problemami); obszary bez danych nie są oceniane. Nie jest to ocena Google.`
    )
    w.table(
      [
        { label: "Obszar", width: 3 },
        { label: "Wynik", width: 1, align: "right" },
        { label: "Podstawa", width: 6 },
      ],
      result.index.areas.map((a) => [
        a.label,
        a.score === null ? "—" : String(a.score),
        a.basis,
      ])
    )
  }

  // 5. Campaigns.
  if (shown.has("campaigns")) {
    w.section("Analiza kampanii")
    w.table(
      [
        { label: "Kampania", width: 4 },
        { label: "Koszt", width: 2, align: "right" },
        { label: "Konw.", width: 1.2, align: "right" },
        { label: "CPA", width: 1.8, align: "right" },
        { label: "ROAS", width: 1.4, align: "right" },
      ],
      data.campaigns
        .filter((c) => c.primary)
        .map((c) => {
          const k = kpisOf(c.primary!)
          return [
            c.name,
            money(c.primary!.cost ?? 0),
            formatNumber(
              c.primary!.conversions ?? 0,
              (c.primary!.conversions ?? 0) % 1 ? 1 : 0
            ),
            show(k.cpa, money),
            show(k.roas, (v) => formatPercent(v, 0)),
          ]
        })
    )
    for (const f of byArea("campaign")) w.finding(f)
  }

  if (shown.has("keywords")) {
    w.section("Analiza słów kluczowych")
    const list = byArea("keyword")
    if (!list.length)
      w.para(
        "Reguły nie wykryły problemów ani możliwości w słowach kluczowych.",
        9.5,
        INK.muted
      )
    for (const f of list) w.finding(f)
  }

  if (shown.has("searchTerms") && result.searchTerms) {
    w.section("Analiza wyszukiwanych haseł")
    w.para(
      `Przeanalizowano ${formatNumber(result.searchTerms.rows.length)} haseł z raportu „${result.searchTerms.report.name}”. Intencja jest oceniana heurystycznie (słowniki i reguły), nie jest pewną oceną semantyczną. Wykluczenia sugerujemy dopiero od ${result.searchTerms.minClicks} kliknięć bez konwersji.`,
      9,
      INK.muted
    )
    for (const f of byArea("searchTerm")) w.finding(f)
  }

  const segmentTable = (segments: Segment[], label: string) =>
    w.table(
      [
        { label, width: 3 },
        { label: "Koszt", width: 2, align: "right" },
        { label: "Udział", width: 1.2, align: "right" },
        { label: "Konw.", width: 1.2, align: "right" },
        { label: "CPA", width: 1.8, align: "right" },
        { label: "ROAS", width: 1.4, align: "right" },
      ],
      segments.map((s) => [
        s.thin ? `${s.label} (mało danych)` : s.label,
        money(s.metrics.cost ?? 0),
        formatPercent(s.costShare * 100, 0),
        formatNumber(
          s.metrics.conversions ?? 0,
          (s.metrics.conversions ?? 0) % 1 ? 1 : 0
        ),
        show(s.kpis.cpa, money),
        show(s.kpis.roas, (v) => formatPercent(v, 0)),
      ])
    )

  if (shown.has("devices") && result.devices) {
    w.section("Analiza urządzeń")
    segmentTable(result.devices.segments, "Urządzenie")
    for (const f of byArea("device")) w.finding(f)
  }
  if (shown.has("locations") && result.locations) {
    w.section("Analiza lokalizacji")
    segmentTable(result.locations.segments.slice(0, 25), "Lokalizacja")
    for (const f of byArea("location")) w.finding(f)
  }
  if (shown.has("schedule") && result.schedule) {
    w.section("Analiza godzin i dni")
    if (result.schedule.days.length) segmentTable(result.schedule.days, "Dzień tygodnia")
    for (const n of result.schedule.result.notes) w.para(n, 9, INK.muted)
    for (const f of byArea("schedule")) w.finding(f)
  }

  if (shown.has("problems")) {
    w.section("Najważniejsze wykryte problemy")
    const problems = result.findings.filter((f) => f.kind === "problem").slice(0, 10)
    w.table(
      [
        { label: "Problem", width: 5 },
        { label: "Obszar", width: 2 },
        { label: "Ważność", width: 1.5 },
        { label: "Koszt", width: 1.8, align: "right" },
      ],
      problems.map((f) => [
        `${f.title}: ${f.subject}`,
        AREA_LABEL[f.area],
        SEVERITY_LABEL[f.severity],
        money(f.cost),
      ])
    )
  }

  if (shown.has("recommendations")) {
    w.section("Rekomendacje optymalizacyjne")
    for (const g of result.recommendations) {
      w.sub(g.label)
      for (const r of g.items) {
        w.ensure(24)
        w.font("bold", 9.5)
        const lines = doc.splitTextToSize(`${r.priority} · ${r.problem}`, W)
        doc.text(lines, PAGE.margin, w.y)
        w.y += lines.length * 4.4 + 0.5
        w.para(
          `Dowód: ${r.evidence.map((e) => `${e.label} ${e.value}`).join("; ")}`,
          8.5,
          INK.muted
        )
        w.para(`Interpretacja: ${r.interpretation}`, 9)
        w.para(`Działanie: ${r.action} (pewność: ${r.confidenceLabel.toLowerCase()})`, 9)
        w.y += 1.5
      }
    }
  }

  if (shown.has("plan")) {
    w.section("Plan działań")
    w.table(
      [
        { label: "Priorytet", width: 1.4 },
        { label: "Zadanie", width: 4 },
        { label: "Uzasadnienie", width: 4 },
        { label: "Status", width: 1.6 },
      ],
      input.tasks.map((t) => [
        t.priority,
        `${t.title}. ${t.description}`,
        t.justification,
        STATUS_LABEL[input.statuses[t.id] ?? "todo"],
      ])
    )
    w.para(
      "Aplikacja nie wprowadza zmian na koncie Google Ads; zadania wykonuje się ręcznie.",
      8.5,
      INK.muted
    )
  }

  if (shown.has("scope")) {
    w.section("Zakres i ograniczenia audytu")
    w.sub("Zaimportowane raporty")
    w.table(
      [
        { label: "Plik", width: 4 },
        { label: "Typ", width: 2.5 },
        { label: "Okres", width: 3.5 },
        { label: "Rekordy", width: 1.4, align: "right" },
      ],
      data.reports.map((r) => [
        r.name,
        REPORT_TYPES[r.type].label,
        r.period ? formatPeriod(r.period.from, r.period.to) : "brak dat",
        formatNumber(r.records.length),
      ])
    )
    const missing = result.index.areas.filter((a) => a.score === null)
    if (missing.length) {
      w.sub("Czego audyt nie obejmuje")
      for (const a of missing) w.para(`• ${a.label}: ${a.basis}`, 9)
    }
    if (result.notes.length) {
      w.sub("Uwagi do danych")
      for (const n of result.notes) w.para(`• ${n}`, 9)
    }
    w.sub("Metoda")
    for (const n of METHOD_NOTES) w.para(`• ${n}`, 8.5, INK.muted)
    w.para(
      "Wnioski wynikają wyłącznie z zaimportowanych danych. Przyczyny są opisane jako możliwe, nie jako pewne. Szacunki nie są prognozą.",
      9
    )
  }

  addFooters(
    doc,
    `Audyt kampanii Google Ads${input.client ? ` · ${input.client}` : ""} · przygotowano w Ads Toolkit, dane przetworzone lokalnie`
  )
  return doc.output("blob")
}
