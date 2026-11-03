import { calcFail, calcOk, type CalcResult } from "@/types/calculation"

/**
 * Break-even ROAS: the ROAS at which ad spend is exactly covered by gross margin.
 * Formula: 1 / margin. Returned as a percentage (margin 25% → 400%).
 */
export function breakEvenRoas(marginPercent: number): CalcResult {
  if (!Number.isFinite(marginPercent)) return calcFail("Podaj marżę jako liczbę.")
  if (marginPercent <= 0)
    return calcFail("Przy marży 0% lub ujemnej żaden ROAS nie da zysku.")
  if (marginPercent > 100) return calcFail("Marża nie może przekraczać 100%.")
  return calcOk((1 / (marginPercent / 100)) * 100)
}

/**
 * Maximum CPA: what one conversion may cost before it stops paying for itself.
 * Formula: average conversion value × margin − other costs per conversion.
 */
export function maxCpa(
  avgConversionValue: number,
  marginPercent: number,
  otherCostsPerConversion = 0
): CalcResult {
  if (!Number.isFinite(avgConversionValue) || avgConversionValue <= 0)
    return calcFail("Podaj średnią wartość zamówienia większą od zera.")
  if (!Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent > 100)
    return calcFail("Marża musi mieścić się w przedziale od 0 do 100%.")
  if (!Number.isFinite(otherCostsPerConversion) || otherCostsPerConversion < 0)
    return calcFail("Pozostałe koszty nie mogą być ujemne.")
  return calcOk(avgConversionValue * (marginPercent / 100) - otherCostsPerConversion)
}
