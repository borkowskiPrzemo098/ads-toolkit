import type { Metadata } from "next"
import Link from "next/link"
import { DocPage, DocSection } from "@/components/layout/doc-page"
import { ISSUES_URL, LEGAL_UPDATED, pageUrl } from "@/constants/site"

export const metadata: Metadata = {
  title: "Regulamin",
  description:
    "Zasady korzystania z Ads Toolkit: darmowe narzędzia bez konta, wyniki jako szacunki i sugestie do sprawdzenia.",
  alternates: { canonical: pageUrl("/regulamin") },
}

export default function Page() {
  return (
    <DocPage
      title="Regulamin"
      lead="Krótkie zasady korzystania z Ads Toolkit. Korzystając z serwisu, akceptujesz je."
      updated={LEGAL_UPDATED}
    >
      <DocSection title="1. Czym jest serwis">
        <p>
          Ads Toolkit to bezpłatny zestaw dziewięciu narzędzi pomocniczych dla osób
          prowadzących kampanie Google Ads: kalkulatory, generatory i raporty. Działa w
          przeglądarce, bez rejestracji i bez połączenia z kontem reklamowym. Zasady
          przetwarzania danych opisuje{" "}
          <Link href="/prywatnosc">polityka prywatności</Link>.
        </p>
      </DocSection>

      <DocSection title="2. Wyniki to szacunki i sugestie">
        <ul>
          <li>
            Wyniki zależą od danych, które wpiszesz lub zaimportujesz. Błędne dane dają
            błędne wyniki.
          </li>
          <li>
            Prognozy planera budżetu są szacunkami opartymi na Twoich założeniach, a nie
            obietnicą wyników kampanii.
          </li>
          <li>
            Kategorie słów kluczowych, sugestie wykluczeń, uwagi do reklam RSA i teksty
            raportów PPC to heurystyki. Sprawdź je przed użyciem na koncie reklamowym.
          </li>
          <li>
            Wynik testu A/B opisuje istotność statystyczną przy przyjętych założeniach.
            Nie przesądza o tym, który wariant będzie lepszy w przyszłości.
          </li>
          <li>
            Serwis nie udziela porad finansowych, prawnych ani podatkowych. Decyzje o
            budżecie i ustawieniach kampanii podejmujesz samodzielnie.
          </li>
        </ul>
      </DocSection>

      <DocSection title="3. Odpowiedzialność">
        <p>
          Serwis jest udostępniany w obecnej postaci, bez gwarancji poprawności,
          dostępności i przydatności do konkretnego celu. W granicach dozwolonych przez
          prawo autor nie odpowiada za skutki decyzji podjętych na podstawie wyników ani
          za przerwy w działaniu serwisu.
        </p>
      </DocSection>

      <DocSection title="4. Znaki towarowe">
        <p>
          Ads Toolkit jest projektem niezależnym, niezwiązanym z Google LLC ani przez nią
          nieautoryzowanym. Google Ads jest znakiem towarowym Google LLC. Nazwa została
          użyta wyłącznie w celu wskazania, z jakim systemem reklamowym współpracują
          narzędzia.
        </p>
      </DocSection>

      <DocSection title="5. Zgłoszenia i zmiany">
        <p>
          Błędy i propozycje zgłaszaj przez{" "}
          <a href={ISSUES_URL} rel="noopener">
            Issues w repozytorium projektu
          </a>
          . Regulamin może się zmienić wraz z rozwojem serwisu, a aktualna wersja jest
          zawsze na tej stronie, z datą aktualizacji.
        </p>
      </DocSection>
    </DocPage>
  )
}
