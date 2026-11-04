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
- `responsive.spec.ts` (tag `@responsive`, Chromium i WebKit): każda strona, pusta i
  wypełniona dużymi liczbami, na 6 szerokościach (320, 390, telefon poziomo, 768, 1024,
  1440). Błąd przy poziomym przewijaniu strony, elementach poza ekranem, uciętym
  tekście, tekście poniżej 11 px i polach dotyku poniżej 24×24 px (`layout-audit.ts`).
  Celowe wyjątki oznacza się w kodzie: `data-truncate-ok`, dekoracje `aria-hidden`.
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

## Audyt kampanii (Campaign Auditor)

Moduł w budowie pod `/tools/campaign-auditor` (ukryty w menu, panelu i mapie strony do
czasu ukończenia: `hidden: true` w `constants/tools.ts`, strona ma `noindex`).

| Etap | Zakres                                                    | Status       |
| ---- | --------------------------------------------------------- | ------------ |
| 1    | Analiza projektu i plan                                   | gotowy       |
| 2    | Import CSV/XLSX, rozpoznawanie raportów, mapowanie kolumn | gotowy       |
| 3    | Normalizacja i łączenie danych                            | gotowy       |
| 4    | Dashboard KPI i wykresy                                   | gotowy       |
| 5    | Audyt kampanii i słów kluczowych                          | gotowy       |
| 6    | Wyszukiwane hasła, urządzenia, lokalizacje, godziny       | gotowy       |
| 7    | Rekomendacje i indeks efektywności                        | do zrobienia |
| 8    | Rentowność i porównanie okresów                           | do zrobienia |
| 9    | Raport PDF i plan działań                                 | do zrobienia |
| 10   | Testy, wydajność, bezpieczeństwo, regresja                | do zrobienia |

Import (`lib/auditor/`):

- `parse.ts`: CSV (separator `,` `;` lub tabulator wykrywany z cudzysłowami, UTF-8/UTF-16)
  i XLSX (`read-excel-file`, ładowany tylko dla XLSX). Format z zawartości pliku, nie z
  rozszerzenia. Limity: 50 MB i 300 000 wierszy na plik. Parsowanie w Web Workerze
  (`parse.worker.ts`, CSP `worker-src`), z awaryjnym parsowaniem na głównym wątku.
- `columns.ts`: słownik nagłówków Google Ads PL/EN → pola modelu. Wskaźniki pochodne (CTR,
  CPA, ROAS…) są rozpoznawane, ale nigdy sumowane: KPI liczymy od nowa z metryk bazowych.
- `detect.ts`: typ raportu z najbardziej szczegółowego wymiaru (hasło → słowo → reklama →
  … → kampania), kolumny wymagane i przydatne dla każdego typu.
- `import.ts`: wiersz nagłówka pod tytułem i zakresem dat, okres z kolumny dat albo z linii
  nad nagłówkiem, wiersze „Razem/Total” i powtórzone nagłówki pomijane z informacją,
  duplikaty zgłaszane (pomijane tylko na życzenie), błędne i ujemne liczby, brakujące
  kolumny. XLSX: liczby kanoniczne (`41.333`), CSV: format PL i EN.
- `summary.ts`: uwagi do zestawu (różne okresy, dwa raporty tego samego typu, z którego
  raportu liczone są sumy, łączenie bez identyfikatorów).
- Mapowanie kolumn zapamiętywane w ramach audytu po sygnaturze nagłówka.

Normalizacja i łączenie:

- `normalize.ts`: warstwa znormalizowana obok surowych wierszy (te zostają bez zmian).
  Urządzenia, typy dopasowania (z „wariantem bliskim”), stany kampanii, dni tygodnia i
  godziny PL/EN do wartości kanonicznych; ID tylko cyfry; każdy rekord pamięta wiersz pliku.
  Pusta komórka lub „--” = 0, komórka niebędąca liczbą = brak (zgłoszona przy imporcie).
  Waluta z kolumny waluty albo z symboli w kwotach; bez niej kwoty bez symbolu.
- `join.ts`: sumy konta z jednego raportu najwyższego poziomu (kampanie > grupy > …,
  potem najdłuższy okres). Kampanie łączone po ID; nazwa, która w którymkolwiek raporcie
  ma jedno ID, pożycza to ID; nazwa z wieloma ID nie jest łączona. Każdy raport jest
  porównany z sumami: w obrębie kampanii, które obejmuje (np. urządzenia dla 1 z 4
  kampanii) albo z całym kontem. Wyższa suma = ostrzeżenie; niższa = znane powody
  (próg prywatności haseł, kampanie bez słów kluczowych). Ostrzeżenia: kampanie spoza
  raportu sum, różne konta, różne waluty, inny okres.
- `metrics.ts`: wzory KPI wspólne z Raportami PPC (`lib/reports/aggregate.ts`).

Dashboard (`dashboard.ts`, `components/tools/campaign-auditor/audit-dashboard.tsx`):

- 10 KPI: koszt, kliknięcia, wyświetlenia, CTR, śr. CPC, konwersje, współczynnik konwersji,
  CPA, wartość konwersji, ROAS. Brak kolumny lub zerowy mianownik = N/D z powodem.
  ROAS opisany jako przychód względem kosztu, nie zysk.
