import { expect, test } from "@playwright/test"
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from "./helpers"

const PAGES = [
  ["/", "Policz kampanię"],
  ["/tools/profitability", "Rentowność kampanii"],
  ["/tools/budget-planner", "Planer budżetu"],
  ["/tools/keyword-analyzer", "Analizator słów kluczowych"],
  ["/tools/negative-keywords", "Wykluczające słowa kluczowe"],
  ["/tools/utm-builder", "Generator UTM"],
  ["/tools/rsa-builder", "Kreator reklam RSA"],
  ["/tools/ab-testing", "Kalkulator testów A/B"],
  ["/tools/ppc-reports", "Raporty PPC"],
] as const

for (const [path, heading] of PAGES) {
  test(`${path} loads cleanly @smoke`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
    await expect(page).toHaveTitle(/Ads Toolkit/)
    await expectNoHorizontalOverflow(page)

    await expectAccessible(page)

    expect(errors, "console errors").toEqual([])
  })
}

test("navigation reaches every tool @smoke", async ({ page, isMobile }) => {
  await page.goto("/")
  if (isMobile) await page.getByRole("button", { name: "Otwórz menu" }).click()
  const nav = page.getByRole("navigation", { name: "Nawigacja główna" }).last()
  await nav.getByRole("link", { name: "Generator UTM" }).click()
  await expect(page).toHaveURL(/\/tools\/utm-builder$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Generator UTM")
})

test("unknown address shows a Polish 404 page @smoke", async ({ page }) => {
  const response = await page.goto("/nie-ma-takiej-strony")
  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nie ma takiej strony"
  )
  await expect(page.getByRole("link", { name: "Wróć do panelu" })).toBeVisible()
})
