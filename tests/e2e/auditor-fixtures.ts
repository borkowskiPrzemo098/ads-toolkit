import { join } from "node:path"
import type { Page } from "@playwright/test"

/** Realistic Google Ads exports from tests/fixtures/auditor (see generate.py there). */
const FIXTURES = join(__dirname, "../fixtures/auditor")
export const VALID_REPORTS = [
  "kampanie-pl.csv",
  "search-terms-en.csv",
  "slowa-kluczowe-utf16.csv",
  "urzadzenia.xlsx",
  "godziny-srednik.csv",
  "lokalizacje.csv",
  "reklamy-en.xlsx",
  "strony-docelowe.csv",
  "konwersje.csv",
  "grupy-reklam.csv",
]

export async function uploadReports(page: Page, names: string[]) {
  await page
    .getByLabel("Wybierz raporty Google Ads (CSV lub XLSX)")
    .setInputFiles(names.map((n) => join(FIXTURES, n)))
}
