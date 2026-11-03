import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface DocPageProps {
  title: string
  lead: string
  /** "Aktualizacja: …" line for legal pages. */
  updated?: string
  children: React.ReactNode
}

/** Text page (about, privacy, terms): same breadcrumb as tools, one readable column. */
export function DocPage({ title, lead, updated, children }: DocPageProps) {
  return (
    <article className="max-w-2xl">
      <header className="mb-10">
        <nav
          aria-label="Ścieżka"
          className="mb-5 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="rounded transition-colors hover:text-foreground">
            Panel główny
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="text-foreground">{title}</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lead}</p>
        {updated && (
          <p className="mt-3 text-xs text-muted-foreground tabular">
            Aktualizacja: {updated}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-9">{children}</div>
    </article>
  )
}

export function DocSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-7">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[0.9375rem] leading-relaxed text-[#c9cfdb] [&_a]:font-medium [&_a]:text-[#b3a9ff] [&_a]:underline [&_a]:decoration-[#b3a9ff]/40 [&_a]:underline-offset-3 [&_a:hover]:decoration-[#b3a9ff] [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
