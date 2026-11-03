import type { jsPDF } from "jspdf"
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatting/number"
import { changeTone, formatChange, formatKpi } from "@/lib/reports/format"
import {
  CHART_TITLE,
  chartSeries,
  kpiLines,
  type ChartMetric,
  type ReportModel,
} from "@/lib/reports/model"
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

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2
const BOTTOM = PAGE.height - PAGE.margin - 8

/** Client-facing PDF: cover, KPIs, four charts, texts and the campaign table. */
export async function renderPpcReport(model: ReportModel): Promise<Blob> {
  const doc = await createDocument()
  const { settings } = model
  let y = PAGE.margin

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage()
      y = PAGE.margin
    }
  }
  const font = (weight: "normal" | "bold", size: number, color: Rgb = INK.text) =>
    doc
      .setFont(FONT, weight)
      .setFontSize(size)
      .setTextColor(...color)

  // Cover
  if (settings.logo) {
    const { width, height } = settings.logo
    const scale = Math.min(48 / width, 18 / height)
    doc.addImage(
      settings.logo.dataUrl,
      settings.logo.format,
      PAGE.margin,
      y,
      width * scale,
      height * scale
    )
    y += height * scale + 10
  } else if (settings.agencyName) {
    font("bold", 12)
    doc.text(settings.agencyName, PAGE.margin, y + 5)
    y += 14
  }
  doc.setFillColor(...ACCENT).rect(PAGE.margin, 92, 14, 1.6, "F")
  y = 104
  font("normal", 11, INK.muted)
  doc.text("Raport kampanii Google Ads", PAGE.margin, y)
  y += 13
  font("bold", 28)
  const clientLines = doc.splitTextToSize(settings.clientName || "Raport", CONTENT_WIDTH)
  doc.text(clientLines, PAGE.margin, y)
  y += clientLines.length * 11 + 2
  if (settings.campaignName) {
    font("normal", 13)
    doc.text(settings.campaignName, PAGE.margin, y)
    y += 9
  }
  font("normal", 11, INK.muted)
  if (settings.periodLabel) {
    doc.text(`Okres: ${settings.periodLabel}`, PAGE.margin, y)
    y += 6
  }
  if (model.previous && settings.comparisonLabel) {
    doc.text(`Porównanie z: ${settings.comparisonLabel}`, PAGE.margin, y)
    y += 6
  }
  if (settings.agencyName && settings.logo) {
    doc.text(`Przygotowane przez: ${settings.agencyName}`, PAGE.margin, y)
    y += 6
  }
  y += 10
  font("bold", 12)
  doc.text("Podsumowanie", PAGE.margin, y)
  y += 6
  font("normal", 10.5, INK.text)
  const summaryLines = doc.splitTextToSize(model.texts.summary, CONTENT_WIDTH)
  doc.text(summaryLines, PAGE.margin, y)

  // KPIs
  doc.addPage()
  y = PAGE.margin
  heading(doc, "Kluczowe wskaźniki", y)
  y += 8
  const lines = kpiLines(model)
  const cols = 3
  const gap = 4
  const tileW = (CONTENT_WIDTH - gap * (cols - 1)) / cols
  const tileH = 22
  lines.forEach((line, i) => {
    const x = PAGE.margin + (i % cols) * (tileW + gap)
    const ty = y + Math.floor(i / cols) * (tileH + gap)
    doc.setFillColor(...INK.soft).roundedRect(x, ty, tileW, tileH, 2, 2, "F")
    font("normal", 8, INK.muted)
    doc.text(line.label, x + 4, ty + 6)
    font("bold", 13)
    doc.text(formatKpi(line, line.value!, settings.currency), x + 4, ty + 13.5)
    if (line.change !== null) {
      const tone = changeTone(line)
      font(
        "normal",
        8,
        tone === "good" ? TONE.positive : tone === "bad" ? TONE.negative : INK.muted
      )
      doc.text(`${formatChange(line.change)} vs poprzedni okres`, x + 4, ty + 19)
    }
  })
  y += Math.ceil(lines.length / cols) * (tileH + gap) + 6

  // Charts
  const metrics: ChartMetric[] = ["cost", "clicks", "conversions", "roas"]
  const charts = metrics
    .map((m) => ({ metric: m, series: chartSeries(model, m) }))
    .filter((c) => c.series)
  if (charts.length) {
    ensureSpace(80)
    heading(doc, "Wykresy", y)
    y += 8
    const chartW = (CONTENT_WIDTH - gap) / 2
    const chartH = 58
    charts.forEach((chart, i) => {
      if (i % 2 === 0) ensureSpace(chartH + 6)
      const x = PAGE.margin + (i % 2) * (chartW + gap)
      drawBarChart(
        doc,
        x,
        y,
        chartW,
        chartH,
        CHART_TITLE[chart.metric],
        chart.series!,
        (v) =>
          chart.metric === "cost"
            ? formatCurrency(v, settings.currency, 0)
            : chart.metric === "roas"
              ? formatPercent(v, 0)
              : formatNumber(v)
      )
      if (i % 2 === 1 || i === charts.length - 1) y += chartH + 6
    })
  }

  // Texts
  const section = (title: string, items: string[]) => {
    const clean = items.map((s) => s.trim()).filter(Boolean)
    if (!clean.length) return
    ensureSpace(20)
    heading(doc, title, y)
    y += 7
    font("normal", 10, INK.text)
    for (const item of clean) {
      const wrapped = doc.splitTextToSize(item, CONTENT_WIDTH - 6)
      ensureSpace(wrapped.length * 4.6 + 2)
      doc.setFillColor(...ACCENT).circle(PAGE.margin + 1.2, y - 1.2, 0.8, "F")
      doc.text(wrapped, PAGE.margin + 5, y)
      y += wrapped.length * 4.6 + 2.2
    }
    y += 5
  }
  doc.addPage()
  y = PAGE.margin
  section("Najważniejsze obserwacje", model.texts.observations)
  section("Wnioski", model.texts.conclusions)
  section("Rekomendacje na kolejny okres", model.texts.recommendations)

  // Campaign table
  const campaigns = model.current.campaigns
  if (campaigns && campaigns.length > 1) {
    ensureSpace(30)
    heading(doc, "Kampanie", y)
    y += 7
    const columns = ["Kampania", "Koszt", "Kliknięcia", "Konwersje", "CPA", "ROAS"]
    const widths = [64, 24, 22, 22, 22, 24]
    const rowAt = (cells: string[], bold = false, color: Rgb = INK.text) => {
      font(bold ? "bold" : "normal", 8.5, color)
      let x = PAGE.margin
      cells.forEach((cell, i) => {
        if (i === 0) doc.text(doc.splitTextToSize(cell, widths[0] - 2)[0], x, y)
        else doc.text(cell, x + widths[i], y, { align: "right" })
        x += widths[i]
      })
      y += 3
      doc
        .setDrawColor(...INK.line)
        .setLineWidth(0.2)
        .line(PAGE.margin, y, PAGE.margin + CONTENT_WIDTH, y)
      y += 4.2
    }
    rowAt(columns, false, INK.muted)
    for (const c of campaigns) {
      ensureSpace(8)
      rowAt([
        c.key,
        c.totals.cost === null ? "—" : formatCurrency(c.totals.cost, settings.currency),
        c.totals.clicks === null ? "—" : formatNumber(c.totals.clicks),
        c.totals.conversions === null
          ? "—"
          : formatNumber(c.totals.conversions, c.totals.conversions % 1 ? 1 : 0),
        c.kpis.cpa.ok ? formatCurrency(c.kpis.cpa.value, settings.currency) : "—",
        c.kpis.roas.ok ? formatPercent(c.kpis.roas.value, 0) : "—",
      ])
    }
  }

  addFooters(
    doc,
    `${settings.clientName || "Raport"} · ${settings.periodLabel || ""} · dane z Google Ads, obliczenia lokalne`
  )
  return doc.output("blob")
}

