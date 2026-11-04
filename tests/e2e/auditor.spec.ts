import { expect, test, type Page } from "@playwright/test"
import { uploadReports, VALID_REPORTS } from "./auditor-fixtures"
import { downloadFrom, expectAccessible, nbsp, watchErrors } from "./helpers"

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
  // Data check: totals from the campaign report only, every report reconciled against them.
  await expect(page.getByRole("heading", { name: "Sumy konta" })).toBeVisible()
  await expect(page.getByText(/Z raportu „kampanie-pl.csv” \(kampanie\)/)).toBeVisible()
  const totals = page.locator("dl").first()
  await expect(totals.getByText(nbsp("6448,00 zł"))).toBeVisible()
  await expect(totals.getByText(nbsp("174 610"))).toBeVisible()
  const row = (name: string) =>
    page
      .getByRole("region", { name: "Zgodność raportów z sumami konta" })
      .getByRole("row")
      .filter({ hasText: name })
  await expect(row("kampanie-pl.csv")).toContainText("Źródło sum")
  await expect(row("urzadzenia.xlsx")).toContainText("Zgodny")
  await expect(row("urzadzenia.xlsx")).toContainText("Obejmuje 1 z 4 kampanii")
  await expect(row("search-terms-en.csv")).toContainText("Część konta")
  await expect(page.getByRole("heading", { name: "Kampanie (4)" })).toBeVisible()
  await expectAccessible(page)
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

