"""
Generates the auditor's test reports, shaped like Google Ads exports (title row, date-range
row, header, data, "Razem/Total" rows). Run once after changing: python generate.py
Values are deterministic and small enough to check by hand. Requires openpyxl (dev only).
"""
import codecs
import csv
import io
from pathlib import Path

from openpyxl import Workbook

OUT = Path(__file__).parent


def write_csv(name, rows, delimiter=",", encoding="utf-8", bom=False):
    buf = io.StringIO()
    csv.writer(buf, delimiter=delimiter, lineterminator="\r\n").writerows(rows)
    text = buf.getvalue()
    data = text.encode(encoding)
    if encoding == "utf-16-le":
        data = codecs.BOM_UTF16_LE + data
    elif bom:
        data = codecs.BOM_UTF8 + data
    (OUT / name).write_bytes(data)


def write_xlsx(name, rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "Raport"
    for row in rows:
        ws.append(row)
    wb.save(OUT / name)


PL_PERIOD = "1 października 2026 - 31 października 2026"
EN_PERIOD = "October 1, 2026 - October 31, 2026"

# 1. Campaigns, Polish UI, comma CSV with quoted Polish numbers and two totals rows.
write_csv(
    "kampanie-pl.csv",
    [
        ["Raport kampanii"],
        [PL_PERIOD],
        ["Stan kampanii", "Kampania", "Typ kampanii", "Identyfikator kampanii", "Wyśw.", "Kliknięcia", "CTR", "Śr. CPC", "Koszt", "Konwersje", "Koszt/konw.", "Wsp. konw.", "Wartość konw."],
        ["Włączona", "Buty – Search", "Sieć wyszukiwania", "1111", "48 210", "2 410", "5,00%", "1,00 zł", "2 410,00 zł", "96,00", "25,10 zł", "3,98%", "19 200,00 zł"],
        ["Włączona", "Kurtki – PMax", "Performance Max", "2222", "120 400", "1 806", "1,50%", "2,00 zł", "3 612,00 zł", "18,50", "195,24 zł", "1,02%", "5 550,00 zł"],
        ["Wstrzymana", "Brand – Search", "Sieć wyszukiwania", "3333", "5 100", "1 020", "20,00%", "0,40 zł", "408,00 zł", "61,00", "6,69 zł", "5,98%", "12 200,00 zł"],
        ["Włączona", "Akcesoria – Search", "Sieć wyszukiwania", "4444", "900", "12", "1,33%", "1,50 zł", "18,00 zł", "0,00", "--", "0,00%", "0,00 zł"],
        ["Razem: kampanie w sieci wyszukiwania", "", "", "", "54 210", "3 442", "6,35%", "0,82 zł", "2 836,00 zł", "157,00", "18,06 zł", "4,56%", "31 400,00 zł"],
        ["Razem: konto", "", "", "", "174 610", "5 248", "3,01%", "1,23 zł", "6 448,00 zł", "175,50", "36,74 zł", "3,34%", "36 950,00 zł"],
    ],
)

# 2. Search terms, English UI, comma CSV with US number format.
write_csv(
    "search-terms-en.csv",
    [
        ["Search terms report"],
        [EN_PERIOD],
        ["Search term", "Match type", "Added/Excluded", "Campaign", "Ad group", "Search keyword", "Impr.", "Clicks", "Cost", "Conversions", "Conv. value"],
        ["buty do biegania damskie", "Phrase match", "Added", "Buty – Search", "Damskie", "buty do biegania", "4,210", "312", "296.40", "14.00", "2,800.00"],
        ["buty do biegania za darmo", "Broad match", "None", "Buty – Search", "Ogólne", "buty do biegania", "1,020", "84", "75.60", "0.00", "0.00"],
        ["praca sklep obuwniczy", "Broad match", "None", "Buty – Search", "Ogólne", "sklep obuwniczy", "640", "51", "40.80", "0.00", "0.00"],
        ["jak wyczyścić buty zamszowe", "Broad match", "None", "Buty – Search", "Ogólne", "buty zamszowe", "2,300", "96", "48.00", "1.00", "180.00"],
        ["nike pegasus 41 cena", "Exact match (close variant)", "None", "Buty – Search", "Nike", "nike pegasus", "880", "77", "123.20", "6.00", "3,240.00"],
        ["Total: Search terms", "", "", "", "", "", "9,050", "620", "584.00", "21.00", "6,220.00"],
    ],
)

# 3. Keywords, "Excel CSV" export: UTF-16 LE with tabs; a duplicated row and a repeated header.
kw_header = ["Słowo kluczowe", "Typ dopasowania", "Kampania", "Grupa reklam", "Wyśw.", "Kliknięcia", "Koszt", "Konwersje", "Wartość konw."]
write_csv(
    "slowa-kluczowe-utf16.csv",
    [
        ["Raport słów kluczowych"],
        [PL_PERIOD],
        kw_header,
        ["buty do biegania", "Do wyrażenia", "Buty – Search", "Damskie", "12 400", "980", "1 029,00", "41,00", "8 200,00"],
        ["sklep obuwniczy", "Przybliżone", "Buty – Search", "Ogólne", "8 200", "410", "492,00", "2,00", "300,00"],
        ["sklep obuwniczy", "Przybliżone", "Buty – Search", "Ogólne", "8 200", "410", "492,00", "2,00", "300,00"],
        kw_header,
        ["nike pegasus", "Ścisłe", "Buty – Search", "Nike", "3 100", "402", "623,10", "29,00", "6 090,00"],
        ["Razem: konto", "", "", "", "31 900", "2 202", "2 636,10", "74,00", "14 890,00"],
    ],
    delimiter="\t",
    encoding="utf-16-le",
)

# 4. Devices as XLSX: real numeric cells, fractional conversions.
write_xlsx(
    "urzadzenia.xlsx",
    [
        ["Raport urządzeń"],
        [PL_PERIOD],
        ["Urządzenie", "Kampania", "Wyświetlenia", "Kliknięcia", "Koszt", "Konwersje", "Wartość konw."],
        ["Komputery", "Buty – Search", 20110, 1105, 1160.25, 52.333333, 10800.5],
        ["Telefony komórkowe z pełną przeglądarką", "Buty – Search", 26500, 1240, 1190.4, 41.666667, 7900],
        ["Tablety z pełną przeglądarką", "Buty – Search", 1600, 65, 59.35, 2, 499.5],
        ["Razem: konto", None, 48210, 2410, 2410, 96, 19200],
    ],
)

# 5. Hour of day, re-saved by a Polish Excel: semicolon separator, comma decimals, no title rows.
write_csv(
    "godziny-srednik.csv",
    [["Godzina", "Dzień tygodnia", "Kliknięcia", "Koszt", "Konwersje"]]
    + [[str(h), day, str(20 + h), f"{(20 + h) * 1.1:.2f}".replace(".", ","), str(h % 4)] for day in ("poniedziałek", "sobota") for h in range(0, 24, 6)],
    delimiter=";",
    bom=True,
)

# 6. Locations with the user-location city column.
write_csv(
    "lokalizacje.csv",
    [
        ["Raport lokalizacji"],
        [PL_PERIOD],
        ["Miasto (lokalizacja użytkownika)", "Kampania", "Wyśw.", "Kliknięcia", "Koszt", "Konwersje"],
        ["Warszawa", "Buty – Search", "14 000", "720", "760,00", "33,00"],
        ["Kraków", "Buty – Search", "6 100", "300", "290,00", "9,00"],
        ["Łódź", "Buty – Search", "2 000", "70", "80,00", "0,00"],
    ],
)

# 7. Ads, English UI, XLSX with ad type and strength.
write_xlsx(
    "reklamy-en.xlsx",
    [
        ["Ad report"],
        [EN_PERIOD],
        ["Ad ID", "Ad type", "Ad strength", "Headline 1", "Campaign", "Ad group", "Impr.", "Clicks", "Cost", "Conversions"],
        [701, "Responsive search ad", "Good", "Buty do biegania", "Buty – Search", "Damskie", 30100, 1500, 1500, 60],
        [702, "Responsive search ad", "Poor", "Sklep z butami", "Buty – Search", "Ogólne", 18110, 910, 910, 36],
    ],
)

# 8. Landing pages.
write_csv(
    "strony-docelowe.csv",
    [
        ["Strona docelowa", "Kampania", "Kliknięcia", "Koszt", "Konwersje"],
        ["https://sklep.pl/buty-do-biegania", "Buty – Search", "1 900", "1 900,00", "80,00"],
        ["https://sklep.pl/", "Buty – Search", "510", "510,00", "16,00"],
    ],
)

# 9. Conversion actions.
write_csv(
    "konwersje.csv",
    [
        ["Działanie powodujące konwersję", "Kampania", "Konwersje", "Wartość konw."],
        ["Zakup", "Buty – Search", "90,00", "19 200,00"],
        ["Kontakt telefoniczny", "Buty – Search", "6,00", "0,00"],
    ],
)

# 10. Ad groups.
write_csv(
    "grupy-reklam.csv",
    [
        ["Grupa reklam", "Kampania", "Identyfikator grupy reklam", "Kliknięcia", "Koszt", "Konwersje"],
        ["Damskie", "Buty – Search", "91", "1 292", "1 325,40", "55,00"],
        ["Ogólne", "Buty – Search", "92", "641", "656,40", "3,00"],
    ],
)

# 11. Campaigns by day (segment "Dzień"), 31 days of October: drives the time charts.
daily = [["Raport kampanii"], [PL_PERIOD], ["Dzień", "Kampania", "Identyfikator kampanii", "Typ kampanii", "Stan kampanii", "Wyśw.", "Kliknięcia", "Koszt", "Konwersje", "Wartość konw."]]
for day in range(1, 32):
    for cid, name, ctype, status, base in (
        ("1111", "Buty – Search", "Sieć wyszukiwania", "Włączona", 80),
        ("2222", "Kurtki – PMax", "Performance Max", "Włączona", 110),
        ("3333", "Brand – Search", "Sieć wyszukiwania", "Wstrzymana", 12),
    ):
        clicks = base + day % 7
        cost = clicks * (1.0 if cid == "1111" else 2.0 if cid == "2222" else 0.4)
        conv = (day % 3) + (3 if cid == "1111" else 1 if cid == "2222" else 2)
        daily.append([f"2026-10-{day:02d}", name, cid, ctype, status, str(clicks * 20), str(clicks), f"{cost:.2f}".replace(".", ","), f"{conv},00", f"{conv * 200},00"])
write_csv("kampanie-dzienne.csv", daily)

# 12. Audit scenario: campaigns built to trigger each campaign rule (see auditor-rules.test.ts).
write_csv(
    "kampanie-audyt.csv",
    [
        ["Raport kampanii"],
        [PL_PERIOD],
        ["Kampania", "Identyfikator kampanii", "Typ kampanii", "Stan kampanii", "Wyśw.", "Kliknięcia", "Koszt", "Konwersje", "Wartość konw."],
        # Good performer: CPA 20, CR 5%, ROAS 1000%.
        ["Buty – Search", "1111", "Sieć wyszukiwania", "Włączona", "60 000", "3 000", "3 000,00 zł", "150,00", "30 000,00 zł"],
        # Big spend, few conversions: 33% of cost, 9% of conversions, CPA 200.
        ["Kurtki – Search", "2222", "Sieć wyszukiwania", "Włączona", "40 000", "2 500", "5 000,00 zł", "25,00", "5 000,00 zł"],
        # Strong performer: CPA 6,67, ROAS 3000%.
        ["Brand – Search", "3333", "Sieć wyszukiwania", "Włączona", "8 000", "1 600", "640,00 zł", "96,00", "19 200,00 zł"],
        # Too little data: 12 clicks.
        ["Akcesoria – Search", "4444", "Sieć wyszukiwania", "Włączona", "900", "12", "18,00 zł", "0,00", "0,00 zł"],
        # Very low CTR among Search campaigns: 0,3% vs median ~5%.
        ["Skarpety – Search", "5555", "Sieć wyszukiwania", "Włączona", "50 000", "150", "300,00 zł", "6,00", "900,00 zł"],
        # Display: CPA 40 is fine, but ROAS 150% is far below the account (~545%).
        # CTR is not compared with Search campaigns.
        ["Remarketing – Display", "6666", "Sieć reklamowa", "Włączona", "400 000", "800", "1 600,00 zł", "40,00", "2 400,00 zł"],
    ],
)

# 13. Audit scenario: keywords built to trigger each keyword rule.
write_csv(
    "slowa-kluczowe-audyt.csv",
    [
        ["Raport słów kluczowych"],
        [PL_PERIOD],
        ["Słowo kluczowe", "Typ dopasowania", "Kampania", "Grupa reklam", "Wyśw.", "Kliknięcia", "Koszt", "Konwersje", "Wartość konw."],
        # Good keyword; also duplicated in another ad group (overlap).
        ["buty do biegania", "Do wyrażenia", "Buty – Search", "Damskie", "20 000", "1 200", "1 200,00", "72,00", "14 400,00"],
        ["buty do biegania", "Ścisłe", "Buty – Search", "Nike", "2 000", "150", "150,00", "9,00", "1 800,00"],
        # 900 clicks, no conversions: cost without conversions.
        ["buty sportowe", "Przybliżone", "Buty – Search", "Ogólne", "30 000", "900", "1 080,00", "0,00", "0,00"],
        # Very low CTR (0,5%).
        ["buty", "Przybliżone", "Buty – Search", "Ogólne", "40 000", "200", "300,00", "2,00", "400,00"],
        # Very high CPA (500).
        ["kurtka zimowa", "Do wyrażenia", "Kurtki – Search", "Zimowe", "15 000", "1 500", "3 000,00", "6,00", "1 200,00"],
        ["kurtka puchowa damska", "Ścisłe", "Kurtki – Search", "Zimowe", "3 000", "400", "800,00", "16,00", "3 200,00"],
        # Two clicks, no conversion: too little data, must NOT be flagged.
        ["skarpety do biegania", "Przybliżone", "Buty – Search", "Akcesoria", "300", "2", "3,00", "0,00", "0,00"],
        # High CTR (12%) and conversion rate (10%).
        ["nike pegasus 41", "Ścisłe", "Buty – Search", "Nike", "2 500", "300", "450,00", "30,00", "6 000,00"],
    ],
)

# Broken files: missing required cost column, a non-number, a negative click count.
write_csv(
    "brak-kosztu.csv",
    [
        ["Kampania", "Kliknięcia", "Konwersje"],
        ["Buty – Search", "abc", "3,00"],
        ["Kurtki – PMax", "-5", "1,00"],
    ],
)
(OUT / "pusty.csv").write_bytes(b"")
write_csv("nieznany.csv", [["Imię", "Nazwisko"], ["Jan", "Kowalski"]])
print("ok")
