import type { Metadata } from "next"
import Link from "next/link"
import { DocPage, DocSection } from "@/components/layout/doc-page"
import { ToolIcon } from "@/components/layout/tool-icon"
import { ISSUES_URL, REPO_URL, VERSION, pageUrl } from "@/constants/site"
import { TOOLS, toolHref } from "@/constants/tools"

export const metadata: Metadata = {
  title: "O aplikacji",
  description:
    "Czym jest Ads Toolkit, jak liczy i czego nie robi: osiem narzędzi Google Ads działających lokalnie w przeglądarce.",
  alternates: { canonical: pageUrl("/o-aplikacji") },
}

export default function Page() {
  return (
    <DocPage
      title="O aplikacji"
      lead="Ads Toolkit zbiera w jednym miejscu rachunki i porządki, które przy kampaniach Google Ads zwykle robi się w arkuszu: rentowność, budżet, listy słów, linki, reklamy, testy i raport dla klienta."
    >
      <DocSection title="Osiem narzędzi">
        <ul className="list-none! gap-0! pl-0!">
          {TOOLS.map((tool) => (
            <li
              key={tool.slug}
              className="flex items-start gap-3 border-b border-border py-3 last:border-0"
            >
              <ToolIcon icon={tool.icon} hue={tool.hue} size="sm" />
              <div>
                <Link href={toolHref(tool.slug)}>{tool.name}</Link>
                <p className="mt-0.5 text-sm text-muted-foreground">{tool.question}</p>
              </div>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection title="Jak to działa">
        <ul>
          <li>
            Wszystko liczy się w przeglądarce. Pliki CSV z Google Ads czytamy lokalnie i
            nic nie trafia na serwer. Szczegóły opisuje{" "}
            <Link href="/prywatnosc">polityka prywatności</Link>.
          </li>
          <li>
            Wzory są jawne: ROAS i ROI liczymy osobno, przychód nie jest zyskiem, a każda
            liczba ma opis. Obliczenia sprawdzają testy na niezależnie policzonych
            przykładach.
          </li>
          <li>
            Gdy danych brakuje, narzędzie mówi, czego brakuje, zamiast pokazywać 0 lub
            pusty wynik.
          </li>
        </ul>
      </DocSection>

      <DocSection title="Czego nie robi">
        <ul>
          <li>Nie łączy się z kontem Google Ads i nie zmienia niczego w kampaniach.</li>
          <li>
            Nie używa AI. Propozycje reklam powstają z szablonów i Twoich danych, a
            kategorie słów i sugestie wykluczeń to heurystyki do sprawdzenia.
          </li>
          <li>
            Nie gwarantuje wyników: prognozy to szacunki oparte na Twoich założeniach.
          </li>
        </ul>
      </DocSection>

      <DocSection title="Projekt">
        <p>
          Wersja {VERSION}. Projekt niezależny, bez związku z Google LLC. Kod źródłowy
          jest publiczny w{" "}
          <a href={REPO_URL} rel="noopener">
            repozytorium na GitHubie
          </a>
          , a błędy i pomysły możesz zgłaszać przez{" "}
          <a href={ISSUES_URL} rel="noopener">
            Issues
          </a>
          . Zasady korzystania opisuje <Link href="/regulamin">regulamin</Link>.
        </p>
      </DocSection>
    </DocPage>
  )
}
