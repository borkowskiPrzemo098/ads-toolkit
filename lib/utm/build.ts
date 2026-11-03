import { stripDiacritics } from "@/lib/keywords/normalize"

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const

export type UtmKey = (typeof UTM_KEYS)[number]
export type UtmValues = Record<UtmKey, string>

export const REQUIRED_UTM: UtmKey[] = ["utm_source", "utm_medium", "utm_campaign"]

export const EMPTY_UTM: UtmValues = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
}

/** Browsers and some servers break past ~2000 characters. */
export const MAX_URL_LENGTH = 2000

export interface NormalizeOptions {
  lowercase: boolean
  /** Replace Polish letters with plain ones (ą → a): shorter, readable links. */
  stripDiacritics: boolean
  /** What spaces become; "%20" keeps them and lets encoding handle it. */
  spaces: "_" | "-" | "%20"
}

export const DEFAULT_NORMALIZE: NormalizeOptions = {
  lowercase: true,
  stripDiacritics: true,
  spaces: "_",
}

/**
 * Dynamic placeholders filled in by ad platforms: Google Ads ValueTrack {keyword} and Meta
 * {{campaign.name}}. They must stay literal, unencoded and untouched by normalisation.
 */
const PLACEHOLDER = /\{\{[a-z0-9_.]+\}\}|\{[a-z0-9_:]+\}/gi

/** Applies the user's normalisation rules, leaving platform placeholders intact. */
export function normalizeUtmValue(value: string, options: NormalizeOptions): string {
  const parts = value.trim().split(PLACEHOLDER)
  const placeholders = value.trim().match(PLACEHOLDER) ?? []
  const clean = (text: string) => {
    let t = text.replace(/\s+/g, " ")
    if (options.lowercase) t = t.toLocaleLowerCase("pl-PL")
    if (options.stripDiacritics) t = stripDiacritics(t)
    if (options.spaces !== "%20") t = t.replace(/ /g, options.spaces)
    return t
  }
  return parts.map((part, i) => clean(part) + (placeholders[i] ?? "")).join("")
}

/** encodeURIComponent, except platform placeholders stay as written. */
export function encodeUtmValue(value: string): string {
  const parts = value.split(PLACEHOLDER)
  const placeholders = value.match(PLACEHOLDER) ?? []
  return parts
    .map((part, i) => encodeURIComponent(part) + (placeholders[i] ?? ""))
    .join("")
}

export type UrlCheck =
  { ok: true; url: URL; addedScheme: boolean } | { ok: false; reason: string }

/** Validates a landing page. A missing scheme gets https:// (and a note), not an error. */
export function checkUrl(raw: string): UrlCheck {
  const input = raw.trim()
  if (!input) return { ok: false, reason: "Podaj adres strony." }
  if (/\s/.test(input)) return { ok: false, reason: "Adres nie może zawierać spacji." }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(input)
  if (hasScheme && !/^https?:\/\//i.test(input)) {
    return { ok: false, reason: "Adres musi zaczynać się od http:// lub https://." }
  }

  let url: URL
  try {
    url = new URL(hasScheme ? input : `https://${input}`)
  } catch {
    return { ok: false, reason: "To nie wygląda na poprawny adres strony." }
  }
  const host = url.hostname
  if (!(host === "localhost" || /^[^.]+(\.[^.]+)+$/.test(host)) || host.endsWith(".")) {
    return { ok: false, reason: "Brakuje domeny, np. sklep.pl." }
  }
  return { ok: true, url, addedScheme: !hasScheme }
}

export interface BuildResult {
  url: string
  /** Query string with only the UTM parameters, for Google Ads "Final URL suffix". */
  suffix: string
  /** Existing UTM parameters in the address that the new values replaced. */
  replaced: { key: string; previous: string }[]
  /** Parameters already in the address and kept as they were. */
  kept: string[]
}

/** Lenient decoding: a malformed %-sequence in someone's URL must not crash the tool. */
const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "))
  } catch {
    return text
  }
}

const decodeKey = (piece: string) => safeDecode(piece.split("=")[0]).toLowerCase()

/**
 * Adds UTM parameters to a validated URL. Existing parameters are kept byte-for-byte in
 * their order; UTM keys we set replace earlier ones; the #fragment stays at the end.
 */
export function buildUtmUrl(url: URL, values: UtmValues): BuildResult {
  const utm = UTM_KEYS.filter((k) => values[k].trim() !== "").map(
    (k) => `${k}=${encodeUtmValue(values[k].trim())}`
  )
  const setKeys = new Set(UTM_KEYS.filter((k) => values[k].trim() !== ""))

  const existing = url.search.replace(/^\?/, "").split("&").filter(Boolean)
  const replaced: BuildResult["replaced"] = []
  const kept: string[] = []
  for (const piece of existing) {
    const key = decodeKey(piece)
    if (setKeys.has(key as UtmKey)) {
      const eq = piece.indexOf("=")
      replaced.push({ key, previous: eq === -1 ? "" : safeDecode(piece.slice(eq + 1)) })
    } else {
      kept.push(piece)
    }
  }

  const query = [...kept, ...utm].join("&")
  const base = `${url.origin}${url.pathname}`
  return {
    url: `${base}${query ? `?${query}` : ""}${url.hash}`,
    suffix: utm.join("&"),
    replaced,
    kept,
  }
}
