/**
 * Word lists for negative-keyword suggestions. Patterns run on lower-case text without
 * diacritics ("używane" → "uzywane"). A hit is only a suggestion: for a repair shop "naprawa"
 * is the offer, which is why the offer words the user enters always win.
 */

export type NegativeCategory =
  "free" | "jobs" | "used" | "repair" | "howto" | "unrelated" | "competitor" | "custom"

export const DICTIONARIES: { category: NegativeCategory; patterns: string[] }[] = [
  {
    category: "free",
    patterns: [
      "za darmo",
      "darmow\\w*",
      "bezplatn\\w*",
      "gratis\\w*",
      "free",
      "torrent\\w*",
      "chomikuj\\w*",
      "crack\\w*",
    ],
  },
  {
    category: "jobs",
    patterns: [
      "oferty pracy",
      "praca",
      "pracy",
      "prace",
      "pracuj\\w*",
      "pracownik\\w*",
      "pracownic\\w*",
      "zatrudni\\w*",
      "rekrutacj\\w*",
      "wynagrodzeni\\w*",
      "zarobki",
      "zarabia\\w*",
      "pensj\\w*",
      "etat\\w*",
      "staz\\w*",
      "praktyki",
      "cv",
      "kariera",
      "job\\w*",
    ],
  },
  {
    category: "used",
    patterns: [
      "z drugiej reki",
      "drugiej reki",
      "second hand",
      "uzywan\\w*",
      "komis\\w*",
      "poleasingow\\w*",
      "odnowion\\w*",
      "refurbished",
      "olx",
      "otomoto",
    ],
  },
  {
    category: "repair",
    patterns: [
      "nie dziala",
      "czesci zamienne",
      "napraw\\w*",
      "serwis\\w*",
      "czesci",
      "czesc",
      "zamienn\\w*",
      "reklamacj\\w*",
      "zepsut\\w*",
      "usterk\\w*",
      "awari\\w*",
    ],
  },
  {
    category: "howto",
    patterns: [
      "krok po kroku",
      "co to jest",
      "co to",
      "jak",
      "poradnik\\w*",
      "instrukcj\\w*",
      "samodzielnie",
      "diy",
      "tutorial\\w*",
      "przepis\\w*",
      "schemat\\w*",
      "szablon\\w*",
      "wzor\\w*",
      "pdf",
      "definicj\\w*",
      "wikipedia",
      "forum",
    ],
  },
]

/** Compiles a pattern list into a global, whitespace-bounded matcher. */
export function compileMatcher(patterns: string[]): RegExp {
  return new RegExp(`(?<=^|\\s)(?:${patterns.join("|")})(?=$|\\s)`, "g")
}
