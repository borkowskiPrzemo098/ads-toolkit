import { expect, test, type Page } from "@playwright/test"
import { uploadReports, VALID_REPORTS } from "./auditor-fixtures"
import { expectAccessible, watchErrors } from "./helpers"

const card = (page: Page, name: string) =>
  page.getByRole("article", { name: `Raport ${name}` })

test("auditor import: ten report types, summary and confirmation", async ({ page }) => {
  const errors = watchErrors(page)
  const workers: string[] = []
  page.on("worker", (w) => workers.push(w.url()))
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, VALID_REPORTS)

  const expected: [string, string][] = [
    ["kampanie-pl.csv", "Kampanie"],
    ["search-terms-en.csv", "Wyszukiwane hasła"],
    ["slowa-kluczowe-utf16.csv", "Słowa kluczowe"],
    ["urzadzenia.xlsx", "Urządzenia"],
    ["godziny-srednik.csv", "Godziny i dni tygodnia"],
    ["lokalizacje.csv", "Lokalizacje"],
    ["reklamy-en.xlsx", "Reklamy"],
    ["strony-docelowe.csv", "Strony docelowe"],
    ["konwersje.csv", "Konwersje (działania)"],
    ["grupy-reklam.csv", "Grupy reklam"],
  ]
  for (const [file, type] of expected) {
    const c = card(page, file)
    await expect(c.getByLabel("Typ raportu")).toHaveValue(
      (await c
        .getByLabel("Typ raportu")
        .locator("option", { hasText: type })
        .getAttribute("value")) as string
    )
  }
  // Parsing ran in the worker, not on the page.
  expect(workers.some((u) => u.includes("/_next/"))).toBe(true)

  const campaigns = card(page, "kampanie-pl.csv")
  await expect(campaigns.getByText("Pominięto 2 wiersze podsumowania")).toBeVisible()
  await expect(
    campaigns.getByText(/1 października 2026 – 31 października 2026/)
  ).toBeVisible()

  const keywords = card(page, "slowa-kluczowe-utf16.csv")
  await expect(keywords.getByText("UTF-16")).toBeVisible()
  await expect(keywords.locator("dd").first()).toHaveText("4")
  await keywords.getByText("Pomiń 1 zdublowany wiersz").click()
  await expect(keywords.locator("dd").first()).toHaveText("3")

  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await expect(page.getByRole("heading", { name: "Podsumowanie importu" })).toBeVisible()
  const stat = (label: string) =>
    page.locator("dl > div").filter({ hasText: label }).locator("dd")
  await expect(stat("Plików")).toHaveText("10")
  await expect(stat("Typów raportów")).toHaveText("10")
  await expect(
    page.getByText(/Sumy konta .* zostaną policzone z raportu „kampanie-pl.csv”/)
  ).toBeVisible()
  await expectAccessible(page)

  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await expect(page.getByRole("heading", { name: "Dane zatwierdzone" })).toBeVisible()
  await expect(page.getByText("Kampanie, 4 rekordów")).toBeVisible()
  expect(errors).toEqual([])
})

test("auditor import: broken files block the audit until removed", async ({ page }) => {
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, [
    "brak-kosztu.csv",
    "pusty.csv",
    "nieznany.csv",
    "lokalizacje.csv",
  ])

  await expect(card(page, "pusty.csv").getByRole("alert")).toHaveText("Plik jest pusty.")
  await expect(
    card(page, "brak-kosztu.csv").getByText(
      /Brakuje kolumn potrzebnych do analizy: Koszt/
    )
  ).toBeVisible()
  await expect(
    card(page, "nieznany.csv").getByText(/Nie rozpoznano wiersza nagłówka/)
  ).toBeVisible()
  const next = page.getByRole("button", { name: "Przejdź do podsumowania" })
  await expect(next).toBeDisabled()
  await expect(page.getByText("3 pliki wymagają poprawy albo usunięcia.")).toBeVisible()
  await expectAccessible(page)

  for (const name of ["brak-kosztu.csv", "pusty.csv", "nieznany.csv"])
    await page.getByRole("button", { name: `Usuń ${name}` }).click()
  await expect(next).toBeEnabled()
})

test("auditor import: manual mapping and the same file twice", async ({ page }) => {
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, ["lokalizacje.csv"])
  const c = card(page, "lokalizacje.csv")
  await c.getByRole("button", { name: "Przypisz kolumny" }).click()
  await c.getByLabel("Konwersje", { exact: true }).selectOption("none")
  await expect(c.getByText(/Bez kolumn: Konwersje, Wartość konwersji\./)).toBeVisible()
  await c.getByRole("button", { name: "Przywróć rozpoznanie automatyczne" }).click()
  await expect(c.getByText(/Bez kolumn: Konwersje, Wartość konwersji\./)).toHaveCount(0)

  await uploadReports(page, ["lokalizacje.csv"])
  await expect(page.getByText(/Ten sam raport co „lokalizacje.csv”/)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Przejdź do podsumowania" })
  ).toBeDisabled()
})
