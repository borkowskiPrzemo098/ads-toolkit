import { expect, test, type Page } from "@playwright/test"
import { uploadReports, VALID_REPORTS } from "./auditor-fixtures"
import { waitForHydration } from "./helpers"
import { auditLayout, type LayoutIssue } from "./layout-audit"

/*
 * Responsive audit (@responsive): every page, empty and filled with large realistic values,
 * on phone, landscape, tablet and laptop widths. Fails on horizontal page scroll, content
 * off screen, cut-off text, text under 11px and (on touch widths) targets under 24×24px.
 * Runs in Chromium and WebKit (Safari); see playwright.config.ts.
 */

const VIEWPORTS = [
  { name: "telefon 320", width: 320, height: 568, touch: true },
  { name: "telefon 390", width: 390, height: 844, touch: true },
  { name: "telefon poziomo", width: 844, height: 390, touch: true },
  { name: "tablet 768", width: 768, height: 1024, touch: true },
  { name: "laptop 1024", width: 1024, height: 768, touch: false },
  { name: "desktop 1440", width: 1440, height: 900, touch: false },
]

const fill = (page: Page, label: string, value: string) =>
  page.getByLabel(label, { exact: true }).fill(value)

const PPC_CSV = [
  "Raport kampanii",
  "1 października 2026 - 2 października 2026",
  "Dzień,Kampania,Wyśw.,Kliknięcia,Koszt,Konwersje,Wartość konw.",
  '2026-10-01,Buty damskie do biegania – Search – Polska – kampania jesienna,184000,9250,"18450,00",412,"186800,00"',
  '2026-10-02,Buty damskie do biegania – Search – Polska – kampania jesienna,201200,10120,"20210,00",455,"201000,00"',
  '2026-10-02,Kurtki – Performance Max,85000,2020,"6060,00",0,0',
].join("\n")

type Setup = (page: Page) => Promise<void>

