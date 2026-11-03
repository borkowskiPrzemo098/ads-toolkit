import type { Metadata } from "next"
import Link from "next/link"
import { DocPage, DocSection } from "@/components/layout/doc-page"
import { ISSUES_URL, LEGAL_UPDATED, REPO_URL, pageUrl } from "@/constants/site"

export const metadata: Metadata = {
  title: "Polityka prywatności",
  description:
    "Jakie dane przetwarza Ads Toolkit: obliczenia i pliki zostają w przeglądarce, bez kont, ciasteczek i analityki.",
  alternates: { canonical: pageUrl("/prywatnosc") },
}

const GITHUB_PRIVACY =
  "https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"

export default function Page() {
  return (
    <DocPage
      title="Polityka prywatności"
      lead="Ads Toolkit działa w Twojej przeglądarce. Nie zakładasz konta, a wpisane liczby, listy słów i pliki CSV nie są wysyłane na żaden serwer."
      updated={LEGAL_UPDATED}
    >
      <DocSection title="Kto odpowiada za serwis">
        <p>
          Serwis prowadzi autor projektu, właściciel repozytorium{" "}
          <a href={REPO_URL} rel="noopener">
            ads-toolkit w serwisie GitHub
          </a>
          . W sprawach prywatności napisz przez{" "}
          <a href={ISSUES_URL} rel="noopener">
            zgłoszenia (Issues) w repozytorium
          </a>
          . Zgłoszenia są publiczne, więc nie umieszczaj w nich danych kampanii ani danych
          osobowych.
        </p>
      </DocSection>

      <DocSection title="Dane, które wpisujesz i importujesz">
        <p>
          Wszystkie obliczenia, analizy i raporty powstają w przeglądarce na Twoim
          urządzeniu. Dotyczy to wartości w formularzach, list słów kluczowych,
          wyszukiwanych haseł, plików CSV i TXT, logo dodanego do raportu PPC oraz plików
          eksportu (CSV, TXT, PDF).
        </p>
        <ul>
          <li>Nie przesyłamy tych danych na serwer i nie mamy do nich dostępu.</li>
          <li>
            Nie łączymy się z kontem Google Ads ani z żadnym zewnętrznym API. Nie prosimy
            o klucze dostępu.
          </li>
          <li>
            Pliki eksportu zapisujesz sam na swoim urządzeniu. Od tej chwili decydujesz,
            komu je przekazujesz.
          </li>
        </ul>
      </DocSection>

      <DocSection title="Pamięć przeglądarki">
        <p>
          Serwis nie używa plików cookie. Korzysta z pamięci przeglądarki w dwóch
          miejscach:
        </p>
        <ul>
          <li>
            <strong>localStorage</strong>: licznik otwarć poszczególnych narzędzi (klucz{" "}
            <code className="tabular">ads-toolkit.tool-usage.v1</code>), potrzebny do
            sekcji „Najczęściej używasz” na panelu. Zawiera tylko nazwy narzędzi i liczby,
            bez danych kampanii.
          </li>
          <li>
            <strong>sessionStorage</strong>: historia linków z generatora UTM. Znika po
            zamknięciu karty.
          </li>
        </ul>
        <p>
          Oba wpisy usuniesz, czyszcząc dane witryny w ustawieniach przeglądarki.
          Pozostałe wpisane wartości znikają po odświeżeniu lub zamknięciu strony.
        </p>
      </DocSection>

      <DocSection title="Analityka, reklamy i usługi zewnętrzne">
        <p>
          Nie używamy narzędzi analitycznych, pikseli reklamowych ani skryptów firm
          trzecich. Czcionki i biblioteki są dostarczane razem z serwisem, więc
          przeglądarka nie łączy się z innymi serwerami. Pilnuje tego polityka
          bezpieczeństwa treści (CSP).
        </p>
      </DocSection>

      <DocSection title="Hosting">
        <p>
          Serwis jest hostowany w GitHub Pages (GitHub, Inc.). Jak każdy serwer WWW,
          GitHub może rejestrować adres IP i podstawowe dane techniczne żądania (np.
          przeglądarkę i czas wejścia) w celu zapewnienia bezpieczeństwa i działania
          usługi. GitHub przetwarza te dane jako niezależny administrator, na zasadach
          opisanych w{" "}
          <a href={GITHUB_PRIVACY} rel="noopener">
            oświadczeniu o prywatności GitHub
          </a>
          . Autor serwisu nie ma dostępu do tych logów.
        </p>
      </DocSection>

      <DocSection title="Twoje prawa i zmiany polityki">
        <p>
          Ponieważ autor serwisu nie zbiera ani nie przechowuje Twoich danych osobowych,
          nie ma czego udostępnić, poprawić ani usunąć po naszej stronie. W sprawie danych
          przetwarzanych przez hosting zwróć się do GitHub. Masz też prawo wnieść skargę
          do Prezesa Urzędu Ochrony Danych Osobowych.
        </p>
        <p>
          Jeśli serwis zacznie zbierać jakiekolwiek dane (np. konta użytkowników), ta
          polityka zostanie zaktualizowana przed wprowadzeniem zmiany. Warunki korzystania
          opisuje <Link href="/regulamin">regulamin</Link>.
        </p>
      </DocSection>
    </DocPage>
  )
}
