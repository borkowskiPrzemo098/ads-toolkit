import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "Nie ma takiej strony" }

export default function NotFound() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-12">
      <p className="text-sm font-medium text-muted-foreground tabular">Błąd 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Nie ma takiej strony</h1>
      <p className="leading-relaxed text-muted-foreground">
        Adres mógł się zmienić albo zawiera literówkę. Wszystkie narzędzia znajdziesz w
        panelu głównym i w menu.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2" })}>
        <ArrowLeft />
        Wróć do panelu
      </Link>
    </div>
  )
}
