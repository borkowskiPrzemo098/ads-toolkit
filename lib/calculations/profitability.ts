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

/** Campaign data after parsing. `null` means the user left the field empty. */
export interface ProfitabilityInput {
  adSpend: number | null
  impressions: number | null
  clicks: number | null
  conversions: number | null
  revenue: number | null
  avgOrderValue: number | null
  marginPercent: number | null
  /** Total extra campaign costs: agency fee, tools, creatives. */
  extraCosts: number | null
  /** Cost of goods or service delivery for one conversion. */
  productCostPerConversion: number | null
}

export const EMPTY_PROFITABILITY_INPUT: ProfitabilityInput = {
  adSpend: null,
  impressions: null,
  clicks: null,
  conversions: null,
  revenue: null,
  avgOrderValue: null,
  marginPercent: null,
  extraCosts: null,
  productCostPerConversion: null,
}

export type ProfitStatus = "profit" | "breakeven" | "loss"
/** Which cost of goods the net profit uses: margin, or product cost per conversion. */
export type ProfitBasis = "margin" | "product-cost"

export interface ProfitabilityResult {
  ctr: CalcResult
  cpc: CalcResult
  conversionRate: CalcResult
  cpa: CalcResult
  revenue: CalcResult
  revenueDerived: boolean
  avgOrderValue: CalcResult
  avgOrderValueDerived: boolean
  roas: CalcResult
  /** Revenue × margin − ad spend − extra costs. */
  profitAfterAds: CalcResult
  /** Revenue − product cost × conversions − ad spend − extra costs. */
  profitAfterProductCost: CalcResult
  netProfit: CalcResult
  netProfitBasis: ProfitBasis | null
  totalCosts: CalcResult
  costOfGoods: CalcResult
  roi: CalcResult
  breakEvenRoas: CalcResult
  breakEvenCpa: CalcResult
  maxCpa: CalcResult
  status: ProfitStatus | null
}

/** Profit within ±0.5% of revenue counts as break-even rather than a win or a loss. */
const BREAKEVEN_TOLERANCE = 0.005

const MSG = {
  noSpend: "Podaj koszt reklamy.",
  zeroSpend: "Koszt reklamy wynosi 0, więc wskaźnik nie ma sensu.",
  noClicks: "Podaj liczbę kliknięć.",
  zeroClicks: "Brak kliknięć, nie da się policzyć kosztu kliknięcia.",
  noImpressions: "Podaj wyświetlenia, aby policzyć CTR.",
  zeroImpressions: "Brak wyświetleń.",
  noConversions: "Podaj liczbę konwersji.",
  zeroConversions: "Brak konwersji, więc koszt konwersji nie istnieje.",
  noRevenue: "Podaj przychód albo średnią wartość zamówienia i liczbę konwersji.",
  noAov: "Podaj średnią wartość zamówienia albo przychód i liczbę konwersji.",
  noMargin: "Podaj marżę.",
  noProductCost: "Podaj koszt produktu na konwersję.",
} as const

const has = (v: number | null): v is number => v !== null && Number.isFinite(v)
const value = (r: CalcResult): number | null => (r.ok ? r.value : null)

function ratio(
  numerator: number | null,
  denominator: number | null,
  missingNumerator: string,
  missingDenominator: string,
  zeroDenominator: string,
  scale = 1
): CalcResult {
  if (!has(numerator)) return calcFail(missingNumerator)
  if (!has(denominator)) return calcFail(missingDenominator)
  if (denominator === 0) return calcFail(zeroDenominator)
  return calcOk((numerator / denominator) * scale)
}

