import { defineConfig, devices } from "@playwright/test"

const PORT = 3420
/** Same path as on GitHub Pages, so links and assets that ignore basePath fail here too. */
export const BASE_PATH = "/ads-toolkit"

/**
 * End-to-end tests run against the static export (`npm run test:e2e` builds it with
 * PAGES_BASE_PATH) served like GitHub Pages. Tests navigate with relative paths ("./tools/…").
 * Full user flows run in desktop Chromium; every page also gets a smoke check
 * (console errors, overflow, accessibility) on mobile Chromium, Firefox and WebKit.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}/`,
    locale: "pl-PL",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-static.mjs",
    env: { PORT: String(PORT), BASE_PATH },
    url: `http://localhost:${PORT}${BASE_PATH}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@smoke/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@smoke/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@smoke|@responsive/ },
  ],
})
