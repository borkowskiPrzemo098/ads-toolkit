import type { UtmHistoryItem } from "@/lib/utm/history"
import type { CsvCell } from "./csv"

export function utmCsvRows(items: UtmHistoryItem[]): CsvCell[][] {
  const time = new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  })
  return [
    [
      "Link z UTM",
      "Adres strony",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "Utworzono",
    ],
    ...items.map((item) => [
      item.url,
      item.target,
      item.values.utm_source,
      item.values.utm_medium,
      item.values.utm_campaign,
      item.values.utm_term,
      item.values.utm_content,
      time.format(new Date(item.createdAt)),
    ]),
  ]
}
