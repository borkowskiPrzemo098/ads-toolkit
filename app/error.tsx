"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Shown when a tool crashes while rendering. The data never left the browser, so there is
 * nothing to report automatically; the user can retry or go back.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Coś poszło nie tak</h1>
      <p className="leading-relaxed text-muted-foreground">
        Narzędzie napotkało nieoczekiwany błąd. Spróbuj ponownie. Jeśli błąd się powtarza,
        odśwież stronę; wpisane dane mogą wtedy zniknąć, bo nie zapisujemy ich na
        serwerze.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="lg" onClick={reset}>
          <RotateCcw />
          Spróbuj ponownie
        </Button>
        <Link href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Wróć do panelu
        </Link>
      </div>
    </div>
  )
}