function heading(doc: jsPDF, text: string, y: number) {
  doc
    .setFont(FONT, "bold")
    .setFontSize(13)
    .setTextColor(...INK.text)
  doc.text(text, PAGE.margin, y)
}

/** Simple bar chart drawn with vector shapes; null values leave a gap. */
function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  series: { labels: string[]; values: (number | null)[] },
  format: (v: number) => string
) {
  doc.setFillColor(...INK.soft).roundedRect(x, y, w, h, 2, 2, "F")
  doc
    .setFont(FONT, "bold")
    .setFontSize(9)
    .setTextColor(...INK.text)
  doc.text(title, x + 4, y + 6)
  const max = Math.max(...series.values.map((v) => v ?? 0), 0)
  doc
    .setFont(FONT, "normal")
    .setFontSize(7)
    .setTextColor(...INK.muted)
  doc.text(`maks. ${format(max)}`, x + w - 4, y + 6, { align: "right" })

  const plotX = x + 4
  const plotY = y + 10
  const plotW = w - 8
  const plotH = h - 20
  const n = series.values.length
  const slot = plotW / n
  const barW = Math.max(0.6, Math.min(slot * 0.7, 14))
  doc.setDrawColor(...INK.line).setLineWidth(0.2)
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)
  series.values.forEach((v, i) => {
    if (v === null || max === 0) return
    const barH = (v / max) * plotH
    doc.setFillColor(...ACCENT)
    doc.rect(plotX + i * slot + (slot - barW) / 2, plotY + plotH - barH, barW, barH, "F")
  })
  doc
    .setFont(FONT, "normal")
    .setFontSize(6.5)
    .setTextColor(...INK.muted)
  const label = (text: string) => (text.length > 18 ? `${text.slice(0, 17)}…` : text)
  if (n <= 6) {
    series.labels.forEach((l, i) =>
      doc.text(label(l), plotX + i * slot + slot / 2, plotY + plotH + 4, {
        align: "center",
      })
    )
  } else {
    doc.text(series.labels[0], plotX, plotY + plotH + 4)
    doc.text(series.labels[n - 1], plotX + plotW, plotY + plotH + 4, { align: "right" })
  }
}
