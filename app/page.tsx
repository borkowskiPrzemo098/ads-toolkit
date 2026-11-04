import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MostUsed } from "@/components/dashboard/most-used"
import { PrivacyBand } from "@/components/dashboard/privacy-band"
import { QuickBreakEven } from "@/components/dashboard/quick-break-even"
import { FeaturedToolTile, ToolTile } from "@/components/dashboard/tool-tile"
import { buttonVariants } from "@/components/ui/button"
import { pageUrl } from "@/constants/site"
import { TOOLS, toolHref } from "@/constants/tools"

export const metadata: Metadata = { alternates: { canonical: pageUrl("/") } }

const featured = TOOLS.filter((t) => t.featured)
const rest = TOOLS.filter((t) => !t.featured)

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      <section className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] xl:gap-12">
        <div className="xl:pt-4">
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
            Policz kampanię, zanim wydasz kolejną złotówkę.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Dziewięć narzędzi dla osób, które prowadzą Google Ads: od audytu konta i progu
            rentowności, przez listy słów kluczowych, po raport dla klienta. Bez logowania
            i bez podłączania konta reklamowego.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={toolHref("profitability")}
              className={buttonVariants({ size: "lg" })}
            >
              Sprawdź rentowność
              <ArrowRight />
            </Link>
            <Link
              href={toolHref("ppc-reports")}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Przygotuj raport PPC
            </Link>
          </div>
          <div className="mt-10">
            <MostUsed />
          </div>
        </div>
        {/* Stacked under the intro below 1280px; kept at form width there. */}
        <div className="max-w-xl xl:max-w-none">
          <QuickBreakEven />
        </div>
      </section>

      <section aria-labelledby="tools-heading">
        <div className="mb-6 flex flex-col gap-1">
          <h2 id="tools-heading" className="text-xl font-semibold tracking-tight">
            Narzędzia
          </h2>
          <p className="text-sm text-muted-foreground">
            Każde odpowiada na jedno pytanie, które zadajesz sobie przy kampanii.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {featured.map((tool) => (
            <FeaturedToolTile
              key={tool.slug}
              tool={tool}
              wide={tool.slug === "campaign-auditor"}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((tool) => (
            <ToolTile key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <PrivacyBand />
    </div>
  )
}
