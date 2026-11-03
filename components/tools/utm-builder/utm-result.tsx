"use client"

import { Check, Copy, Info, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/hooks/use-copy"
import type { UtmGeneration } from "@/lib/utm/generate"

interface UtmResultProps {
  generation: UtmGeneration | null
  /** Called when the full link is copied, so it lands in the history. */
  onCopied: () => void
}

/** Splits a link into address and parameters for display; plain text, never HTML. */
function splitLink(url: string) {
  const hashAt = url.indexOf("#")
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt)
  const hash = hashAt === -1 ? "" : url.slice(hashAt)
  const queryAt = beforeHash.indexOf("?")
  const base = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt + 1)
  return { base, params: query ? query.split("&") : [], hash }
}

export function UtmResult({ generation, onCopied }: UtmResultProps) {
  const { copy, copiedId, failed } = useCopy()

  if (!generation || !generation.ok) {
    return (
      <p className="rounded-lg border border-dashed border-[#2f3848] px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
        Wpisz adres strony oraz źródło, medium i kampanię. Link pojawi się tutaj od razu.
      </p>
    )
  }

  const { link, notes, warnings } = generation
  const { base, params, hash } = splitLink(link.url)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p
          className="rounded-lg border border-border bg-background px-3.5 py-3 font-mono text-[13px] leading-6 break-all text-muted-foreground"
          aria-label="Gotowy link"
        >
          <span className="text-foreground">{base}</span>
          {params.map((param, i) => {
            const isUtm = param.toLowerCase().startsWith("utm_")
            const [key, ...rest] = param.split("=")
            return (
              <span key={`${param}-${i}`}>
                {i === 0 ? "?" : "&"}
                <span className={isUtm ? "text-[#b3a9ff]" : undefined}>{key}</span>
                {rest.length > 0 && (
                  <>
                    =
                    <span className={isUtm ? "text-foreground" : undefined}>
                      {rest.join("=")}
                    </span>
                  </>
                )}
              </span>
            )
          })}
          {hash}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="lg"
            onClick={async () => {
              // Saved even if the clipboard is blocked: the user still wants the link.
              onCopied()
              await copy(link.url, "link")
            }}
          >
            {copiedId === "link" ? <Check /> : <Copy />}
            {copiedId === "link" ? "Skopiowano" : "Kopiuj link"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => copy(link.suffix, "suffix")}>
            {copiedId === "suffix" ? <Check /> : <Copy />}
            {copiedId === "suffix" ? "Skopiowano" : "Kopiuj same parametry"}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            Przeglądarka zablokowała schowek. Zaznacz link i skopiuj go ręcznie.
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Same parametry wklejasz w Google Ads w polu „Sufiks końcowego adresu URL”, a w
          Meta w „Parametrach adresu URL”. Skopiowane linki trafiają do historii poniżej.
        </p>
      </div>

      {(warnings.length > 0 || notes.length > 0) && (
        <ul className="flex flex-col gap-2">
          {warnings.map((w) => (
            <li
              key={w}
              className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2.5 text-xs leading-relaxed text-[#f7cf7c]"
            >
              <TriangleAlert
                className="mt-px size-3.5 shrink-0 text-warning"
                aria-hidden="true"
              />
              {w}
            </li>
          ))}
          {notes.map((n) => (
            <li key={n} className="flex gap-2.5 px-1 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <dl className="divide-y divide-border rounded-lg border border-border">
        {Object.entries(link.values)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 px-3.5 py-2.5 text-sm"
            >
              <dt className="font-mono text-[13px] text-muted-foreground">{key}</dt>
              <dd className="font-mono text-[13px] break-all">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  )
}
