/**
 * Word lists behind the heuristic categories. Patterns run on lower-case text without
 * diacritics, so "kupić" is matched as "kupic". These are suggestions from the wording of a
 * phrase, not knowledge of real search intent.
 */

export type KeywordCategory =
  | "brand"
  | "navigational"
  | "price"
  | "location"
  | "transactional"
  | "research"
  | "informational"
  | "product"
  | "generic"

export type KeywordIntent =
  "purchase" | "research" | "informational" | "navigational" | "unknown"

const rx = (body: string) => new RegExp(`(?:^|\\s)(?:${body})(?=$|\\s)`)

export const SIGNALS: {
  category: Exclude<KeywordCategory, "brand" | "product" | "generic">
  pattern: RegExp
}[] = [
  {
    category: "navigational",
    pattern: rx(
      "logowanie|login|zaloguj\\w*|moje konto|www|kontakt\\w*|infolini\\w*|godziny otwarcia|numer telefonu|facebook|instagram|youtube|allegro|olx|ceneo|\\S+\\.(?:pl|com|eu|net)"
    ),
  },
  {
    category: "price",
    pattern: rx(
      "cena|ceny|cenie|cen|cennik\\w*|tani|tania|tanie|taniej|tanio|tanich|tanim|tanio|najtan\\w*|promocj\\w*|rabat\\w*|kupon\\w*|kod\\w* rabatow\\w*|wyprzedaz\\w*|outlet|okazj\\w*|koszt\\w*|darmow\\w*|za darmo|gratis|zl|pln"
    ),
  },
  {
    category: "location",
    pattern: rx(
      [
        "w poblizu|blisko mnie|blisko|okolic\\w*|najblizsz\\w*|dojazd|na mapie",
        // Largest Polish cities by stem; "łódź" also means a boat, so it stays a hint.
        "warszaw\\w*|krakow\\w*|krakow|lodz\\w*|wroclaw\\w*|poznan\\w*|gdansk\\w*|szczecin\\w*|bydgoszcz\\w*|lublin\\w*|bialymstoku|bialystok\\w*|katowic\\w*|gdyni\\w*|gdynia|czestochow\\w*|radom\\w*|torun\\w*|sosnowc\\w*|sosnowiec|kielc\\w*|rzeszow\\w*|gliwic\\w*|zabrz\\w*|olsztyn\\w*|bielsk\\w*|bytom\\w*|zielonej gorze|zielona gora|rybnik\\w*|opol\\w*|gorzow\\w*|elblag\\w*|plock\\w*|walbrzych\\w*|wloclaw\\w*|tarnow\\w*|chorzow\\w*|koszalin\\w*|kalisz\\w*|legnic\\w*|grudziadz\\w*|sopot\\w*|zakopan\\w*|trojmiast\\w*|slask\\w*|mazowsz\\w*|malopolsk\\w*|pomorz\\w*",
      ].join("|")
    ),
  },
  {
    category: "transactional",
    pattern: rx(
      "kup\\w*|kupno|sklep\\w*|zamow\\w*|zakup\\w*|sprzedaz\\w*|dostaw\\w*|wysylk\\w*|online|na raty|rezerwac\\w*|zarezerwuj|wynajem|wynajm\\w*|wypozycz\\w*|oferta|oferty|zlecenie|uslug\\w*|producent\\w*|hurtowni\\w*"
    ),
  },
  {
    category: "research",
    pattern: rx(
      "opini\\w*|ranking\\w*|najlepsz\\w*|porownani\\w*|porownywark\\w*|vs|czy warto|test\\w*|recenzj\\w*|polecan\\w*|forum"
    ),
  },
  {
    category: "informational",
    pattern: rx(
      "jak|co to|co to jest|czym|dlaczego|kiedy|ile|gdzie|poradnik\\w*|porad\\w*|instrukcj\\w*|przepis\\w*|wikipedia|definicj\\w*|znaczenie|historia|objaw\\w*|sposob\\w*|krok po kroku|samodzielnie|diy|pdf|wzor\\w*|szablon\\w*"
    ),
  },
]

/** Order used to pick the primary category when a phrase has several signals. */
export const CATEGORY_PRIORITY: KeywordCategory[] = [
  "brand",
  "navigational",
  "price",
  "location",
  "transactional",
  "research",
  "informational",
  "product",
  "generic",
]

export const INTENT_BY_CATEGORY: Record<KeywordCategory, KeywordIntent> = {
  brand: "navigational",
  navigational: "navigational",
  price: "purchase",
  location: "purchase",
  transactional: "purchase",
  research: "research",
  informational: "informational",
  product: "unknown",
  generic: "unknown",
}

/** Words that describe a query rather than its subject; skipped when naming topic groups. */
export function isModifier(text: string): boolean {
  return SIGNALS.some((s) => s.pattern.test(text))
}
