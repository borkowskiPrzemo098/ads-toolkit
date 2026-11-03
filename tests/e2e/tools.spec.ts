import { expect, test } from "@playwright/test"
import { downloadFrom, expectAccessible, fill, nbsp, watchErrors } from "./helpers"

/*
 * One realistic flow per tool, with the hand-checked numbers from the unit tests, ending in
 * the export the user would actually take away. Any console error fails the flow, which also
 * catches content-security-policy blocks (font fetch for PDFs, blob downloads, logo images).
 * Accessibility is checked again at the end, with results, tables and previews on screen.
 */

let errors: string[] = []
test.beforeEach(({ page }) => {
  errors = watchErrors(page)
})
test.afterEach(async ({ page }) => {
  await expectAccessible(page)
  expect(errors).toEqual([])
})

test("profitability: reference campaign, comparison and CSV", async ({ page }) => {
  await page.goto("./tools/profitability")
  await fill(page, "Koszt reklamy", "2000")
  await fill(page, "Kliknięcia", "1000")
  await fill(page, "Konwersje", "40")
  await fill(page, "Przychód z kampanii", "12000")
  await fill(page, "Marża", "30")

  await expect(
    page.getByText(nbsp("Kampania zarabia: 1600,00 zł zysku netto."))
  ).toBeVisible()
  await expect(page.getByText("600%").first()).toBeVisible()

  await page.getByRole("button", { name: "Porównaj z drugą kampanią" }).click()
  await fill(page, "Przychód z kampanii", "4000")
  await expect(page.getByRole("heading", { name: "Porównanie kampanii" })).toBeVisible()

  const csv = await downloadFrom(page, "CSV")
  expect(csv.name).toMatch(/^rentownosc-kampanii-\d{4}-\d{2}-\d{2}\.csv$/)
  const text = csv.body.toString("utf8")
  expect(text.charCodeAt(0)).toBe(0xfeff)
  expect(text).toContain("Zysk netto kampanii;PLN;1600;-800;-2400;")
})

test("budget planner: forecast and three scenarios", async ({ page }) => {
  await page.goto("./tools/budget-planner")
  await fill(page, "Budżet kampanii", "3000")
  await fill(page, "Średni CPC", "1,50")
  await fill(page, "Współczynnik konwersji", "2")
  await fill(page, "Średnia wartość zamówienia", "250")
  await fill(page, "Marża", "40")

  const forecast = page.getByLabel("Prognoza w scenariuszu realistycznym")
  await expect(forecast.getByText(nbsp("1000,00 zł")).first()).toBeVisible()
  await expect(forecast.getByText("333%")).toBeVisible()
  await expect(page.getByRole("cell", { name: nbsp("−750,00 zł") })).toBeVisible()
  await expect(
    page.getByRole("img", { name: /Wykres zysku względem budżetu/ })
  ).toBeVisible()

  const pdf = await downloadFrom(page, "PDF")
  expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-")
})

test("keyword analyzer: duplicates, categories and TXT", async ({ page }) => {
  await page.goto("./tools/keyword-analyzer")
  await page
    .getByLabel("Lista słów kluczowych")
    .fill(
      "buty do biegania damskie\nButy do biegania  damskie\ndamskie buty do biegania\ntanie buty do biegania\njak wybrać buty do biegania"
    )
  await page.getByRole("button", { name: "Analizuj listę" }).click()

  const stat = (label: string) =>
    page.locator("dl > div").filter({ hasText: label }).locator("dd")
  await expect(stat("Duplikatów")).toHaveText("1")
  await expect(stat("Podobnych")).toHaveText("1")
  await expect(page.getByRole("cell", { name: "Cena i promocja" })).toBeVisible()

  await page.getByLabel("Status").selectOption("clean")
  const txt = await downloadFrom(page, "TXT")
  expect(txt.body.toString("utf8").split("\r\n")).toEqual([
    "buty do biegania damskie",
    "tanie buty do biegania",
    "jak wybrać buty do biegania",
  ])
})

test("negative keywords: nothing exported without acceptance", async ({ page }) => {
  await page.goto("./tools/negative-keywords")
  await page
    .getByLabel("Wyszukiwane hasła")
    .fill("praca w sklepie obuwniczym\nbuty za darmo\nbuty do biegania damskie")
  await page.getByLabel("Twoja oferta").fill("buty")
  await page.getByRole("button", { name: "Znajdź sugestie" }).click()

  await expect(page.getByRole("button", { name: "TXT", exact: true })).toBeDisabled()
  await page
    .getByRole("group", { name: "Decyzja: praca", exact: true })
    .getByRole("button", { name: "Wyklucz" })
    .click()

  const txt = await downloadFrom(page, "TXT")
  expect(txt.body.toString("utf8")).toBe("praca")
})

