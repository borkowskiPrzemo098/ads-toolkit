import {
  Ban,
  FileChartColumn,
  FlaskConical,
  Link2,
  ListTree,
  PenLine,
  TrendingUp,
  Wallet,
} from "lucide-react"
import type { ToolMeta, ToolSlug } from "@/types/tool"

/** Single source of truth for tool names, order, routes and dashboard copy. */
export const TOOLS: ToolMeta[] = [
  {
    slug: "profitability",
    name: "Rentowność kampanii",
    description:
      "CPC, CPA, ROAS i ROI w jednym miejscu, z zyskiem po marży i kosztach produktu.",
    question: "Czy ta kampania naprawdę zarabia?",
    icon: TrendingUp,
    stage: 2,
    featured: true,
    inputs: [
      "Budżet reklamowy, kliknięcia i konwersje",
      "Przychód i średnia wartość zamówienia",
      "Marża procentowa",
      "Dodatkowe koszty i koszt produktu (opcjonalnie)",
    ],
    outputs: [
      "CPC, CPA, ROAS i ROI, liczone osobno",
      "Zysk po kosztach reklamy i po koszcie produktu",
      "Break-even ROAS, break-even CPA i maksymalny CPA",
      "Porównanie dwóch kampanii, eksport PDF i CSV",
    ],
  },
  {
    slug: "budget-planner",
    name: "Planer budżetu",
    description: "Prognoza kliknięć, konwersji i zysku dla wybranego budżetu.",
    question: "Co realnie kupię za ten budżet?",
    icon: Wallet,
    stage: 3,
    inputs: [
      "Budżet miesięczny i liczba dni kampanii",
      "Średni CPC i współczynnik konwersji",
      "Średnia wartość zamówienia i marża",
    ],
    outputs: [
      "Szacowane kliknięcia, konwersje, przychód i zysk",
      "Budżet dzienny i tygodniowy",
      "Trzy edytowalne scenariusze: ostrożny, realistyczny, optymistyczny",
      "Wykres zysku względem budżetu",
    ],
  },
  {
    slug: "keyword-analyzer",
    name: "Analizator słów kluczowych",
    description: "Porządkuje długie listy fraz: duplikaty, grupy, intencja.",
    question: "Co jest w mojej liście słów kluczowych?",
    icon: ListTree,
    stage: 4,
    inputs: ["Wklejona lista fraz albo plik TXT lub CSV", "Sposób rozdzielania danych"],
    outputs: [
      "Lista bez duplikatów i niemal identycznych fraz",
      "Grupy według podobieństwa i długości frazy",
      "Sugerowana intencja: zakupowa, informacyjna, lokalna, marka",
      "Filtrowanie, sortowanie i eksport",
    ],
  },
  {
    slug: "negative-keywords",
    name: "Wykluczające słowa kluczowe",
    navLabel: "Słowa wykluczające",
    description: "Sugestie wykluczeń z raportu wyszukiwanych haseł, do akceptacji.",
    question: "Na jakie zapytania przepalam budżet?",
    icon: Ban,
    stage: 5,
    inputs: [
      "Lista wyszukiwanych haseł albo raport CSV z Google Ads",
      "Słowa niepożądane i słowa, które mają zostać",
    ],
    outputs: [
      "Sugestie pogrupowane: darmowe, praca, używane, poradniki i inne",
      "Akceptacja lub odrzucenie każdej sugestii",
      "Wybór dopasowania: przybliżone, do wyrażenia, ścisłe",
      "Gotowa lista do wklejenia w Google Ads",
    ],
  },
  {
    slug: "utm-builder",
    name: "Generator UTM",
    description: "Poprawnie zakodowane linki z parametrami UTM, także hurtowo.",
    question: "Skąd naprawdę przychodzą moi klienci?",
    icon: Link2,
    stage: 6,
    inputs: [
      "Adres strony",
      "utm_source, utm_medium, utm_campaign",
      "utm_term i utm_content (opcjonalnie)",
    ],
    outputs: [
      "Gotowy link z zachowaniem istniejących parametrów",
      "Edytowalne szablony dla Google Ads, Facebooka i mailingu",
      "Historia linków z bieżącej sesji i eksport CSV",
    ],
  },
  {
    slug: "rsa-builder",
    name: "Kreator reklam RSA",
    description: "Nagłówki i teksty z licznikiem znaków, podglądem i przypinaniem.",
    question: "Czy moja reklama RSA mieści się w limitach?",
    icon: PenLine,
    stage: 7,
    inputs: [
      "Firma, produkt i grupa docelowa",
      "Słowa kluczowe, korzyści i wezwanie do działania",
      "Adres strony i szczegóły oferty",
    ],
    outputs: [
      "Propozycje z biblioteki formuł reklamowych",
      "Licznik znaków: 30 dla nagłówka, 90 dla tekstu",
      "Wykrywanie duplikatów i przypinanie nagłówków",
      "Podgląd reklamy i eksport",
    ],
  },
  {
    slug: "ab-testing",
    name: "Kalkulator testów A/B",
    description: "Test dwóch proporcji z przedziałem ufności i interpretacją.",
    question: "Czy wariant B jest naprawdę lepszy?",
    icon: FlaskConical,
    stage: 8,
    inputs: ["Kliknięcia, konwersje i koszt wariantu A", "To samo dla wariantu B"],
    outputs: [
      "Współczynnik konwersji i CPA obu wariantów",
      "Różnica bezwzględna i względna",
      "Istotność statystyczna (z-test, α = 0,05) i przedział ufności",
      "Ostrzeżenie, gdy próba jest za mała na wnioski",
    ],
  },
  {
    slug: "ppc-reports",
    name: "Raporty PPC",
    description: "Raport dla klienta z eksportu CSV: KPI, wykresy, wnioski, PDF.",
    question: "Jak pokazać klientowi wyniki w 10 minut?",
    icon: FileChartColumn,
    stage: 9,
    featured: true,
    inputs: [
      "Eksport CSV z Google Ads z mapowaniem kolumn",
      "Albo dane wpisane ręcznie",
      "Klient, kampania, okres i logo agencji",
    ],
    outputs: [
      "KPI i porównanie dwóch okresów",
      "Wykresy kosztów, kliknięć, konwersji i ROAS",
      "Edytowalne obserwacje, wnioski i rekomendacje",
      "Podgląd i eksport PDF oraz CSV",
    ],
  },
]

export const TOOL_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t])) as Record<
  ToolSlug,
  ToolMeta
>

export const toolHref = (slug: ToolSlug) => `/tools/${slug}`
