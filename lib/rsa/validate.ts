import { checkUrl } from "@/lib/utm/build"
import { countChars, displayText, limitOf, RSA, type AssetKind, type Pin } from "./limits"

export interface AdAsset {
  id: string
  text: string
  pin: Pin
}

export interface RsaAd {
  headlines: AdAsset[]
  descriptions: AdAsset[]
  finalUrl: string
  path1: string
  path2: string
}

export type Severity = "error" | "warning"

export interface Issue {
  severity: Severity
  message: string
}

export interface AdValidation {
  /** Problems per asset id. */
  assets: Record<string, Issue[]>
  /** Problems with the ad as a whole. */
  ad: Issue[]
  /** True when Google Ads would accept the ad as far as these checks can tell. */
  valid: boolean
}

// Built with the constructor: \p{…} needs the "u" flag at runtime, not at compile time.
const EMOJI = new RegExp("\\p{Extended_Pictographic}", "u")
const PHONE = /(?:\+?48[\s-]?)?(?:\d[\s-]?){9}/
const REPEATED_EXCLAIM = /[!?]{2,}/
const REPEATED_SYMBOLS = /([.,$%*])\1/
/** Common acronyms are fine in capitals; other all-caps words read as shouting. */
const ACRONYMS = new Set([
  "SEO",
  "SEM",
  "PPC",
  "BHP",
  "AGD",
  "RTV",
  "SUV",
  "VAT",
  "PDF",
  "USB",
  "LED",
  "GPS",
  "PLN",
  "EUR",
  "UE",
  "USA",
  "IT",
  "HR",
  "CV",
  "SMS",
  "TV",
  "DIY",
  "SPA",
  "VIP",
  "B2B",
  "B2C",
])

const normalizeForDuplicates = (text: string) =>
  displayText(text)
    .toLocaleLowerCase("pl-PL")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim()

export function validateAsset(kind: AssetKind, text: string): Issue[] {
  const issues: Issue[] = []
  const trimmed = text.trim()
  if (!trimmed) return [{ severity: "error", message: "Pusty tekst." }]

  const length = countChars(trimmed)
  const limit = limitOf(kind)
  if (length > limit) {
    issues.push({
      severity: "error",
      message: `${length} z ${limit} znaków: skróć o ${length - limit}.`,
    })
  }
  if (kind === "headline" && trimmed.includes("!")) {
    issues.push({ severity: "error", message: "Nagłówki nie mogą zawierać wykrzyknika." })
  }
  if (kind === "description" && (trimmed.match(/!/g) ?? []).length > 1) {
    issues.push({
      severity: "error",
      message: "Tekst może mieć najwyżej jeden wykrzyknik.",
    })
  }
  if (EMOJI.test(trimmed)) {
    issues.push({ severity: "error", message: "Google Ads nie akceptuje emoji." })
  }
  if (REPEATED_EXCLAIM.test(trimmed)) {
    issues.push({
      severity: "error",
      message: "Powtórzone „!” albo „?” są niedozwolone.",
    })
  } else if (REPEATED_SYMBOLS.test(trimmed)) {
    issues.push({
      severity: "warning",
      message: "Powtórzone znaki (np. „..”, „$$”) Google może uznać za nadużycie.",
    })
  }
  if (PHONE.test(displayText(trimmed))) {
    issues.push({
      severity: "warning",
      message: "Numer telefonu w treści zostanie odrzucony. Użyj rozszerzenia połączeń.",
    })
  }
  const shouting = displayText(trimmed)
    .split(/[\s,.;:–-]+/)
    .filter(
      (w) =>
        /[A-ZĄĆĘŁŃÓŚŹŻ]{4,}/.test(w) &&
        w === w.toLocaleUpperCase("pl-PL") &&
        !ACRONYMS.has(w)
    )
  if (shouting.length) {
    issues.push({
      severity: "warning",
      message: `Wielkie litery („${shouting[0]}”) Google może uznać za nadużycie.`,
    })
  }
  const braces = (trimmed.match(/[{}]/g) ?? []).length
  if (braces && !/^[^{}]*(\{keyword:[^{}]*\}[^{}]*)*$/i.test(trimmed)) {
    issues.push({
      severity: "error",
      message: "Nawiasy klamrowe tylko w składni {KeyWord:tekst domyślny}.",
    })
  }
  return issues
}

