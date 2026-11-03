# Ads Toolkit dla Google Ads

Osiem narzędzi dla osób prowadzących kampanie Google Ads: rentowność, planer budżetu,
analizator słów kluczowych, wykluczenia, generator UTM, kreator RSA, testy A/B i raporty PPC.

- Interfejs po polsku, Premium Dark.
- Bez logowania, bez Google Ads API, bez płatnych usług.
- Wszystkie obliczenia i pliki CSV przetwarzane lokalnie w przeglądarce.

## Uruchomienie

```bash
npm install
npm run dev        # http://localhost:3000
```

| Skrypt              | Co robi                                       |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | serwer deweloperski                           |
| `npm run build`     | build produkcyjny (wszystkie trasy statyczne) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`               |
| `npm run lint`      | ESLint (konfiguracja Next.js)                 |
| `npm test`          | testy jednostkowe Vitest                      |
| `npm run check`     | typecheck + lint + testy                      |
| `npm run format`    | Prettier z sortowaniem klas Tailwind          |

## Stos

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4,
shadcn/ui (styl `base-nova`, prymitywy Base UI), Lucide, Vitest, jsPDF (ładowany na żądanie), Recharts, PapaParse.
Zod i date-fns dochodzą w etapach, które ich wymagają.

## Struktura

```
app/                    trasy: / (panel) i /tools/<narzędzie>
components/
  ui/                   komponenty shadcn/ui (generowane, edytowane minimalnie)
  layout/               sidebar, nagłówek mobilny, Panel, ToolHeader, ToolIcon, stopka
  dashboard/            sekcje panelu głównego
  forms/                pola formularzy (NumberField)
  charts/               wykresy (ProfitWaterfall, ProfitCurveChart na Recharts)
  export/               przyciski eksportu CSV i PDF
  tools/<narzędzie>/    komponenty konkretnego narzędzia
constants/tools.ts      jedyne źródło nazw, kolejności, tras i opisów narzędzi
lib/
  calculations/         czysta logika obliczeń, osobny plik na narzędzie
  formatting/           formatowanie i parsowanie liczb (pl-PL)
  validators/           walidacja formularzy: wspólne parseNumericForm + reguły narzędzi
  export/               CSV (ochrona przed formułami), pobieranie, modele raportów
  pdf/                  jsPDF z czcionką Geist: wspólny dokument, raport tabelaryczny,
                        raport PPC dla klienta (okładka, KPI, wykresy, teksty)
  csv/                  odczyt plików (BOM, UTF-16, limit 5 MB) i import CSV
  keywords/             normalizacja, polski stemmer, słowniki sygnałów, filtrowanie
  negatives/            słowniki sugestii wykluczeń (darmowe, praca, używane…)
  utm/                  budowa linków UTM, normalizacja, szablony, historia sesji
  rsa/                  limity RSA, zasady redakcyjne, biblioteka formuł, podgląd
  stats/                rozkład normalny (CDF, wartości p)
  reports/              import raportów (mapowanie kolumn, daty), agregacja, teksty
  utils.ts              `cn` (alias wymagany przez shadcn)
hooks/                  hooki klienckie
types/                  typy współdzielone (CalcResult, ToolMeta)
tests/unit/             testy Vitest
```

`lib/utils` jest plikiem, nie katalogiem: shadcn/ui importuje `@/lib/utils`.

## Zasady

- Obliczenia żyją w `lib/calculations/*` i zwracają `CalcResult`: wartość albo powód,
  dla którego nie da się jej policzyć. UI pokazuje powód zamiast 0, NaN czy Infinity.
- Eksport CSV: separator `;`, przecinek dziesiętny, BOM (Excel PL). Tekst zaczynający się od
  `= + - @` dostaje apostrof. PDF osadza Geist z `public/fonts` (licencja OFL obok).
- Prognozy (planer budżetu) zawsze z dopiskiem, że to nie gwarancja. Założenia scenariuszy
  i wzrostu CPC przy większym budżecie są jawne i edytowalne.
- Kolory serii na wykresach sprawdzone walidatorem palety (daltonizm, kontrast); linie
  scenariuszy mają też różny wzór kreski.
- Analizator słów kluczowych: kategorie i intencje to heurystyki na podstawie słów we
  frazie (`lib/keywords/signals.ts`), zawsze opisane w UI jako sugestie. Każda fraza z
  wejścia ma wiersz w wyniku i w eksporcie CSV; puste wiersze i nadmiar ponad limit są
  raportowane.
- Generator wykluczeń: żadna sugestia nie trafia na listę ani do eksportu bez kliknięcia
  „Wyklucz”. Masowa akceptacja pomija sugestie z konwersjami. Eksportujemy każdą formę
  słowa (wykluczenia nie obejmują odmian); dopasowanie ścisłe eksportuje całe hasła.
- Generator UTM: istniejące parametry adresu zostają bez zmian, #fragment na końcu,
  znaczniki {keyword} i {{ad.name}} nie są kodowane. Historia linków żyje w
  sessionStorage (znika po zamknięciu karty).
- Kreator RSA: propozycje z szablonów i danych użytkownika, bez AI i bez dopisywania
  obietnic; widoczne są tylko teksty w limicie. Walidacja zasad Google Ads (wykrzykniki,
  emoji, powtórzenia, wielkie litery, telefon) jest heurystyczna, a wskazówki nie są oceną
  skuteczności Google.
- Test A/B: dwustronny test z dla dwóch proporcji (α = 0,05), przedziały Wilsona i
  Newcombe’a, liczebność próby dla mocy 80%. Testy sprawdzają wyniki na niezależnie
  policzonych przykładach. Bez wystarczającej próby (oczekiwane < 5 konwersji lub
  braków konwersji w wariancie) narzędzie nie wydaje werdyktu.
- Raporty PPC: import CSV zawsze przez krok mapowania kolumn z podglądem; nieczytelne
  wiersze są wypisywane z numerem. Teksty raportu opisują liczby i sugerują, co sprawdzić;
  nie podają przyczyn zmian. Wszystkie teksty można edytować przed eksportem.
- Pola liczbowe przyjmują `12,5` i `12.5` (`parseDecimal`).
- localStorage przechowuje wyłącznie licznik odwiedzin narzędzi (sekcja „Najczęściej
  używasz”). Nigdy dane kampanii.

## Status etapów

| Etap | Zakres                       | Status       |
| ---- | ---------------------------- | ------------ |
| 0    | Przygotowanie projektu       | gotowy       |
| 1    | Design system i panel główny | gotowy       |
| 2    | Kalkulator rentowności       | gotowy       |
| 3    | Planer budżetu               | gotowy       |
| 4    | Analizator słów kluczowych   | gotowy       |
| 5    | Generator wykluczeń          | gotowy       |
| 6    | Generator UTM                | gotowy       |
| 7    | Kreator reklam RSA           | gotowy       |
| 8    | Kalkulator testów A/B        | gotowy       |
| 9    | Generator raportów PPC       | gotowy       |
| 10   | Testy i optymalizacja        | do zrobienia |
| 11   | Publikacja                   | do zrobienia |