test("UTM builder: keeps existing parameters and the fragment", async ({ page }) => {
  await page.goto("./tools/utm-builder")
  await fill(page, "Adres strony", "sklep.pl/buty?kolor=czarny#opinie")
  await page.getByRole("button", { name: "Newsletter" }).click()
  await fill(page, "Kampania (utm_campaign)", "Listopad Wyprzedaż")

  await expect(page.getByLabel("Gotowy link")).toHaveText(
    "https://sklep.pl/buty?kolor=czarny&utm_source=newsletter&utm_medium=email&utm_campaign=listopad_wyprzedaz#opinie"
  )
})

test("RSA builder: proposals, limits and export", async ({ page }) => {
  await page.goto("./tools/rsa-builder")
  await fill(page, "Nazwa firmy", "Biegam.pl")
  await fill(page, "Produkt lub usługa", "Buty do biegania")
  await fill(page, "Główne słowa kluczowe", "buty do biegania")
  await fill(page, "Najważniejsze korzyści", "Darmowa dostawa, 30 dni na zwrot")
  await fill(page, "Wezwanie do działania", "Sprawdź ofertę")

  for (const text of ["Buty do biegania", "Darmowa dostawa", "Sprawdź ofertę"]) {
    await page
      .getByRole("button", {
        name: `Dodaj: ${text} ${text.length}/30 znaków`,
        exact: true,
      })
      .click()
  }
  await expect(
    page.getByRole("textbox", { name: "Nagłówek 1", exact: true })
  ).toHaveValue("Buty do biegania")

  await page
    .getByRole("textbox", { name: "Nagłówek 2", exact: true })
    .fill("Darmowa dostawa dla wszystkich biegaczy!")
  await expect(page.getByText("Nagłówki nie mogą zawierać wykrzyknika.")).toBeVisible()
  await expect(page.getByText(/z 30 znaków: skróć o/)).toBeVisible()

  const txt = await downloadFrom(page, "TXT")
  expect(txt.body.toString("utf8")).toContain("1. Buty do biegania (16/30)")
})

test("A/B calculator: reference example is significant", async ({ page }) => {
  await page.goto("./tools/ab-testing")
  for (const [variant, visits, conversions] of [
    ["Wariant A", "1000", "50"],
    ["Wariant B", "1000", "75"],
  ]) {
    const card = page.getByRole("region", { name: variant })
    await card.getByLabel("Wizyty lub kliknięcia").fill(visits)
    await card.getByLabel("Konwersje", { exact: true }).fill(conversions)
  }
  await expect(
    page.getByRole("heading", { name: "Wykryto istotną statystycznie różnicę" })
  ).toBeVisible()
  await expect(page.getByText(/p = 0,021/).first()).toBeVisible()
})

test("PPC report: CSV mapping step, preview and PDF", async ({ page }) => {
  await page.goto("./tools/ppc-reports")
  const csv = [
    "Raport kampanii",
    "1 października 2026 - 2 października 2026",
    "Dzień,Kampania,Wyśw.,Kliknięcia,Koszt,Konwersje,Wartość konw.",
    '2026-10-01,Buty – Search,1000,50,"100,00",4,"800,00"',
    '2026-10-02,Buty – Search,1200,60,"120,00",5,"1000,00"',
    '2026-10-02,Kurtki – Search,500,20,"60,00",0,0',
    'Razem: konto,,2700,130,"280,00",9,"1800,00"',
  ].join("\n")
  await page
    .getByRole("region", { name: "Bieżący okres" })
    .locator('input[type="file"]')
    .setInputFiles({ name: "raport.csv", mimeType: "text/csv", buffer: Buffer.from(csv) })

  await expect(page.getByLabel("Koszt", { exact: true })).toHaveValue("4")
  await expect(
    page.getByText(/Wierszy z danymi: 3 · pominięte podsumowania: 1/)
  ).toBeVisible()
  await page.getByRole("button", { name: "Zatwierdź import" }).click()

  await fill(page, "Nazwa klienta", "Biegam.pl")
  const preview = page.getByRole("article", { name: "Podgląd raportu" })
  await expect(preview.getByRole("heading", { name: "Biegam.pl" })).toBeVisible()
  await expect(preview.getByText(nbsp("280,00 zł")).first()).toBeVisible()
  await expect(preview.getByText(/Kurtki – Search.*bez konwersji/)).toBeVisible()

  const pdf = await downloadFrom(page, "PDF")
  expect(pdf.name).toMatch(/^raport-google-ads-.*\.pdf$/)
  expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-")
  expect(pdf.body.length).toBeGreaterThan(20_000)
})
