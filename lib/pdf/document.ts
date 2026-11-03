import type { jsPDF } from "jspdf"

export type Rgb = [number, number, number]

export const PAGE = { width: 210, height: 297, margin: 16 }
export const INK: Record<"text" | "muted" | "line" | "soft", Rgb> = {
  text: [20, 23, 30],
  muted: [98, 106, 122],
  line: [222, 226, 233],
  soft: [244, 245, 248],
}
export const TONE: Record<"positive" | "negative" | "neutral", Rgb> = {
  positive: [22, 128, 88],
  negative: [190, 52, 52],
  neutral: [98, 106, 122],
}
export const ACCENT: Rgb = [124, 108, 255]

export const FONT = "Geist"
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
export async function createDocument(): Promise<jsPDF> {
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

/** Footer with page numbers on every page; call last. */
export function addFooters(doc: jsPDF, label: string) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc
      .setFont(FONT, "normal")
      .setFontSize(7.5)
      .setTextColor(...INK.muted)
    doc.text(label, PAGE.margin, PAGE.height - PAGE.margin + 4)
    doc.text(
      `${page} / ${pages}`,
      PAGE.width - PAGE.margin,
      PAGE.height - PAGE.margin + 4,
      {
        align: "right",
      }
    )
  }
}
