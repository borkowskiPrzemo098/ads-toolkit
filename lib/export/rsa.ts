import type { TableReport } from "@/lib/pdf/table-report"
import { countChars, limitOf, type AssetKind } from "@/lib/rsa/limits"
import type { AdValidation, RsaAd } from "@/lib/rsa/validate"
import type { CsvCell } from "./csv"

const KIND_LABEL: Record<AssetKind, string> = {
  headline: "Nagłówek",
  description: "Tekst reklamy",
}

function assetRows(ad: RsaAd) {
  return (["headline", "description"] as const).flatMap((kind) =>
    (kind === "headline" ? ad.headlines : ad.descriptions)
      .filter((a) => a.text.trim())
      .map((a, i) => ({
        kind,
        number: i + 1,
        text: a.text.trim(),
        length: countChars(a.text.trim()),
        limit: limitOf(kind),
        pin: a.pin,
      }))
  )
}

export function rsaCsvRows(ad: RsaAd): CsvCell[][] {
  return [
    ["Element", "Nr", "Tekst", "Znaki", "Limit", "Przypięcie"],
    ...assetRows(ad).map((r) => [
      KIND_LABEL[r.kind],
      r.number,
      r.text,
      r.length,
      r.limit,
      r.pin ? `Pozycja ${r.pin}` : "",
    ]),
    ["Adres strony", "", ad.finalUrl.trim(), "", "", ""],
    ["Ścieżka 1", "", ad.path1.trim(), countChars(ad.path1.trim()), 15, ""],
    ["Ścieżka 2", "", ad.path2.trim(), countChars(ad.path2.trim()), 15, ""],
  ]
}

/** Human-readable version for e-mail or a client's approval. */
export function rsaPlainText(ad: RsaAd): string {
  const rows = assetRows(ad)
  const block = (kind: AssetKind, title: string) =>
    [
      title,
      ...rows
        .filter((r) => r.kind === kind)
        .map(
          (r) =>
            `${r.number}. ${r.text} (${r.length}/${r.limit})${r.pin ? ` [pozycja ${r.pin}]` : ""}`
        ),
    ].join("\r\n")
  return [
    block("headline", "NAGŁÓWKI"),
    block("description", "TEKSTY REKLAMY"),
    `ADRES: ${ad.finalUrl.trim()}`,
    `ŚCIEŻKA: ${[ad.path1.trim(), ad.path2.trim()].filter(Boolean).join("/")}`,
  ].join("\r\n\r\n")
}

export function rsaReport(ad: RsaAd, validation: AdValidation): TableReport {
  const rows = assetRows(ad)
  const table = (kind: AssetKind, heading: string) => ({
    heading,
    columns: ["Tekst", "Znaki", "Przypięcie"],
    rows: rows
      .filter((r) => r.kind === kind)
      .map((r) => [r.text, `${r.length}/${r.limit}`, r.pin ? `poz. ${r.pin}` : "—"]),
  })
  const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(new Date())
  return {
    title: "Reklama elastyczna w wyszukiwarce",
    subtitle: `${ad.finalUrl.trim() || "Adres do uzupełnienia"} · ${date}`,
    summary: validation.valid
      ? {
          tone: "positive",
          text: "Reklama spełnia limity i zasady sprawdzane przez narzędzie.",
        }
      : { tone: "negative", text: "Reklama wymaga poprawek przed publikacją." },
    tables: [
      table("headline", "Nagłówki"),
      table("description", "Teksty reklamy"),
      {
        heading: "Adres i ścieżka",
        columns: ["Pole", "Wartość"],
        rows: [
          ["Adres strony", ad.finalUrl.trim() || "—"],
          ["Ścieżka 1", ad.path1.trim() || "—"],
          ["Ścieżka 2", ad.path2.trim() || "—"],
        ],
      },
    ],
    notes: [
      ...validation.ad.map((i) => i.message),
      "Kombinacje nagłówków i tekstów wybiera Google. Przypięcie ogranicza liczbę kombinacji.",
    ],
  }
}