function validatePath(label: string, path: string): Issue[] {
  const issues: Issue[] = []
  if (countChars(path) > RSA.path.max) {
    issues.push({
      severity: "error",
      message: `${label}: najwyżej ${RSA.path.max} znaków.`,
    })
  }
  if (/\s/.test(path.trim())) {
    issues.push({
      severity: "warning",
      message: `${label}: zamiast spacji użyj myślnika.`,
    })
  }
  if (/[/\\?#]/.test(path)) {
    issues.push({ severity: "error", message: `${label}: bez znaków / \\ ? #.` })
  }
  return issues
}

export function validateAd(ad: RsaAd): AdValidation {
  const assets: Record<string, Issue[]> = {}
  const adIssues: Issue[] = []

  for (const kind of ["headline", "description"] as const) {
    const list = kind === "headline" ? ad.headlines : ad.descriptions
    const seen = new Map<string, string>()
    for (const asset of list) {
      const issues = validateAsset(kind, asset.text)
      const key = normalizeForDuplicates(asset.text)
      if (key && seen.has(key)) {
        issues.push({ severity: "error", message: "Powtarza się z innym tekstem." })
      } else if (key) {
        seen.set(key, asset.id)
      }
      assets[asset.id] = issues
    }

    const filled = list.filter((a) => a.text.trim())
    const rules = RSA[kind]
    const name = kind === "headline" ? "nagłówki" : "teksty reklamy"
    if (filled.length < rules.minCount) {
      adIssues.push({
        severity: "error",
        message: `Potrzebne co najmniej ${rules.minCount} ${name}; masz ${filled.length}.`,
      })
    }
    if (filled.length > rules.maxCount) {
      adIssues.push({
        severity: "error",
        message: `Najwyżej ${rules.maxCount} ${name}; masz ${filled.length}.`,
      })
    }
    for (const position of rules.positions) {
      const pinned = filled.filter((a) => a.pin === position)
      if (pinned.length === 1 && filled.length > rules.minCount) {
        adIssues.push({
          severity: "warning",
          message: `Pozycja ${position} ma przypięty tylko jeden tekst: zawsze będzie ten sam, a Google ma mniej kombinacji do testów.`,
        })
      }
    }
    const unpinned = filled.filter((a) => a.pin === null).length
    const freePositions = rules.positions.filter(
      (p) => !filled.some((a) => a.pin === p)
    ).length
    if (filled.length >= rules.minCount && unpinned < freePositions) {
      adIssues.push({
        severity: "error",
        message: `Za mało nieprzypiętych ${name}, by wypełnić wolne pozycje.`,
      })
    }
  }

  if (ad.headlines.some((h) => h.pin === 3)) {
    adIssues.push({
      severity: "warning",
      message:
        "Nagłówek na pozycji 3 nie zawsze się wyświetla. Nie przypinaj tam kluczowej treści.",
    })
  }

  if (!ad.finalUrl.trim()) {
    adIssues.push({ severity: "error", message: "Podaj adres strony docelowej." })
  } else {
    const check = checkUrl(ad.finalUrl)
    if (!check.ok) adIssues.push({ severity: "error", message: check.reason })
  }
  adIssues.push(
    ...validatePath("Ścieżka 1", ad.path1),
    ...validatePath("Ścieżka 2", ad.path2)
  )
  if (!ad.path1.trim() && ad.path2.trim()) {
    adIssues.push({
      severity: "error",
      message: "Ścieżka 2 wymaga wypełnionej ścieżki 1.",
    })
  }

  const valid =
    !adIssues.some((i) => i.severity === "error") &&
    !Object.values(assets).some((list) => list.some((i) => i.severity === "error"))

  return { assets, ad: adIssues, valid }
}

/**
 * Hints in the spirit of Google's guidance. Explicitly not Google's Ad Strength score,
 * which depends on data this tool does not have.
 */
export function adHints(ad: RsaAd, keywords: string[]): string[] {
  const hints: string[] = []
  const headlines = ad.headlines.filter((h) => h.text.trim())
  const descriptions = ad.descriptions.filter((d) => d.text.trim())

  if (headlines.length < 8) {
    hints.push(
      `Masz ${headlines.length} nagłówków. Więcej różnych nagłówków (nawet 15) daje Google więcej kombinacji do testów.`
    )
  }
  if (descriptions.length < 4) {
    hints.push(`Masz ${descriptions.length} z 4 możliwych tekstów reklamy.`)
  }
  const kws = keywords.map((k) => k.trim().toLocaleLowerCase("pl-PL")).filter(Boolean)
  if (kws.length) {
    const withKeyword = headlines.filter((h) =>
      kws.some((k) => displayText(h.text).toLocaleLowerCase("pl-PL").includes(k))
    ).length
    if (withKeyword < 2) {
      hints.push("Umieść słowo kluczowe w co najmniej 2 nagłówkach.")
    }
    if (headlines.length && withKeyword === headlines.length) {
      hints.push(
        "Wszystkie nagłówki zawierają słowo kluczowe. Dodaj też korzyści i wezwanie do działania."
      )
    }
  }
  const short = headlines.filter((h) => countChars(h.text) <= 15).length
  if (headlines.length >= 5 && short === 0) {
    hints.push("Dodaj kilka krótkich nagłówków: lepiej łączą się w różne kombinacje.")
  }
  return hints
}