- Wszystkie liczby z jednego raportu, nazwanego na ekranie: raport sum konta, a gdy filtr
  wymaga wymiaru, którego nie ma (urządzenie, lokalizacja, dzień), najwyższy raport, który
  go ma, z wyjaśnieniem. Filtrów, na które nie odpowiada żaden raport, nie zastępujemy zerami.
- Filtry: kampania, typ, stan, urządzenie, lokalizacja, okres (pokazywane tylko, gdy dane je
  mają). Wykresy: koszt, konwersje i ROAS w czasie (dziennie; tygodniowo powyżej 62 dni),
  udział kampanii w budżecie, koszt, konwersje i CPA według kampanii (CPA z liczbą
  konwersji; kampanie bez konwersji wypisane osobno).
- Fixture z segmentem „Dzień”: `kampanie-dzienne.csv`.

Silnik audytu (`audit.ts`, `rules/*`, `findings.ts`, `stats.ts`, `thresholds.ts`):

- Każde wykrycie: nazwa, ważność (krytyczny/wysoki/średni/niski/informacyjny), opis,
  dowody liczbowe, możliwa przyczyna (bez przesądzania), rekomendowane działanie,
  szacowany wpływ tylko jako prosty rachunek na danych okresu, pewność, źródło (raport,
  wymiar, okres, sposób obliczenia).
- Punkt odniesienia: średnie konta (słowa kluczowe: średnie raportu słów) albo cele
  CPA/ROAS podane przez użytkownika. Reguła działa dopiero, gdy test dwumianowy liczby
  konwersji daje p < 0,05; pewność: p < 0,001 wysoka, < 0,01 średnia. Brak konwersji jest
  istotny od liczby kliknięć, przy której (1 − CR)ⁿ < 5%. Mniejsze próby trafiają do
  „za mało danych” i nigdy nie dostają rekomendacji wykluczenia.
- Kampanie: A1 wysoki koszt / mało konwersji, A2 wysoki CPA (nie, gdy ROAS ≥ konta),
  A3 niski ROAS, A4 koncentracja budżetu, A6 niski CTR w obrębie typu kampanii,
  A7 duży ruch / niska konwersja, A8 kandydaci do większego budżetu (z zastrzeżeniem
  o braku danych o udziale w wyświetleniach), A9 wahania CPA między połowami okresu,
  A10 za mało danych.
- Słowa kluczowe: B1 koszt bez konwersji, B2 bardzo wysoki CPA, B3 dużo kliknięć / niska
  konwersja, B4 wysoki CTR i konwersja, B5 bardzo niski CTR, B6 to samo słowo w kilku
  grupach, B7 drogie słowa do weryfikacji, B8 kandydaci do budżetu/testów, B0 za mało
  danych. Maks. 12 wykryć na regułę, reszta w podsumowaniu.
- Progi z uzasadnieniem w `thresholds.ts`, pokazywane w aplikacji pod „Jak liczymy”.
  Kategoria „krytyczny” nie jest przyznawana przez żadną z obecnych reguł.
- Fixtures scenariuszy: `kampanie-audyt.csv`, `slowa-kluczowe-audyt.csv` (wartości
  oczekiwane policzone ręcznie w `tests/unit/auditor-rules.test.ts`).
- Ekran „Kontrola danych” po zatwierdzeniu importu: sumy konta i ich źródło, zgodność
  raportów, kampanie i sposób łączenia. 200 000 wierszy: import ok. 2 s, normalizacja i
  łączenie ok. 2 s.
- Pliki testowe: `tests/fixtures/auditor/` (generator `generate.py`, wymaga `openpyxl`).
  200 000 wierszy (26 MB) wczytuje się w ok. 2 s.

Wyszukiwane hasła, urządzenia, lokalizacje, godziny (`intent.ts`, `rules/search-terms.ts`,
`rules/segments.ts`, `term-decisions.ts`):

- Intencja haseł (zakupowa, komercyjna, informacyjna, nawigacyjna, niepowiązana,
  niepewna) to heurystyka ze słowników wspólnych z analizatorem słów i generatorem
  wykluczeń; słowa oferty podane przez użytkownika wygrywają ze słownikami. Bez słów
  oferty nic nie jest oznaczane jako niepowiązane.
- Sugestie: „wyklucz” tylko od liczby kliknięć, przy której brak konwersji jest istotny;
  mniejsze próby „obserwuj”; „nowe słowo” dla haseł z ≥ 2 konwersjami i CPA nie wyższym
  niż średnio, spoza listy słów kluczowych. Decyzje (trafne, nietrafne, wyklucz, dodaj,
  dopasowanie) tylko ręcznie; eksport TXT w składni Google Ads i CSV z kontekstem.
- Urządzenia i lokalizacje: tabela CTR, CPC, konwersji, CPA, ROAS; wysoki CPA, niska
  konwersja, segment z największą wartością, koncentracja budżetu, segmenty „do dalszej
  analizy”. Tylko rekomendacje: aplikacja nie zmienia stawek.
- Godziny i dni: najlepsze i najsłabsze godziny/dni (test dwumianowy); przy okresie
  krótszym niż 4 tygodnie wnioski oznaczone jako wstępne.
- Fixtures: `hasla-audyt.csv`, `urzadzenia-audyt.csv`, `lokalizacje-audyt.csv`,
  `godziny-audyt.csv`.
