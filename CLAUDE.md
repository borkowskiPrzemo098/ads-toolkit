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
4. Nowe narzędzie: `ToolHeader` + `Panel` (components/layout), pola z `components/forms`.
   Nie twórz nowego stylu kart ani przycisków.
5. ROAS ≠ ROI. Przychód ≠ zysk. Heurystyki (intencja, wykluczenia) zawsze opisane jako
   sugestie. Prognozy nigdy jako gwarancje. Wykluczenia wymagają akceptacji użytkownika.
6. Bez zewnętrznych API, logowania, bazy, płatności i trackerów. Bez fikcyjnych danych
   w wynikach. CSV: limit rozmiaru, ochrona przed formułami przy eksporcie (`= + - @`),
   nigdy `dangerouslySetInnerHTML` z danych użytkownika.
7. Nie instaluj bibliotek, zanim etap ich nie wymaga.
8. Po każdym etapie: `npm run check` i `npm run build`, podgląd desktop + telefon,
   aktualizacja README, podsumowanie zrobionego i otwartych problemów.

## Design system

- Tokeny w `app/globals.css` (`:root`). Paleta ze specyfikacji, aplikacja tylko ciemna
  (`class="dark"` na `<html>`).
- Akcent #7C6CFF zawsze z ciemnym tekstem (`text-primary-foreground`); biały ma 3,9:1.
- Font Geist; liczby w wynikach z klasą `tabular`.
- Zaokrąglenia: pola i przyciski 10 px, panele i kafle 14 px.
- Ruch tylko jako stan: 150–200 ms, `ease-out-quart`, bez animacji wejścia stron.
