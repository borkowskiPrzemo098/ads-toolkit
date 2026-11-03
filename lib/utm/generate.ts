import {
  buildUtmUrl,
  checkUrl,
  MAX_URL_LENGTH,
  normalizeUtmValue,
  REQUIRED_UTM,
  UTM_KEYS,
  type BuildResult,
  type NormalizeOptions,
  type UtmKey,
  type UtmValues,
} from "./build"

/**
 * utm_medium values that GA4's default channel grouping understands (cpc, email, affiliate…).
 * Others are valid but the traffic may land in "Unassigned".
 */
const KNOWN_MEDIUMS =
  /^(cpc|ppc|paid.*|.*cp.*|retargeting|display|banner|interstitial|expandable|cpm|email|e-mail|e_mail|e mail|affiliate|social|social[-_ ]?network|social[-_ ]?media|sm|referral|organic|video|audio|sms|push|mobile|notification|\{.*\})$/

export interface UtmLink extends BuildResult {
  values: UtmValues
}

export type UtmGeneration =
  | {
      ok: true
      link: UtmLink
      /** Things the user should know, e.g. "added https://". */
      notes: string[]
      warnings: string[]
    }
  | {
      ok: false
      urlError: string | null
      fieldErrors: Partial<Record<UtmKey, string>>
    }

const REQUIRED_MESSAGE: Partial<Record<UtmKey, string>> = {
  utm_source: "Podaj źródło, np. google albo newsletter.",
  utm_medium: "Podaj medium, np. cpc albo email.",
  utm_campaign: "Podaj nazwę kampanii.",
}

export function normalizeUtmValues(
  values: UtmValues,
  options: NormalizeOptions
): UtmValues {
  return Object.fromEntries(
    UTM_KEYS.map((k) => [k, normalizeUtmValue(values[k], options)])
  ) as UtmValues
}

export function generateUtmLink(
  rawUrl: string,
  rawValues: UtmValues,
  options: NormalizeOptions
): UtmGeneration {
  const check = checkUrl(rawUrl)
  const values = normalizeUtmValues(rawValues, options)

  const fieldErrors: Partial<Record<UtmKey, string>> = {}
  for (const key of REQUIRED_UTM) {
    if (!values[key]) fieldErrors[key] = REQUIRED_MESSAGE[key]
  }
  if (!check.ok || Object.keys(fieldErrors).length) {
    return { ok: false, urlError: check.ok ? null : check.reason, fieldErrors }
  }

  const link = { ...buildUtmUrl(check.url, values), values }
  const notes: string[] = []
  const warnings: string[] = []

  if (check.addedScheme) notes.push("Dodaliśmy https:// na początku adresu.")
  if (link.kept.length) {
    notes.push(`Zachowaliśmy parametry, które były już w adresie: ${link.kept.length}.`)
  }
  for (const r of link.replaced) {
    warnings.push(
      `Adres miał już ${r.key}=${r.previous}. Zastąpiliśmy go nową wartością.`
    )
  }
  if (!KNOWN_MEDIUMS.test(values.utm_medium.toLowerCase())) {
    warnings.push(
      `Medium „${values.utm_medium}” jest nietypowe. GA4 może przypisać ten ruch do kanału „Unassigned”; częste wartości to cpc, email, display, affiliate, social.`
    )
  }
  if (
    !options.lowercase &&
    /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(values.utm_source + values.utm_medium)
  ) {
    warnings.push(
      "GA4 rozróżnia wielkość liter: „Google” i „google” to dwa różne źródła. Lepiej pisać małymi literami."
    )
  }
  if (link.url.length > MAX_URL_LENGTH) {
    warnings.push(
      `Link ma ${link.url.length} znaków. Powyżej 2000 niektóre przeglądarki go obetną.`
    )
  }
  return { ok: true, link, notes, warnings }
}

export interface BulkRow {
  line: number
  input: string
  result: UtmGeneration
}

/** One link per non-empty line, all with the same UTM values. Invalid lines are reported. */
export function generateBulk(
  text: string,
  values: UtmValues,
  options: NormalizeOptions
): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((input, index) => ({ line: index + 1, input: input.trim() }))
    .filter((row) => row.input)
    .map((row) => ({ ...row, result: generateUtmLink(row.input, values, options) }))
}
