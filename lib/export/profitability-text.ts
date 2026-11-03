import type { ProfitabilityResult } from "@/lib/calculations/profitability"
import { formatCurrency, formatPercent, type Currency } from "@/lib/formatting/number"

/** Margin- and product-cost-based profit differing by more than this share of revenue is flagged. */
const MARGIN_MISMATCH_SHARE = 0.1

export interface Verdict {
  tone: "positive" | "negative" | "neutral"
  text: string
}

/** One-line verdict. Built only from computed numbers, never from assumptions. */
export function profitabilityVerdict(
  r: ProfitabilityResult,
  currency: Currency
): Verdict | null {
  if (!r.netProfit.ok || r.status === null) return null
  const amount = formatCurrency(Math.abs(r.netProfit.value), currency)
  if (r.status === "profit")
    return { tone: "positive", text: `Kampania zarabia: ${amount} zysku netto.` }
  if (r.status === "loss")
    return { tone: "negative", text: `Kampania traci: ${amount} straty netto.` }
  return {
    tone: "neutral",
    text: `Kampania jest na granicy opłacalności (${r.netProfit.value < 0 ? "−" : ""}${amount}).`,
  }
}

/** Explanations of the result that follow directly from the user's numbers. */
export function profitabilityNotes(r: ProfitabilityResult, currency: Currency): string[] {
  const notes: string[] = []
  const pct = (v: number) => formatPercent(v, 0)
  const money = (v: number) => formatCurrency(v, currency)

  if (r.roas.ok && r.breakEvenRoas.ok) {
    notes.push(
      r.roas.value >= r.breakEvenRoas.value
        ? `ROAS ${pct(r.roas.value)} jest powyżej progu ${pct(r.breakEvenRoas.value)}, więc marża pokrywa koszt reklamy.`
        : `ROAS ${pct(r.roas.value)} jest poniżej progu ${pct(r.breakEvenRoas.value)}. Przy tej marży reklama się nie zwraca, jeszcze przed kosztami dodatkowymi.`
    )
  }

  if (r.maxCpa.ok && r.maxCpa.value <= 0) {
    notes.push(
      "Koszty dodatkowe na konwersję są wyższe niż marża z jednego zamówienia, więc przy tych kosztach żaden CPA nie da zysku."
    )
  } else if (r.cpa.ok && r.maxCpa.ok) {
    notes.push(
      r.cpa.value <= r.maxCpa.value
        ? `CPA ${money(r.cpa.value)} mieści się w limicie ${money(r.maxCpa.value)} na konwersję.`
        : `CPA ${money(r.cpa.value)} przekracza maksymalny CPA ${money(r.maxCpa.value)}: każda konwersja kosztuje więcej, niż na niej zarabiasz.`
    )
  }

  if (r.netProfitBasis === "product-cost" && r.profitAfterAds.ok && r.netProfit.ok) {
    const gap = Math.abs(r.netProfit.value - r.profitAfterAds.value)
    const revenue = r.revenue.ok ? r.revenue.value : 0
    notes.push(
      `Zysk netto liczymy od kosztu produktu. Licząc od marży, wyszłoby ${money(r.profitAfterAds.value)}.` +
        (gap > revenue * MARGIN_MISMATCH_SHARE
          ? " Ta różnica przekracza 10% przychodu, więc sprawdź, czy marża i koszt produktu są aktualne."
          : "")
    )
  }

  if (r.revenueDerived) {
    notes.push("Przychód wyliczyliśmy jako średnią wartość zamówienia × konwersje.")
  }

  return notes
}
