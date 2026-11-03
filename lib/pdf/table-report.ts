import type { jsPDF } from "jspdf"

export interface ReportTable {
  heading: string
  /** First column is the row label; the rest are right-aligned values. */
  columns: string[]
  rows: string[][]
}

export interface TableReport {
  title: string
  subtitle?: string
  /** Short highlighted statement under the title, e.g. the profitability verdict. */
  summary?: { text: string; tone: "positive" | "negative" | "neutral" }
  tables: ReportTable[]
  notes?: string[]
}

type Rgb = [number, number, number]

const PAGE = { width: 210, height: 297, margin: 16 }
const INK: Record<"text" | "muted" | "line", Rgb> = {
  text: [20, 23, 30],
  muted: [98, 106, 122],
  line: [222, 226, 233],
}
const TONE: Record<"positive" | "negative" | "neutral", Rgb> = {
  positive: [22, 128, 88],
  negative: [190, 52, 52],
  neutral: [98, 106, 122],
}
const ACCENT: Rgb = [124, 108, 255]

const FONT = "Geist"
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

async function loadFontBase64(file: string): Promise<string> {
  const response = await fetch(`${basePath}/fonts/${file}`)
  if (!response.ok) throw new Error(`Nie udało się wczytać czcionki ${file}.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * Embeds Geist because jsPDF's built-in fonts have no Polish diacritics (ą, ę, ł…).
 * jsPDF is loaded on demand so it never weighs on the first page load.
 */
async function createDocument(): Promise<jsPDF> {
  const [{ jsPDF }, regular, semibold] = await Promise.all([
    import("jspdf"),
    loadFontBase64("Geist-Regular.ttf"),
    loadFontBase64("Geist-SemiBold.ttf"),
  ])
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  doc.addFileToVFS("Geist-Regular.ttf", regular)
  doc.addFont("Geist-Regular.ttf", FONT, "normal")
  doc.addFileToVFS("Geist-SemiBold.ttf", semibold)
  doc.addFont("Geist-SemiBold.ttf", FONT, "bold")
  return doc
}

export async function renderTableReport(report: TableReport): Promise<Blob> {
  const doc = await createDocument()
  const contentWidth = PAGE.width - PAGE.margin * 2
  const bottom = PAGE.height - PAGE.margin - 8
  let y = PAGE.margin

  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) {
      doc.addPage()
      y = PAGE.margin
    }
  }

  // Header
  doc.setFillColor(...ACCENT)
  doc.rect(PAGE.margin, y, 10, 1.2, "F")
  y += 7
  doc
    .setFont(FONT, "normal")
    .setFontSize(9)
    .setTextColor(...INK.muted)
  doc.text("Ads Toolkit", PAGE.margin, y)
  y += 8
  doc
    .setFont(FONT, "bold")
    .setFontSize(18)
    .setTextColor(...INK.text)
  doc.text(report.title, PAGE.margin, y)
  y += 6
  if (report.subtitle) {
    doc
      .setFont(FONT, "normal")
      .setFontSize(9.5)
      .setTextColor(...INK.muted)
    const lines = doc.splitTextToSize(report.subtitle, contentWidth)
    doc.text(lines, PAGE.margin, y)
    y += lines.length * 4.6
  }
  if (report.summary) {
    y += 3
    doc
      .setFont(FONT, "bold")
      .setFontSize(11)
      .setTextColor(...TONE[report.summary.tone])
    const lines = doc.splitTextToSize(report.summary.text, contentWidth)
    doc.text(lines, PAGE.margin, y + 2)
    y += lines.length * 5.4 + 2
  }
  y += 6

  for (const table of report.tables) {
    const valueColumns = table.columns.length - 1
    const valueWidth = valueColumns > 1 ? 32 : 46
    const labelWidth = contentWidth - valueWidth * valueColumns
    const columnRight = (i: number) => PAGE.margin + labelWidth + valueWidth * i

    // Keep short tables on one page; long ones may break between rows.
    const estimatedHeight = 14 + table.rows.length * 9.8
    ensureSpace(estimatedHeight < (bottom - PAGE.margin) / 2 ? estimatedHeight : 22)
    doc
      .setFont(FONT, "bold")
      .setFontSize(11)
      .setTextColor(...INK.text)
    doc.text(table.heading, PAGE.margin, y)
    y += 6

    doc
      .setFont(FONT, "normal")
      .setFontSize(8)
      .setTextColor(...INK.muted)
    table.columns.forEach((column, i) => {
      if (i === 0) doc.text(column, PAGE.margin, y)
      else doc.text(column, columnRight(i), y, { align: "right" })
    })
    y += 2.5
    doc.setDrawColor(...INK.line).setLineWidth(0.2)
    doc.line(PAGE.margin, y, PAGE.margin + contentWidth, y)
    y += 5

    for (const row of table.rows) {
      const labelLines = doc.splitTextToSize(row[0], labelWidth - 4)
      const rowHeight = Math.max(1, labelLines.length) * 4.4 + 2.6
      ensureSpace(rowHeight)
      doc
        .setFont(FONT, "normal")
        .setFontSize(9.5)
        .setTextColor(...INK.text)
      doc.text(labelLines, PAGE.margin, y)
      row.slice(1).forEach((cell, i) => {
        const muted = cell.startsWith("Brak")
        doc.setTextColor(...(muted ? INK.muted : INK.text))
        doc.text(cell, columnRight(i + 1), y, { align: "right" })
      })
      y += rowHeight - 2.6
      doc.setDrawColor(...INK.line)
      doc.line(PAGE.margin, y, PAGE.margin + contentWidth, y)
      y += 5
    }
    y += 5
  }

  if (report.notes?.length) {
    ensureSpace(16)
    doc
      .setFont(FONT, "bold")
      .setFontSize(11)
      .setTextColor(...INK.text)
    doc.text("Jak czytać wyniki", PAGE.margin, y)
    y += 6
    doc
      .setFont(FONT, "normal")
      .setFontSize(9)
      .setTextColor(...INK.muted)
    for (const note of report.notes) {
      const lines = doc.splitTextToSize(note, contentWidth)
      ensureSpace(lines.length * 4.4 + 2)
      doc.text(lines, PAGE.margin, y)
      y += lines.length * 4.4 + 2
    }
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc
      .setFont(FONT, "normal")
      .setFontSize(7.5)
      .setTextColor(...INK.muted)
    doc.text(
      "Wygenerowano w Ads Toolkit. Obliczenia wykonane lokalnie w przeglądarce.",
      PAGE.margin,
      PAGE.height - PAGE.margin + 4
    )
    doc.text(
      `${page} / ${pages}`,
      PAGE.width - PAGE.margin,
      PAGE.height - PAGE.margin + 4,
      {
        align: "right",
      }
    )
  }

  return doc.output("blob")
}
