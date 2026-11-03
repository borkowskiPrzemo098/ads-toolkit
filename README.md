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
  pdf/                  raport tabelaryczny jsPDF z czcionką Geist (polskie znaki)
  csv/                  odczyt plików (BOM, UTF-16, limit 5 MB) i import CSV
  keywords/             normalizacja, polski stemmer, słowniki sygnałów, filtrowanie
  negatives/            słowniki sugestii wykluczeń (darmowe, praca, używane…)
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
| 6–9  | Pozostałe narzędzia          | do zrobienia |
| 10   | Testy i optymalizacja        | do zrobienia |
| 11   | Publikacja                   | do zrobienia |
