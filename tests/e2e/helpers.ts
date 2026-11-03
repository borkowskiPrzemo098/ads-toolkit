import AxeBuilder from "@axe-core/playwright"
import { expect, type Download, type Page } from "@playwright/test"

/** Collects console errors and uncaught exceptions for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  page.on("pageerror", (err) => errors.push(err.message))
  return errors
}

/** Polish number formatting uses non-breaking spaces; tests match any whitespace. */
export const nbsp = (text: string) => new RegExp(text.replace(/ /g, "\\s"))

export async function fill(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value)
}

export async function readDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Starts a download by clicking a button and returns the file. */
export async function downloadFrom(page: Page, buttonName: string) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName, exact: true }).click(),
  ])
  return { name: download.suggestedFilename(), body: await readDownload(download) }
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1)
}

/** WCAG 2.1 A/AA check; only serious and critical violations fail. */
export async function expectAccessible(page: Page) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  const serious = axe.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`
    )
  expect(serious, "accessibility violations").toEqual([])
}