export function analyzeProfitability(input: ProfitabilityInput): ProfitabilityResult {
  const {
    adSpend,
    impressions,
    clicks,
    conversions,
    marginPercent,
    productCostPerConversion,
  } = input
  const extraCosts = has(input.extraCosts) ? input.extraCosts : 0
  const margin = has(marginPercent) ? marginPercent / 100 : null
  const marginValid = margin !== null && margin > 0 && margin <= 1

  const ctr =
    has(clicks) && has(impressions) && clicks > impressions
      ? calcFail("Kliknięć jest więcej niż wyświetleń. Sprawdź dane.")
      : ratio(
          clicks,
          impressions,
          MSG.noClicks,
          MSG.noImpressions,
          MSG.zeroImpressions,
          100
        )
  const cpc = ratio(adSpend, clicks, MSG.noSpend, MSG.noClicks, MSG.zeroClicks)
  const conversionRate = ratio(
    conversions,
    clicks,
    MSG.noConversions,
    MSG.noClicks,
    MSG.zeroClicks,
    100
  )
  const cpa = ratio(
    adSpend,
    conversions,
    MSG.noSpend,
    MSG.noConversions,
    MSG.zeroConversions
  )

  // Revenue and average order value can each be derived from the other.
  let revenue: CalcResult
  let revenueDerived = false
  if (has(input.revenue)) revenue = calcOk(input.revenue)
  else if (has(input.avgOrderValue) && has(conversions)) {
    revenue = calcOk(input.avgOrderValue * conversions)
    revenueDerived = true
  } else revenue = calcFail(MSG.noRevenue)

  let avgOrderValue: CalcResult
  let avgOrderValueDerived = false
  if (has(input.avgOrderValue)) avgOrderValue = calcOk(input.avgOrderValue)
  else if (has(input.revenue) && has(conversions) && conversions > 0) {
    avgOrderValue = calcOk(input.revenue / conversions)
    avgOrderValueDerived = true
  } else if (has(conversions) && conversions === 0)
    avgOrderValue = calcFail("Brak konwersji, więc nie ma średniej wartości zamówienia.")
  else avgOrderValue = calcFail(MSG.noAov)

  const rev = value(revenue)
  const aov = value(avgOrderValue)

  const roas = ratio(rev, adSpend, MSG.noRevenue, MSG.noSpend, MSG.zeroSpend, 100)

  const marginFail = !has(marginPercent)
    ? calcFail(MSG.noMargin)
    : calcFail("Marża musi mieścić się w przedziale od 0 do 100%.")

  let profitAfterAds: CalcResult
  if (!marginValid) profitAfterAds = marginFail
  else if (rev === null) profitAfterAds = calcFail(MSG.noRevenue)
  else if (!has(adSpend)) profitAfterAds = calcFail(MSG.noSpend)
  else profitAfterAds = calcOk(rev * margin - adSpend - extraCosts)

  let profitAfterProductCost: CalcResult
  if (!has(productCostPerConversion)) profitAfterProductCost = calcFail(MSG.noProductCost)
  else if (!has(conversions)) profitAfterProductCost = calcFail(MSG.noConversions)
  else if (rev === null) profitAfterProductCost = calcFail(MSG.noRevenue)
  else if (!has(adSpend)) profitAfterProductCost = calcFail(MSG.noSpend)
  else
    profitAfterProductCost = calcOk(
      rev - productCostPerConversion * conversions - adSpend - extraCosts
    )

  // Product cost is the more precise cost of goods, so it wins when given.
  const netProfitBasis: ProfitBasis | null = profitAfterProductCost.ok
    ? "product-cost"
    : profitAfterAds.ok
      ? "margin"
      : null
  const netProfit =
    netProfitBasis === "product-cost"
      ? profitAfterProductCost
      : netProfitBasis === "margin"
        ? profitAfterAds
        : calcFail("Podaj przychód, koszt reklamy i marżę (albo koszt produktu).")

  let costOfGoods: CalcResult
  if (netProfitBasis === "product-cost")
    costOfGoods = calcOk(productCostPerConversion! * conversions!)
  else if (netProfitBasis === "margin") costOfGoods = calcOk(rev! * (1 - margin!))
  else costOfGoods = netProfit

  // netProfit.ok implies adSpend is known, so costOfGoods carries any failure reason.
  const totalCosts = costOfGoods.ok
    ? calcOk(costOfGoods.value + adSpend! + extraCosts)
    : costOfGoods

  let roi: CalcResult
  if (!netProfit.ok) roi = netProfit
  else if (!totalCosts.ok) roi = totalCosts
  else if (totalCosts.value === 0)
    roi = calcFail("Całkowite koszty wynoszą 0, ROI nie ma sensu.")
  else roi = calcOk((netProfit.value / totalCosts.value) * 100)

  return {
    ctr,
    cpc,
    conversionRate,
    cpa,
    revenue,
    revenueDerived,
    avgOrderValue,
    avgOrderValueDerived,
    roas,
    profitAfterAds,
    profitAfterProductCost,
    netProfit,
    netProfitBasis,
    totalCosts,
    costOfGoods,
    roi,
    breakEvenRoas: has(marginPercent)
      ? breakEvenRoas(marginPercent)
      : calcFail(MSG.noMargin),
    breakEvenCpa:
      aov === null ? avgOrderValue : marginValid ? calcOk(aov * margin) : marginFail,
    maxCpa:
      aov === null
        ? avgOrderValue
        : !has(marginPercent)
          ? calcFail(MSG.noMargin)
          : maxCpa(
              aov,
              marginPercent,
              extraCosts > 0 && has(conversions) && conversions > 0
                ? extraCosts / conversions
                : 0
            ),
    status: profitStatus(netProfit, rev),
  }
}

function profitStatus(
  netProfit: CalcResult,
  revenue: number | null
): ProfitStatus | null {
  if (!netProfit.ok) return null
  const tolerance = Math.abs(revenue ?? 0) * BREAKEVEN_TOLERANCE
  if (Math.abs(netProfit.value) <= tolerance) return "breakeven"
  return netProfit.value > 0 ? "profit" : "loss"
}