test("auditor dashboard: KPIs, charts and filters", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, ["kampanie-dzienne.csv", "urzadzenia.xlsx"])
  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()

  const kpis = page.getByRole("region", { name: "Najważniejsze wskaźniki" })
  const kpi = (label: string) => kpis.locator("div").filter({ hasText: label }).first()
  // kampanie-dzienne.csv: no currency in the file, so amounts carry no symbol.
  await expect(kpi("Koszt")).toContainText(nbsp("9754,80"))
  await expect(kpi("CTR")).toContainText("5,00%")
  await expect(kpi("ROAS")).toContainText("572%")
  await expect(page.getByText("Raporty nie podają waluty")).toBeVisible()
  for (const chart of ["Koszt", "Konwersje", "ROAS"])
    await expect(page.getByRole("img", { name: `Wykres: ${chart}` })).toBeVisible()
  await expect(page.getByText(/Kurtki – PMax\s*72%/)).toBeVisible()
  await expectAccessible(page)

  await page
    .getByLabel("Kampania", { exact: true })
    .selectOption({ label: "Buty – Search" })
  await expect(kpi("Kliknięcia")).toContainText("2570")

  await page
    .getByLabel("Kampania", { exact: true })
    .selectOption({ label: "Wszystkie kampanie" })
  await page.getByLabel("Od").fill("2026-10-01")
  await page.getByLabel("Do").fill("2026-10-07")
  await expect(page.getByText("21 rekordów po filtrach")).toBeVisible()

  await page.getByRole("button", { name: "Wyczyść" }).click()
  await page.getByLabel("Urządzenie").selectOption({ label: "Telefony" })
  await expect(
    page.getByText(/liczby pochodzą z raportu „urzadzenia.xlsx”/)
  ).toBeVisible()
  await expect(kpi("Koszt")).toContainText(nbsp("1190,40"))
  await expect(
    page.getByText(/nie mają kolumn potrzebnych do wybranych filtrów/)
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("auditor findings: rules, evidence, filters and targets", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, ["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
  await page.getByRole("button", { name: "Przejdź do audytu" }).click()
  await page.getByRole("tab", { name: "Wykrycia" }).click()

  const list = page.getByRole("list", { name: "Wyniki audytu" })
  const first = list.getByRole("article").first()
  await expect(first).toHaveAccessibleName(
    "Wysoki koszt przy małej liczbie konwersji: Kurtki – Search"
  )
  await expect(first).toContainText("Ważność: Wysoki")
  await expect(first).toContainText("Kampania odpowiada za 47% kosztu konta")
  await expect(first).toContainText("Źródło: kampanie-audyt.csv · Kampania")
  await expect(
    list.getByRole("article", {
      name: /Słowo kluczowe z kosztem bez konwersji: buty sportowe/,
    })
  ).toBeVisible()
  await expectAccessible(page)

  await page.getByRole("radio", { name: "Możliwości" }).click()
  await expect(list.getByRole("article")).toHaveCount(5)
  await page.getByLabel("Obszar").selectOption({ label: "Słowa kluczowe" })
  await expect(list.getByRole("article")).toHaveCount(3)

  // A CPA goal of 15 makes "Buty – Search" (CPA 20) no longer a budget candidate.
  await page.getByLabel("Obszar").selectOption({ label: "Kampanie" })
  await expect(list.getByRole("article", { name: /: Buty – Search$/ })).toHaveCount(1)
  await page.getByRole("button", { name: "Cele (opcjonalnie)" }).click()
  await page.getByLabel("Docelowy CPA").fill("15")
  await expect(list.getByRole("article", { name: /: Buty – Search$/ })).toHaveCount(0)

  await page.getByRole("button", { name: "Jak liczymy" }).click()
  await expect(page.getByText(/test dwumianowy liczby konwersji/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test("auditor search terms, devices, locations and hours", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, [
    "kampanie-audyt.csv",
    "hasla-audyt.csv",
    "urzadzenia-audyt.csv",
    "lokalizacje-audyt.csv",
    "godziny-audyt.csv",
  ])
  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
  await page.getByRole("button", { name: "Przejdź do audytu" }).click()

  await page.getByRole("tab", { name: "Wyszukiwane hasła" }).click()
  await page.getByLabel("Słowa opisujące ofertę").fill("buty, obuwie, nike, asics")
  const table = page.getByRole("region", { name: "Wyszukiwane hasła z decyzjami" })
  const row = (term: string) => table.getByRole("row").filter({ hasText: term })
  await expect(row("buty sportowe tanie")).toContainText("Sugestia: wyklucz")
  await expect(row("praca sklep obuwniczy")).toContainText("Obserwuj (mała próba)")
  await expect(row("kurtka zimowa damska")).toContainText("Niepowiązana")
  await expect(row("nike pegasus 41 rozmiar 42")).toContainText("Sugestia: nowe słowo")
  await expectAccessible(page)

  // Nothing is exported until the user decides.
  await expect(
    page.getByRole("button", { name: "Wykluczenia: pobierz TXT" })
  ).toBeDisabled()
  await page.getByRole("button", { name: /Oznacz sugerowane wykluczenia/ }).click()
  await page
    .getByLabel("Decyzja: praca sklep obuwniczy")
    .selectOption({ label: "Wyklucz" })
  await page
    .getByLabel("Dopasowanie: praca sklep obuwniczy")
    .selectOption({ label: "Do wyrażenia" })
  await page
    .getByLabel("Decyzja: nike pegasus 41 rozmiar 42")
    .selectOption({ label: "Dodaj jako słowo kluczowe" })
  const exclusions = await downloadFrom(page, "Wykluczenia: pobierz TXT")
  expect(exclusions.body.toString("utf8")).toBe(
    '[buty sportowe tanie]\r\n"praca sklep obuwniczy"'
  )
  const keywords = await downloadFrom(page, "Nowe słowa kluczowe: pobierz TXT")
  expect(keywords.body.toString("utf8")).toBe("[nike pegasus 41 rozmiar 42]")

  await page.getByRole("tab", { name: "Urządzenia" }).click()
  await expect(
    page.getByRole("article", { name: "Urządzenie z wysokim CPA: Telefony" })
  ).toBeVisible()
  await page.getByRole("tab", { name: "Lokalizacje" }).click()
  await expect(
    page.getByRole("article", { name: "Lokalizacja z wysokim CPA: Kraków" })
  ).toBeVisible()
  await page.getByRole("tab", { name: "Godziny i dni" }).click()
  await expect(page.getByRole("img", { name: "Wykres: CPA" })).toBeVisible()
  await expect(
    page.getByRole("article", { name: /Godziny z najlepszymi wynikami: 18:00–18:59/ })
  ).toBeVisible()
  await expectAccessible(page)
  expect(errors).toEqual([])
})

test("auditor recommendations and efficiency index", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, ["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
  await page.getByRole("button", { name: "Przejdź do audytu" }).click()

  // Recommendations are the default view.
  const urgent = page.getByRole("region", {
    name: "Problemy wymagające natychmiastowej uwagi",
  })
  await expect(urgent.getByRole("article")).toHaveCount(4)
  const rec = page.getByRole("article", {
    name: "Wysoki koszt przy małej liczbie konwersji: Kurtki – Search",
  })
  for (const label of ["PROBLEM", "DOWÓD", "INTERPRETACJA", "DZIAŁANIE"])
    await expect(rec).toContainText(label)
  await expect(rec).toContainText("Priorytet: Wysoki")
  await expectAccessible(page)

  await page.getByRole("tab", { name: "Indeks efektywności" }).click()
  await expect(page.getByText("48", { exact: true })).toBeVisible()
  await expect(page.getByText("3 z 7")).toBeVisible()
  await expect(page.getByText(/nie oficjalna ocena Google/)).toBeVisible()
  await expect(page.getByText("Brak raportu urządzeń z konwersjami.")).toBeVisible()
  await expectAccessible(page)
  expect(errors).toEqual([])
})

test("auditor profitability and period comparison", async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto("./tools/campaign-auditor/")
  await uploadReports(page, ["kampanie-audyt.csv", "kampanie-wrzesien.csv"])
  await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
  await page.getByRole("button", { name: "Zatwierdź dane" }).click()
  await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
  await page.getByRole("button", { name: "Przejdź do audytu" }).click()

  await page.getByRole("tab", { name: "Rentowność" }).click()
  await expect(
    page.getByText("Wpisz marżę albo koszt produktu, aby oszacować zysk.").first()
  ).toBeVisible()
  await page.getByLabel("Marża").fill("40")
  await page.getByLabel("Koszt dostawy na zamówienie").fill("10")
  const row = (label: string) =>
    page
      .locator("dl > div")
      .filter({
        has: page.locator("dt", {
          hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}`),
        }),
      })
  await expect(row("Szacowany zysk po reklamie")).toContainText(nbsp("9272,00 zł"))
  await expect(row("Szacowany zysk po reklamie")).toContainText("Szacunek")
  await expect(row("Koszt reklamy")).toContainText("Google Ads")
  await expect(row("Marża (wpisana)")).toContainText("Wpisane")
  await expect(row("Break-even ROAS")).toContainText("290,0%")
  await expectAccessible(page)

  await page.getByRole("tab", { name: "Porównanie okresów" }).click()
  await expect(page.getByText(/30 i 31 dni/)).toBeVisible()
  const table = page.getByRole("region", {
    name: "Porównanie wskaźników między okresami",
  })
  await expect(table.getByRole("row").filter({ hasText: "Koszt" })).toContainText(
    "+70,3%"
  )
  await expect(table.getByRole("row").filter({ hasText: "ROAS" })).toContainText("p.p.")
  await expect(page.getByText(/ROAS 67% → 100%/)).toBeVisible()
  await expectAccessible(page)
  expect(errors).toEqual([])
})
