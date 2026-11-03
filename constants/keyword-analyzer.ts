import type {
  KeywordStatus,
  LengthGroup,
  Separator,
} from "@/lib/calculations/keyword-analyzer"
import type { KeywordSort, StatusFilter } from "@/lib/keywords/filter"
import type { KeywordCategory, KeywordIntent } from "@/lib/keywords/signals"

export const CATEGORY_LABEL: Record<KeywordCategory, string> = {
  brand: "Marka",
  navigational: "Nawigacyjne",
  price: "Cena i promocja",
  location: "Lokalizacja",
  transactional: "Transakcyjne",
  research: "Porównawcze",
  informational: "Informacyjne",
  product: "Produktowe",
  generic: "Ogólne",
}

/** Display order of category chips: the commercially useful ones first. */
export const CATEGORY_ORDER: KeywordCategory[] = [
  "transactional",
  "price",
  "location",
  "product",
  "research",
  "informational",
  "navigational",
  "brand",
  "generic",
]

export const INTENT_LABEL: Record<KeywordIntent, string> = {
  purchase: "Zakupowa",
  research: "Przed zakupem",
  informational: "Informacyjna",
  navigational: "Nawigacyjna",
  unknown: "Nieokreślona",
}

export const STATUS_LABEL: Record<KeywordStatus, string> = {
  unique: "Unikalna",
  duplicate: "Duplikat",
  "near-duplicate": "Podobna",
}

export const LENGTH_LABEL: Record<LengthGroup, string> = {
  short: "1 słowo",
  medium: "2–3 słowa",
  long: "4+ słów (długi ogon)",
}

export const SEPARATOR_OPTIONS: { value: Separator; label: string }[] = [
  { value: "auto", label: "Automatycznie" },
  { value: "newline", label: "Każdy wiersz" },
  { value: "comma", label: "Przecinek" },
  { value: "semicolon", label: "Średnik" },
  { value: "tab", label: "Tabulator" },
]

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "clean", label: "Bez duplikatów" },
  { value: "issues", label: "Duplikaty i podobne" },
]

export const SORT_OPTIONS: { value: KeywordSort; label: string }[] = [
  { value: "input", label: "Kolejność z listy" },
  { value: "alpha", label: "Alfabetycznie" },
  { value: "words-desc", label: "Najdłuższe najpierw" },
  { value: "category", label: "Według kategorii" },
]

export const HEURISTIC_NOTE =
  "Kategorie i intencje to sugestie na podstawie słów we frazie. Narzędzie nie zna liczby wyszukiwań ani prawdziwej intencji użytkowników, więc każdą sugestię sprawdź."
