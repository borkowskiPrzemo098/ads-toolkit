"use client"

import { Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PreviewCombination } from "@/lib/rsa/preview"

interface AdPreviewProps {
  preview: PreviewCombination
  onShuffle: () => void
}

/**
 * Approximation of a search result, light like the page users see it on. Not a pixel copy
 * of Google: it shows structure and line lengths, which is what the advertiser checks.
 */
export function AdPreview({ preview, onShuffle }: AdPreviewProps) {
  const { headlines, descriptions, displayUrl } = preview
  const domain = displayUrl.split("/")[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-[#f7f8fa] p-4 text-[#1f2329] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)] sm:p-5">
        <p className="mb-2 text-xs font-semibold text-[#1f2329]">Sponsorowane</p>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-[#e3e6eb] text-xs font-semibold text-[#4a5160]"
          >
            {domain.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm">{domain}</span>
            <span className="block truncate text-xs text-[#4a5160]">
              https://{displayUrl}
            </span>
          </span>
        </div>
        <p className="mt-2 text-lg leading-snug text-[#1a0dab] sm:text-xl">
          {headlines.length ? headlines.join(" | ") : "Tu pojawią się nagłówki"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[#4a5160]">
          {descriptions.length
            ? descriptions.join(" ")
            : "Tu pojawią się teksty reklamy."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Jedna z kombinacji. Google sam dobiera nagłówki i teksty.
        </p>
        <Button variant="ghost" size="sm" onClick={onShuffle}>
          <Shuffle />
          Inna kombinacja
        </Button>
      </div>
    </div>
  )
}
