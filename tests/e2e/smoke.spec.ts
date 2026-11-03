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
  ["/tools/campaign-auditor", "Audyt kampanii"],
  ["/o-aplikacji", "O aplikacji"],
  ["/prywatnosc", "Polityka prywatności"],
  ["/regulamin", "Regulamin"],
] as const

for (const [path, heading] of PAGES) {
  test(`${path} loads cleanly @smoke`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto(`.${path}`)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
    await expect(page).toHaveTitle(/Ads Toolkit/)
    await expectNoHorizontalOverflow(page)

    await expectAccessible(page)

    expect(errors, "console errors").toEqual([])
  })
}

test("navigation reaches every tool @smoke", async ({ page, isMobile }) => {
  await page.goto("./")
  if (isMobile) await page.getByRole("button", { name: "Otwórz menu" }).click()
  const nav = page.getByRole("navigation", { name: "Nawigacja główna" }).last()
  await nav.getByRole("link", { name: "Generator UTM" }).click()
  await expect(page).toHaveURL(/\/ads-toolkit\/tools\/utm-builder\/$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Generator UTM")
})

test("unknown address shows a Polish 404 page @smoke", async ({ page }) => {
  const response = await page.goto("./nie-ma-takiej-strony")
  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nie ma takiej strony"
  )
  await expect(page.getByRole("link", { name: "Wróć do panelu" })).toBeVisible()
})

test("icons, preview image and sitemap resolve under the base path @smoke", async ({
  page,
  request,
}) => {
  await page.goto("./")
  const head = await page.evaluate(() =>
    [
      'link[rel="icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="canonical"]',
      'meta[property="og:image"]',
    ].map((selector) => {
      const el = document.querySelector(selector)
      return el?.getAttribute("href") ?? el?.getAttribute("content") ?? ""
    })
  )
  const [icon, appleIcon, canonical, ogImage] = head
  expect(icon).toMatch(/^\/ads-toolkit\/icon\.svg/)
  expect(appleIcon).toMatch(/^\/ads-toolkit\/apple-icon\.png/)
  expect(canonical).toBe("https://borkowskiprzemo098.github.io/ads-toolkit/")
  expect(ogImage).toMatch(
    /^https:\/\/borkowskiprzemo098\.github\.io\/ads-toolkit\/opengraph-image\.png/
  )

  for (const path of [icon, appleIcon, "/ads-toolkit/opengraph-image.png"]) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
  const sitemap = await (await request.get("./sitemap.xml")).text()
  expect(sitemap).toContain(
    "https://borkowskiprzemo098.github.io/ads-toolkit/tools/ppc-reports/"
  )
  expect(sitemap).toContain(
    "https://borkowskiprzemo098.github.io/ads-toolkit/prywatnosc/"
  )
})
