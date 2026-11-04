/** Public address, repository and legal dates. Change here when the domain changes. */
export const SITE_NAME = "Ads Toolkit"
export const SITE_URL = "https://borkowskiprzemo098.github.io/ads-toolkit"
export const REPO_URL = "https://github.com/borkowskiPrzemo098/ads-toolkit"
export const ISSUES_URL = `${REPO_URL}/issues`
export const VERSION = "1.0"

/**
 * Absolute canonical URL of a page. metadataBase holds only the origin, because Next.js adds
 * basePath to file-based images (og:image) itself but not to canonical links.
 */
export const pageUrl = (path: string) => `${SITE_URL}${path === "/" ? "/" : `${path}/`}`

/** Date shown on the privacy policy and terms; update with every change of their content. */
export const LEGAL_UPDATED = "3 listopada 2026"

export const SITE_DESCRIPTION =
  "Dziewięć darmowych narzędzi do kampanii Google Ads: audyt konta z raportów, rentowność, budżet, słowa kluczowe, wykluczenia, UTM, reklamy RSA, testy A/B i raporty PPC. Bez logowania, dane zostają w przeglądarce."

/** Information pages, in footer order. */
export const INFO_PAGES = [
  { href: "/o-aplikacji", label: "O aplikacji" },
  { href: "/prywatnosc", label: "Polityka prywatności" },
  { href: "/regulamin", label: "Regulamin" },
] as const
