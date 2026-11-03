import type {
  Decision,
  MatchType,
  NegativeCategory,
} from "@/lib/calculations/negative-keywords"

export const NEGATIVE_CATEGORIES: {
  id: NegativeCategory
  label: string
  description: string
}[] = [
  {
    id: "free",
    label: "Darmowe",
    description: "Szukający czegoś za darmo rzadko płacą.",
  },
  {
    id: "jobs",
    label: "Praca i zatrudnienie",
    description: "Kandydaci do pracy, nie klienci.",
  },
  {
    id: "used",
    label: "Używane",
    description: "Rynek wtórny, komisy, ogłoszenia.",
  },
  {
    id: "repair",
    label: "Naprawa i serwis",
    description: "Naprawy i części, gdy ich nie oferujesz.",
  },
  {
    id: "howto",
    label: "Instrukcje i poradniki",
    description: "Pytania informacyjne, rzadko kończą się zakupem.",
  },
  {
    id: "unrelated",
    label: "Niepowiązane produkty",
    description: "Słowa z zapytań bez żadnego słowa z Twojej oferty.",
  },
  {
    id: "competitor",
    label: "Konkurencja",
    description: "Nazwy firm z Twojej listy konkurencji.",
  },
  {
    id: "custom",
    label: "Inne (Twoja lista)",
    description: "Słowa, które sam(a) oznaczasz jako niepożądane.",
  },
]

export const CATEGORY_LABEL = Object.fromEntries(
  NEGATIVE_CATEGORIES.map((c) => [c.id, c.label])
) as Record<NegativeCategory, string>

export const MATCH_TYPE_OPTIONS: { value: MatchType; label: string }[] = [
  { value: "broad", label: "Przybliżone" },
  { value: "phrase", label: "Do wyrażenia" },
  { value: "exact", label: "Ścisłe" },
]

export const MATCH_TYPE_LABEL = Object.fromEntries(
  MATCH_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<MatchType, string>

export const MATCH_TYPE_HINT: Record<MatchType, string> = {
  broad:
    "Blokuje zapytania zawierające wszystkie słowa wykluczenia, w dowolnej kolejności.",
  phrase: "Blokuje zapytania zawierające te słowa w tej kolejności.",
  exact:
    "Blokuje tylko identyczne zapytania, dlatego eksportujemy całe wyszukiwane hasła.",
}

export type DecisionFilter = Decision | "all"

export const DECISION_FILTER_OPTIONS: { value: DecisionFilter; label: string }[] = [
  { value: "pending", label: "Do decyzji" },
  { value: "accepted", label: "Zaakceptowane" },
  { value: "rejected", label: "Odrzucone" },
  { value: "all", label: "Wszystkie" },
]