const PAGES: [name: string, path: string, setup?: Setup][] = [
  ["panel", "./"],
  ["o aplikacji", "./o-aplikacji/"],
  ["prywatność", "./prywatnosc/"],
  ["regulamin", "./regulamin/"],
  ["404", "./nie-ma-takiej-strony/"],
  [
    "rentowność",
    "./tools/profitability/",
    async (page) => {
      await fill(page, "Koszt reklamy", "125000")
      await fill(page, "Kliknięcia", "98000")
      await fill(page, "Konwersje", "3400")
      await fill(page, "Przychód z kampanii", "1980000")
      await fill(page, "Marża", "30")
      await page.getByRole("button", { name: "Porównaj z drugą kampanią" }).click()
      await fill(page, "Przychód z kampanii", "640000")
    },
  ],
  [
    "planer budżetu",
    "./tools/budget-planner/",
    async (page) => {
      await fill(page, "Budżet kampanii", "250000")
      await fill(page, "Średni CPC", "2,35")
      await fill(page, "Współczynnik konwersji", "3,2")
      await fill(page, "Średnia wartość zamówienia", "1250")
      await fill(page, "Marża", "40")
      await page.getByRole("button", { name: "Zapisz jako wariant" }).click()
    },
  ],
  [
    "słowa kluczowe",
    "./tools/keyword-analyzer/",
    async (page) => {
      await page
        .getByLabel("Lista słów kluczowych")
        .fill(
          [
            "buty do biegania damskie",
            "Buty do biegania damskie",
            "damskie buty do biegania",
            "tanie buty do biegania promocja wyprzedaż",
            "jak wybrać buty do biegania po asfalcie dla początkujących",
            "buty nike pegasus 41",
            "sklep z butami warszawa mokotów",
            "opinie buty asics gel nimbus",
            "buty",
          ].join("\n")
        )
      await page.getByRole("button", { name: "Analizuj listę" }).click()
    },
  ],
  [
    "wykluczenia",
    "./tools/negative-keywords/",
    async (page) => {
      await page
        .getByLabel("Wyszukiwane hasła")
        .fill(
          "praca w sklepie obuwniczym warszawa\nbuty za darmo\nbuty do biegania damskie\nnaprawa butów sportowych kraków\njak wyczyścić buty zamszowe\nbuty używane olx\nkurtka zimowa damska"
        )
      await page.getByLabel("Twoja oferta").fill("buty")
      await page.getByRole("button", { name: "Znajdź sugestie" }).click()
    },
  ],
  [
    "UTM",
    "./tools/utm-builder/",
    async (page) => {
      await fill(
        page,
        "Adres strony",
        "https://www.przykladowy-sklep-internetowy.pl/kategoria/buty-do-biegania-damskie?kolor=czarny&rozmiar=38#opinie"
      )
      await page.getByRole("button", { name: "Newsletter" }).click()
      await fill(
        page,
        "Kampania (utm_campaign)",
        "Listopad Wyprzedaż Black Week 2026 kolekcja zimowa"
      )
    },
  ],
  [
    "RSA",
    "./tools/rsa-builder/",
    async (page) => {
      await fill(page, "Nazwa firmy", "Biegam.pl")
      await fill(page, "Produkt lub usługa", "Buty do biegania")
      await fill(page, "Główne słowa kluczowe", "buty do biegania, buty trailowe")
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
    },
  ],
  [
    "test A/B",
    "./tools/ab-testing/",
    async (page) => {
      for (const [variant, visits, conversions] of [
        ["Wariant A", "1250000", "41250"],
        ["Wariant B", "1248000", "44100"],
      ]) {
        const card = page.getByRole("region", { name: variant })
        await card.getByLabel("Wizyty lub kliknięcia").fill(visits)
        await card.getByLabel("Konwersje", { exact: true }).fill(conversions)
      }
    },
  ],
  [
    "raport PPC",
    "./tools/ppc-reports/",
    async (page) => {
      await page
        .getByRole("region", { name: "Bieżący okres" })
        .locator('input[type="file"]')
        .setInputFiles({
          name: "raport.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(PPC_CSV),
        })
      await page.getByRole("button", { name: "Zatwierdź import" }).click()
      await fill(page, "Nazwa klienta", "Biegam.pl Sp. z o.o. – sklep internetowy")
    },
  ],
  [
    "audyt kampanii",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, VALID_REPORTS)
      await expect(page.getByRole("article")).toHaveCount(VALID_REPORTS.length)
      await page
        .getByRole("article", { name: "Raport lokalizacje.csv" })
        .getByRole("button", { name: "Przypisz kolumny" })
        .click()
    },
  ],
  [
    "audyt kampanii – kontrola danych",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, VALID_REPORTS)
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await expect(page.getByRole("heading", { name: "Sumy konta" })).toBeVisible()
    },
  ],
  [
    "audyt kampanii – dashboard",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, [
        "kampanie-dzienne.csv",
        "urzadzenia.xlsx",
        "lokalizacje.csv",
      ])
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
      await expect(page.getByRole("img", { name: "Wykres: ROAS" })).toBeVisible()
    },
  ],
  [
    "audyt kampanii – wyniki audytu",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, ["kampanie-audyt.csv", "slowa-kluczowe-audyt.csv"])
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
      await page.getByRole("button", { name: "Przejdź do audytu" }).click()
      await page.getByRole("tab", { name: "Wykrycia" }).click()
      await page.getByRole("button", { name: "Cele (opcjonalnie)" }).click()
      await page.getByRole("button", { name: "Jak liczymy" }).click()
    },
  ],
  [
    "audyt kampanii – wyszukiwane hasła",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, [
        "kampanie-audyt.csv",
        "hasla-audyt.csv",
        "urzadzenia-audyt.csv",
        "godziny-audyt.csv",
      ])
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
      await page.getByRole("button", { name: "Przejdź do audytu" }).click()
      await page.getByRole("tab", { name: "Wyszukiwane hasła" }).click()
      await page.getByLabel("Słowa opisujące ofertę").fill("buty")
    },
  ],
  [
    "audyt kampanii – godziny",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, [
        "kampanie-audyt.csv",
        "godziny-audyt.csv",
        "urzadzenia-audyt.csv",
      ])
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
      await page.getByRole("button", { name: "Przejdź do audytu" }).click()
      await page.getByRole("tab", { name: "Godziny i dni" }).click()
      await expect(page.getByRole("img", { name: "Wykres: CPA" })).toBeVisible()
    },
  ],
  [
    "audyt kampanii – indeks",
    "./tools/campaign-auditor/",
    async (page) => {
      await uploadReports(page, [
        "kampanie-audyt.csv",
        "slowa-kluczowe-audyt.csv",
        "reklamy-en.xlsx",
      ])
      await page.getByRole("button", { name: "Przejdź do podsumowania" }).click()
      await page.getByRole("button", { name: "Zatwierdź dane" }).click()
      await page.getByRole("button", { name: "Przejdź do dashboardu" }).click()
      await page.getByRole("button", { name: "Przejdź do audytu" }).click()
      await page.getByRole("tab", { name: "Indeks efektywności" }).click()
    },
  ],
]

const format = (issues: LayoutIssue[]) => issues.map((i) => `${i.kind}: ${i.detail}`)

test.beforeEach(async ({ context }) => {
  // Usage counts, so the dashboard shows its bar chart too.
  await context.addInitScript(() =>
    localStorage.setItem(
      "ads-toolkit.tool-usage.v1",
      JSON.stringify({ profitability: 12, "ppc-reports": 7, "negative-keywords": 2 })
    )
  )
})

for (const [name, path, setup] of PAGES) {
  for (const state of setup ? (["puste", "wypełnione"] as const) : (["puste"] as const)) {
    test(`${name} (${state}) on every screen size @responsive`, async ({ page }) => {
      test.slow()
      const problems: string[] = []
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(path)
        // WebKit can take input before React hydrates, and the typed text would be lost.
        await waitForHydration(page)
        if (state === "wypełnione") await setup!(page)
        await page.waitForTimeout(300)
        problems.push(
          ...format(await auditLayout(page, vp.touch)).map((p) => `${vp.name}: ${p}`)
        )
      }
      expect([...new Set(problems)], "layout problems").toEqual([])
    })
  }
}
