@AGENTS.md

# Ads Toolkit: zasady pracy

Specyfikacja produktu: 8 narzędzi Google Ads, UI po polsku, Premium Dark, bez logowania,
bez API, bez bazy danych, dane przetwarzane lokalnie. Pracuj etapami (README → Status etapów).

## Obowiązkowe

1. Logika obliczeń tylko w `lib/calculations/<narzędzie>.ts`, nigdy w komponentach.
   Zwracaj `CalcResult` (`types/calculation.ts`) z polskim powodem przy braku danych.
2. Każda funkcja obliczeniowa ma testy w `tests/unit/` (poprawne wartości, zera,
   puste i błędne dane, wartości graniczne). Wzory sprawdzaj na niezależnych przykładach.
3. Nazwy, kolejność, ikony i opisy narzędzi tylko w `constants/tools.ts`.
4. Nowe narzędzie: `ToolHeader` + `Panel` (components/layout), pola z `components/forms`,
   eksport przez `ExportButtons` + `lib/export/csv.ts` + `lib/pdf/table-report.ts`
   (nowe układy PDF budować na `lib/pdf/document.ts`).
   Wspólne: `KpiTile`, `MobileResultBar`, `SegmentedControl`, `SelectField`,
   `parseNumericForm`, `useListImport` + `ListTextarea` + `FileImportField` (import list),
   `parseReportNumber` (liczby z raportów), `lib/keywords/*` (tekst PL), `TextField`,
   `useCopy` (schowek z awaryjną metodą), `useSessionValue` (sessionStorage).
   Wzorce: `components/tools/profitability`, `components/tools/budget-planner`. Nie twórz nowego stylu kart ani przycisków.
5. ROAS ≠ ROI. Przychód ≠ zysk. Heurystyki (intencja, wykluczenia) zawsze opisane jako
   sugestie. Prognozy nigdy jako gwarancje. Wykluczenia wymagają akceptacji użytkownika.
6. Bez zewnętrznych API, logowania, bazy, płatności i trackerów. Bez fikcyjnych danych
   w wynikach. CSV: limit rozmiaru, ochrona przed formułami przy eksporcie (`= + - @`),
   nigdy `dangerouslySetInnerHTML` z danych użytkownika.
7. Nie instaluj bibliotek, zanim etap ich nie wymaga.
8. Po każdym etapie: `npm run check` i `npm run test:e2e`, podgląd desktop + telefon,
   aktualizacja README, podsumowanie zrobionego i otwartych problemów.
9. Nowe narzędzie lub widok: dopisz trasę do `tests/e2e/smoke.spec.ts` i scenariusz do
   `tools.spec.ts`. Wykresy importuj z `components/charts/lazy`, szerokie tabele owijaj
   w `TableScroll`. Nowe zasoby zewnętrzne wymagają zmiany CSP w `app/layout.tsx`.

## Design system

- Tokeny w `app/globals.css` (`:root`). Paleta ze specyfikacji, aplikacja tylko ciemna
  (`class="dark"` na `<html>`).
- Akcent #7C6CFF zawsze z ciemnym tekstem (`text-primary-foreground`); biały ma 3,9:1.
- Font Geist; liczby w wynikach z klasą `tabular`.
- Zaokrąglenia: pola i przyciski 10 px, panele i kafle 14 px.
- Ruch tylko jako stan: 150–200 ms, `ease-out-quart`, bez animacji wejścia stron.
