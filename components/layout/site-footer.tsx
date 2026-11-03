import Link from "next/link"
import { INFO_PAGES, REPO_URL, VERSION } from "@/constants/site"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p>
            Ads Toolkit, wersja {VERSION}. Działa bez konta, bez kluczy API i bez
            wysyłania danych.
          </p>
          <p>Narzędzie niezależne. Google Ads jest znakiem towarowym Google LLC.</p>
        </div>
        <nav aria-label="Informacje">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {INFO_PAGES.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded transition-colors duration-150 hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={REPO_URL}
                rel="noopener"
                className="rounded transition-colors duration-150 hover:text-foreground"
              >
                Kod źródłowy
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
