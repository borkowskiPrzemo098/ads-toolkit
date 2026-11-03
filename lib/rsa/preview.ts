import { checkUrl } from "@/lib/utm/build"
import { displayText, RSA } from "./limits"
import type { AdAsset, RsaAd } from "./validate"

export interface PreviewCombination {
  headlines: string[]
  descriptions: string[]
  /** "biegam.pl/buty/damskie" as shown under the headline. */
  displayUrl: string
}

/**
 * One combination Google could show. Pinned texts stay on their position (rotating when
 * several share it); the rest fill free positions in an order that changes with `seed`.
 */
function arrange(
  assets: AdAsset[],
  positions: readonly number[],
  seed: number
): string[] {
  const filled = assets.filter((a) => a.text.trim())
  const pool = filled.filter((a) => a.pin === null)
  const rotated = pool.length
    ? [...pool.slice(seed % pool.length), ...pool.slice(0, seed % pool.length)]
    : []
  const result: string[] = []
  for (const position of positions) {
    const pinned = filled.filter((a) => a.pin === position)
    const pick = pinned.length ? pinned[seed % pinned.length] : rotated.shift()
    if (pick) result.push(displayText(pick.text.trim()))
  }
  return result
}

export function displayUrl(ad: Pick<RsaAd, "finalUrl" | "path1" | "path2">): string {
  const check = checkUrl(ad.finalUrl)
  const host = check.ok ? check.url.hostname.replace(/^www\./, "") : "twojadomena.pl"
  return [host, ad.path1.trim(), ad.path1.trim() ? ad.path2.trim() : ""]
    .filter(Boolean)
    .join("/")
}

export function previewCombination(ad: RsaAd, seed = 0): PreviewCombination {
  return {
    headlines: arrange(ad.headlines, RSA.headline.positions, seed),
    descriptions: arrange(ad.descriptions, RSA.description.positions, seed),
    displayUrl: displayUrl(ad),
  }
}
