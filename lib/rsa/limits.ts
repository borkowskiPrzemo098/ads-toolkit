/** Google Ads responsive search ad limits. */
export const RSA = {
  headline: { max: 30, minCount: 3, maxCount: 15, positions: [1, 2, 3] as const },
  description: { max: 90, minCount: 2, maxCount: 4, positions: [1, 2] as const },
  path: { max: 15 },
} as const

export type AssetKind = "headline" | "description"
export type Pin = 1 | 2 | 3 | null

/**
 * Keyword insertion {KeyWord:buty} shows the default text when the keyword does not fit,
 * so Google counts the default text, not the syntax.
 */
const KEYWORD_INSERTION = /\{keyword:([^}]*)\}/gi

export function displayText(text: string): string {
  return text.replace(KEYWORD_INSERTION, "$1")
}

/** Characters as Google counts them for Polish text: one per letter, diacritics included. */
export function countChars(text: string): number {
  return Array.from(displayText(text)).length
}

export function limitOf(kind: AssetKind): number {
  return RSA[kind].max
}
