# Ads Toolkit dla Google Ads

Osiem narzędzi dla osób prowadzących kampanie Google Ads: rentowność, planer budżetu,
analizator słów kluczowych, wykluczenia, generator UTM, kreator RSA, testy A/B i raporty PPC.

**Wersja publiczna:** https://borkowskiprzemo098.github.io/ads-toolkit/

- Interfejs po polsku, Premium Dark.
- Bez logowania, bez Google Ads API, bez płatnych usług.
- Wszystkie obliczenia i pliki CSV przetwarzane lokalnie w przeglądarce.

## Uruchomienie

```bash
npm install
npm run dev        # http://localhost:3000
```

| Skrypt                | Co robi                                      |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | serwer deweloperski                          |
| `npm run build`       | statyczny eksport do `out/` (+ `fix-export`) |
| `npm run build:pages` | build z `PAGES_BASE_PATH=/ads-toolkit`       |
| `npm start`           | serwuje `out/` jak GitHub Pages (port 3420)  |
| `npm run typecheck`   | `next typegen` + `tsc --noEmit`              |
| `npm run lint`        | ESLint (konfiguracja Next.js)                |
| `npm test`            | testy jednostkowe Vitest                     |
| `npm run check`       | typecheck + lint + testy                     |
| `npm run test:e2e`    | `build:pages` + testy E2E Playwright         |
| `npm run format`      | Prettier z sortowaniem klas Tailwind         |

Testy E2E (`tests/e2e/`) działają na statycznym eksporcie serwowanym pod `/ads-toolkit/`,
tak jak w GitHub Pages (`scripts/serve-static.mjs`), więc wyłapują też linki i zasoby
bez ścieżki bazowej. Przy pierwszym uruchomieniu
zainstaluj przeglądarki: `npx playwright install chromium webkit firefox`.

- `smoke.spec.ts` (tag `@smoke`): każda trasa w Chromium, Pixel 7, WebKit i Firefox:
  nagłówek, tytuł, brak poziomego przewijania, axe WCAG 2.1 AA (błędy serious/critical),
  brak błędów konsoli, nawigacja, strona 404.
- `tools.spec.ts` (Chromium): jeden pełny scenariusz na narzędzie z wartościami
  sprawdzonymi w testach jednostkowych, zakończony eksportem (CSV, TXT, PDF). Po każdym
  scenariuszu ponowny audyt axe z wynikami na ekranie i brak błędów konsoli (wyłapuje też
  blokady CSP).

Znany problem: na stacji, na której powstał projekt, Playwright nie uruchamia Firefoksa
(`browserType.launch: spawn UNKNOWN`). Firefox będzie testowany w GitHub Actions po włączeniu workflow (sekcja Publikacja).

## Publikacja

- Hosting: GitHub Pages, repozytorium `borkowskiPrzemo098/ads-toolkit`, HTTPS z
  certyfikatem GitHub. Adresy, wersja i data dokumentów prawnych: `constants/site.ts`.
- Publikacja: `npm run deploy` buduje stronę, uruchamia testy E2E (Chromium, Pixel 7,
  WebKit; Firefox lokalnie się nie uruchamia) i dopiero po ich
  przejściu wypycha `out/` na gałąź `gh-pages` (Pages: „Deploy from a branch”).
  `public/.nojekyll` wyłącza Jekylla, który pomijałby katalog `_next`.
- CI (nieaktywne): `docs/ci/pages.yml` uruchamia check i E2E na Chromium, Pixel 7,
  Firefox i WebKit, a potem publikuje przez Actions. Aby je włączyć: `gh auth refresh -h
github.com -s workflow`, przenieś plik do `.github/workflows/`, w Settings → Pages
  ustaw źródło „GitHub Actions”.
- Eksport statyczny (`output: "export"`, `trailingSlash`). Cache Components/PPR są
  wyłączone, bo tryb eksportu ich nie obsługuje; wszystkie trasy i tak są statyczne.
- `scripts/fix-export.mjs` obchodzi błąd Next.js 16.4: zapisuje dane prefetchu
  (`__next.tools.x.__PAGE__.txt`) pod nazwami, o które prosi router. Bez tego każdy
  prefetch kończy się 404, a linki przeładowują całą stronę. Test smoke wykrywa regresję
  (błędy konsoli).
- SEO: tytuły i opisy każdej strony, adresy kanoniczne (`pageUrl`), Open Graph z obrazem
  `app/opengraph-image.png`, `sitemap.xml`, `robots.txt`, favicon SVG i ikona Apple.
  `metadataBase` to sama domena: Next.js sam dokleja ścieżkę bazową do obrazów.
- Strony informacyjne: `/o-aplikacji`, `/prywatnosc`, `/regulamin` (linki w stopce).
- Własna domena: dodaj plik `public/CNAME`, ustaw DNS (CNAME na
  `borkowskiprzemo098.github.io`), zmień `SITE_URL` w `constants/site.ts` i
  `PAGES_BASE_PATH` na pusty w `scripts/build-pages.mjs` (i w workflow) oraz `BASE_PATH` w `playwright.config.ts`.
  `robots.txt` zacznie wtedy działać (w podkatalogu roboty go nie czytają).

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
tests/e2e/              testy Playwright (smoke na 4 silnikach, scenariusze narzędzi)
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
- Bezpieczeństwo: build produkcyjny ma CSP w znaczniku meta (`app/layout.tsx`, działa też
  na hostingu statycznym): tylko własne zasoby, `connect-src 'self'`, `object-src 'none'`,
  `form-action 'none'`, oraz `referrer: no-referrer`. `'unsafe-inline'` dla skryptów
  wynika z inline'owych skryptów Next.js (nonce wymaga serwera). Brak
  `dangerouslySetInnerHTML`, `eval` i zapytań poza własne fonty PDF. `npm audit --omit=dev`:
  0 podatności (zgłoszenia dotyczą tylko narzędzi deweloperskich: ESLint, CLI shadcn).
- Wydajność: jsPDF i Recharts ładują się osobno, dopiero gdy są potrzebne
  (`components/charts/lazy.tsx`). Startowy JS: ok. 220–240 KB gzip na trasę.
- Szerokie tabele: `TableScroll` (fokusowalny region, przewijanie strzałkami).

## Status etapów

| Etap | Zakres                       | Status |
| ---- | ---------------------------- | ------ |
| 0    | Przygotowanie projektu       | gotowy |
| 1    | Design system i panel główny | gotowy |
| 2    | Kalkulator rentowności       | gotowy |
| 3    | Planer budżetu               | gotowy |
| 4    | Analizator słów kluczowych   | gotowy |
| 5    | Generator wykluczeń          | gotowy |
| 6    | Generator UTM                | gotowy |
| 7    | Kreator reklam RSA           | gotowy |
| 8    | Kalkulator testów A/B        | gotowy |
| 9    | Generator raportów PPC       | gotowy |
| 10   | Testy i optymalizacja        | gotowy |
| 11   | Publikacja                   | gotowy |
