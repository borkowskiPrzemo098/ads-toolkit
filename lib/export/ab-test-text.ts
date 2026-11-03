import type { AbTestResult, Verdict } from "@/lib/calculations/ab-test"
import { formatNumber, formatPercent } from "@/lib/formatting/number"

export const VERDICT_TITLE: Record<Verdict, string> = {
  insufficient: "Brak wystarczających danych",
  significant: "Wykryto istotną statystycznie różnicę",
  "keep-testing": "Wynik wymaga dalszej obserwacji",
  "not-significant": "Nie wykryto istotnej statystycznie różnicy",
}

/** "p = 0,021" or "p < 0,001". */
export function formatPValue(p: number): string {
  if (p < 0.001) return "p < 0,001"
  return `p = ${formatNumber(p, 3)}`
}

const pct = (rate: number) => formatPercent(rate, 2)

/** Main explanation of the verdict. Never declares a winner from the rate alone. */
export function verdictText(
  r: AbTestResult,
  names = { a: "Wariant A", b: "Wariant B" }
): string {
  if (r.verdict === "insufficient") return r.insufficientReason ?? ""
  const rateA = r.a.rate.ok ? r.a.rate.value : 0
  const rateB = r.b.rate.ok ? r.b.rate.value : 0
  const p = formatPValue(r.pValue!)
  const higher = rateB > rateA ? names.b : names.a
  const lower = rateB > rateA ? names.a : names.b

  switch (r.verdict) {
    case "significant":
      return `${higher} ma wyższy współczynnik konwersji niż ${lower} (${pct(Math.max(rateA, rateB))} wobec ${pct(Math.min(rateA, rateB))}, ${p}). Szansa, że tak duża różnica pojawiła się przypadkiem, jest mniejsza niż 5%.`
    case "keep-testing":
      return `Różnica (${p}) nie jest jeszcze istotna statystycznie.${
        r.requiredPerVariant
          ? ` Aby potwierdzić różnicę tej wielkości, potrzeba około ${formatNumber(r.requiredPerVariant)} wizyt na wariant.`
          : ""
      } Kontynuuj test, nie wybieraj jeszcze wariantu.`
    case "not-significant":
      return `Obserwowana różnica (${p}) mieści się w granicach przypadku.${
        r.minimumDetectableRelative
          ? ` Przy obecnej próbie test wykryłby zmianę rzędu ${formatPercent(r.minimumDetectableRelative, 0)} względem wariantu A.`
          : ""
      } Brak istotnej różnicy nie dowodzi, że warianty działają tak samo.`
  }
}

/** Additional context that follows from the numbers. */
export function abTestNotes(r: AbTestResult): string[] {
  const notes: string[] = []
  if (r.verdict === "significant") {
    notes.push(
      "Test ocenia tylko współczynnik konwersji. Zanim wybierzesz wariant, porównaj też koszt konwersji i wartość sprzedaży."
    )
  }
  if (r.borderline) {
    notes.push(
      "Wynik jest graniczny: test i przedział ufności dają różne odpowiedzi. Zbierz więcej danych przed decyzją."
    )
  }
  if (r.sampleRatioMismatch) {
    notes.push(
      "Warianty dostały wyraźnie różny ruch. Jeśli podział miał być po równo, sprawdź ustawienia eksperymentu: nierówny podział może zafałszować wynik."
    )
  }
  if (r.a.cpa.ok && r.b.cpa.ok) {
    notes.push(
      "Różnicy CPA nie testujemy statystycznie. Traktuj ją jako informację, nie dowód."
    )
  }
  notes.push(
    "Decyzję podejmij po zebraniu zaplanowanej próby. Częste zaglądanie i kończenie testu przy pierwszym „istotnym” wyniku zwiększa ryzyko fałszywego alarmu."
  )
  return notes
}

export const METHOD_NOTE =
  "Metoda: dwustronny test z dla dwóch proporcji (α = 0,05). Przedziały ufności 95%: Wilsona dla współczynników i Newcombe’a dla różnicy. Liczba wizyt potrzebna do potwierdzenia różnicy zakłada moc testu 80%."
