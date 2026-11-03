/**
 * Text helpers for Polish keyword lists. Deliberately simple and predictable: the analyzer
 * makes suggestions, so a crude but explainable rule beats an opaque one.
 */

const DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
}

export function stripDiacritics(text: string): string {
  return text.replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch])
}

/**
 * Normalised form used for exact duplicates: lower case, single spaces, Google Ads match-type
 * syntax removed ([exact], "phrase", +modifier) and stray punctuation trimmed.
 */
export function normalizeKeyword(raw: string): string {
  return raw
    .normalize("NFC")
    .toLocaleLowerCase("pl-PL")
    .replace(/^\s*[\[\"]+|[\]\"]+\s*$/g, "")
    .replace(/(^|\s)\+(?=\S)/g, "$1")
    .replace(/[\t\r\n ]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?'-]+|[\s.,;:!?'-]+$/g, "")
}

/** Short words that do not change what a phrase is about. */
export const STOPWORDS = new Set([
  "a",
  "i",
  "w",
  "we",
  "z",
  "ze",
  "na",
  "do",
  "od",
  "dla",
  "o",
  "po",
  "pod",
  "przy",
  "u",
  "oraz",
  "lub",
  "albo",
  "czy",
  "sie",
  "to",
  "co",
  "jest",
  "sa",
  "byc",
  "ma",
  "maja",
  "moze",
  "nie",
  "tak",
  "ten",
  "ta",
  "te",
  "jaki",
  "jaka",
  "jakie",
  "ktory",
  "ktora",
  "ktore",
  "moj",
  "twoj",
  "the",
  "and",
  "for",
  "of",
])

// Longest endings first, so "ami" wins over "i".
const ENDINGS = [
  "owie",
  "ami",
  "ach",
  "ego",
  "emu",
  "ymi",
  "imi",
  "ich",
  "ych",
  "iej",
  "ow",
  "om",
  "ej",
  "ie",
  "iu",
  "a",
  "e",
  "i",
  "y",
  "o",
  "u",
]

/**
 * Light Polish stemmer: folds diacritics and cuts one common inflection ending, keeping at
 * least 3 letters. "butów" and "buty" → "but"; "damskie" and "damski" → "damsk".
 */
export function stem(word: string): string {
  const base = stripDiacritics(word)
  if (base.length <= 3 || /\d/.test(base)) return base
  for (const ending of ENDINGS) {
    if (base.endsWith(ending) && base.length - ending.length >= 3) {
      return base.slice(0, -ending.length)
    }
  }
  return base
}

export function words(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean)
}

/**
 * Key for near-duplicates: same meaningful stems in any order, ignoring diacritics and
 * stopwords. "buty damskie", "damskie buty" and "butów damskich" share one key.
 */
export function nearDuplicateKey(normalized: string): string {
  const stems = words(normalized)
    .filter((w) => !STOPWORDS.has(stripDiacritics(w)))
    .map(stem)
  return [...new Set(stems)].sort().join(" ")
}
