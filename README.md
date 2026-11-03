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
shadcn/ui (styl `base-nova`, prymitywy Base UI), Lucide, Vitest.
Recharts, PapaParse, Zod, date-fns i biblioteka PDF dochodzą w etapach, które ich wymagają.

## Struktura

```
app/                    trasy: / (panel) i /tools/<narzędzie>
components/
  ui/                   komponenty shadcn/ui (generowane, edytowane minimalnie)
  layout/               sidebar, nagłówek mobilny, Panel, ToolHeader, ToolIcon, stopka
  dashboard/            sekcje panelu głównego
  forms/                pola formularzy (NumberField)
  charts/ tables/ export/   kolejne etapy
constants/tools.ts      jedyne źródło nazw, kolejności, tras i opisów narzędzi
lib/
  calculations/         czysta logika obliczeń, osobny plik na narzędzie
  formatting/           formatowanie i parsowanie liczb (pl-PL)
  validators/ csv/ pdf/ kolejne etapy
  utils.ts              `cn` (alias wymagany przez shadcn)
hooks/                  hooki klienckie
types/                  typy współdzielone (CalcResult, ToolMeta)
tests/unit/             testy Vitest
```

`lib/utils` jest plikiem, nie katalogiem: shadcn/ui importuje `@/lib/utils`.

## Zasady

- Obliczenia żyją w `lib/calculations/*` i zwracają `CalcResult`: wartość albo powód,
  dla którego nie da się jej policzyć. UI pokazuje powód zamiast 0, NaN czy Infinity.
- Pola liczbowe przyjmują `12,5` i `12.5` (`parseDecimal`).
- localStorage przechowuje wyłącznie licznik odwiedzin narzędzi (sekcja „Najczęściej
  używasz”). Nigdy dane kampanii.

## Status etapów

| Etap | Zakres                       | Status       |
| ---- | ---------------------------- | ------------ |
| 0    | Przygotowanie projektu       | gotowy       |
| 1    | Design system i panel główny | gotowy       |
| 2–9  | Osiem narzędzi               | do zrobienia |
| 10   | Testy i optymalizacja        | do zrobienia |
| 11   | Publikacja                   | do zrobienia |
