import { twoSidedP, Z_95, Z_POWER_80 } from "@/lib/stats/normal"
import { calcFail, calcOk, type CalcResult } from "@/types/calculation"

/** Significance level from the spec: two-sided test at α = 0.05. */
export const ALPHA = 0.05
/** Normal approximation needs at least this many expected conversions and non-conversions. */
export const MIN_EXPECTED = 5
/** p-values between α and this are reported as a trend worth watching, not as "no effect". */
const TREND_P = 0.2
/** If the observed effect would be confirmed within this many times the current sample, keep testing. */
const REACHABLE_FACTOR = 3

export interface VariantInput {
  visitors: number | null
  conversions: number | null
  cost: number | null
}

export interface Interval {
  low: number
  high: number
}

export interface VariantStats {
  rate: CalcResult
  /** Wilson score interval for the conversion rate (95%). */
  rateInterval: Interval | null
  cpa: CalcResult
  costPerVisit: CalcResult
}

export type Verdict = "insufficient" | "significant" | "not-significant" | "keep-testing"

export interface AbTestResult {
  a: VariantStats
  b: VariantStats
  /** pB − pA as a proportion (0.01 = 1 percentage point). */
  absoluteDiff: CalcResult
  /** (pB − pA) / pA × 100%. */
  relativeDiff: CalcResult
  z: number | null
  pValue: number | null
  /** Newcombe hybrid score interval for pB − pA (95%). */
  diffInterval: Interval | null
  verdict: Verdict
  /** Why the verdict is "insufficient", in Polish. */
  insufficientReason: string | null
  /** Visitors per variant needed to confirm the observed difference (80% power, α 0.05). */
  requiredPerVariant: number | null
  /** Smallest relative change the current sample would detect with 80% power. */
  minimumDetectableRelative: number | null
  /** Traffic split far from 50/50 (chi-square p < 0.001). */
  sampleRatioMismatch: boolean
  /** z-test and interval disagree on whether zero is plausible: a borderline result. */
  borderline: boolean
}

const MSG = {
  visitors: "Podaj liczbę wizyt lub kliknięć.",
  conversions: "Podaj liczbę konwersji.",
  zeroVisitors: "Brak wizyt.",
  cost: "Podaj koszt, aby policzyć CPA.",
  zeroConversions: "Brak konwersji, więc CPA nie istnieje.",
} as const

/** Wilson score interval: well-behaved for 0% and 100% and small samples. */
export function wilsonInterval(successes: number, n: number, z = Z_95): Interval {
  const p = successes / n
  const z2 = z * z
  const denominator = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denominator
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) }
}

/** Newcombe's method 10 for a difference of two proportions, built from Wilson intervals. */
export function newcombeInterval(
  xA: number,
  nA: number,
  xB: number,
  nB: number
): Interval {
  const pA = xA / nA
  const pB = xB / nB
  const a = wilsonInterval(xA, nA)
  const b = wilsonInterval(xB, nB)
  const d = pB - pA
  return {
    low: d - Math.sqrt((pB - b.low) ** 2 + (a.high - pA) ** 2),
    high: d + Math.sqrt((b.high - pB) ** 2 + (pA - a.low) ** 2),
  }
}

/** Two-sided pooled two-proportion z-test. Returns null when the pooled rate is 0 or 1. */
export function twoProportionZ(xA: number, nA: number, xB: number, nB: number) {
  const pooled = (xA + xB) / (nA + nB)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB))
  if (se === 0) return null
  const z = (xB / nB - xA / nA) / se
  return { z, pValue: twoSidedP(z) }
}

/** Visitors per variant to detect pA → pB with 80% power at α = 0.05 (two-sided). */
export function sampleSizePerVariant(pA: number, pB: number): number | null {
  if (pA === pB) return null
  const pBar = (pA + pB) / 2
  const numerator =
    Z_95 * Math.sqrt(2 * pBar * (1 - pBar)) +
    Z_POWER_80 * Math.sqrt(pA * (1 - pA) + pB * (1 - pB))
  return Math.ceil(numerator ** 2 / (pA - pB) ** 2)
}

/** Smallest relative lift detectable with 80% power, given baseline rate and n per variant. */
export function minimumDetectableRelative(baseline: number, n: number): number | null {
  if (baseline <= 0 || baseline >= 1 || n <= 0) return null
  const delta = (Z_95 + Z_POWER_80) * Math.sqrt((2 * baseline * (1 - baseline)) / n)
  return (delta / baseline) * 100
}

/** Chi-square test of a 50/50 split; true when the imbalance is very unlikely by chance. */
function splitMismatch(nA: number, nB: number): boolean {
  const expected = (nA + nB) / 2
  const chi2 = ((nA - expected) ** 2 + (nB - expected) ** 2) / expected
  // χ²(1) > 10.83 ⇔ p < 0.001
  return chi2 > 10.828
}

function variantStats(v: VariantInput): VariantStats {
  const { visitors: n, conversions: x, cost } = v
  let rate: CalcResult
  if (n === null) rate = calcFail(MSG.visitors)
  else if (x === null) rate = calcFail(MSG.conversions)
  else if (n === 0) rate = calcFail(MSG.zeroVisitors)
  else rate = calcOk((x / n) * 100)

  const rateInterval = rate.ok && n !== null && x !== null ? wilsonInterval(x, n) : null

  let cpa: CalcResult
  if (cost === null) cpa = calcFail(MSG.cost)
  else if (x === null) cpa = calcFail(MSG.conversions)
  else if (x === 0) cpa = calcFail(MSG.zeroConversions)
  else cpa = calcOk(cost / x)

  let costPerVisit: CalcResult
  if (cost === null) costPerVisit = calcFail(MSG.cost)
  else if (n === null) costPerVisit = calcFail(MSG.visitors)
  else if (n === 0) costPerVisit = calcFail(MSG.zeroVisitors)
  else costPerVisit = calcOk(cost / n)

  return { rate, rateInterval, cpa, costPerVisit }
}

/** Reason the inputs cannot support a test, or null when they can. */
export function inputProblem(a: VariantInput, b: VariantInput): string | null {
  for (const [name, v] of [
    ["A", a],
    ["B", b],
  ] as const) {
    if (v.visitors === null || v.conversions === null) {
      return `Uzupełnij wizyty i konwersje wariantu ${name}.`
    }
    if (v.visitors === 0) return `Wariant ${name} nie ma wizyt.`
    if (v.conversions > v.visitors) {
      return `Wariant ${name} ma więcej konwersji niż wizyt. Test proporcji wymaga, by każda wizyta konwertowała najwyżej raz; użyj liczby konwertujących wizyt.`
    }
  }
  return null
}

export function analyzeAbTest(a: VariantInput, b: VariantInput): AbTestResult {
  const statsA = variantStats(a)
  const statsB = variantStats(b)
  const empty = {
    a: statsA,
    b: statsB,
    absoluteDiff: calcFail("Uzupełnij dane obu wariantów."),
    relativeDiff: calcFail("Uzupełnij dane obu wariantów."),
    z: null,
    pValue: null,
    diffInterval: null,
    requiredPerVariant: null,
    minimumDetectableRelative: null,
    sampleRatioMismatch: false,
    borderline: false,
  }

  const problem = inputProblem(a, b)
  if (problem) {
    return { ...empty, verdict: "insufficient", insufficientReason: problem }
  }

  const nA = a.visitors!
  const xA = a.conversions!
  const nB = b.visitors!
  const xB = b.conversions!
  const pA = xA / nA
  const pB = xB / nB

  const absoluteDiff = calcOk(pB - pA)
  const relativeDiff =
    pA === 0
      ? calcFail(
          "Wariant A nie ma konwersji, więc różnicy względnej nie da się policzyć."
        )
      : calcOk(((pB - pA) / pA) * 100)

  const base = {
    ...empty,
    absoluteDiff,
    relativeDiff,
    diffInterval: newcombeInterval(xA, nA, xB, nB),
    sampleRatioMismatch: splitMismatch(nA, nB),
    minimumDetectableRelative: minimumDetectableRelative(pA, Math.min(nA, nB)),
    requiredPerVariant: sampleSizePerVariant(pA, pB),
  }

  const test = twoProportionZ(xA, nA, xB, nB)
  if (!test) {
    return {
      ...base,
      verdict: "insufficient",
      insufficientReason:
        xA + xB === 0
          ? "Żaden wariant nie ma konwersji. Nie da się porównać współczynników."
          : "Wszystkie wizyty w obu wariantach skończyły się konwersją. Nie da się porównać współczynników.",
    }
  }

  // Normal approximation check: expected conversions and non-conversions in each variant.
  const pooled = (xA + xB) / (nA + nB)
  const expected = [nA * pooled, nA * (1 - pooled), nB * pooled, nB * (1 - pooled)]
  if (expected.some((e) => e < MIN_EXPECTED)) {
    return {
      ...base,
      z: test.z,
      pValue: test.pValue,
      verdict: "insufficient",
      insufficientReason: `Za mało danych: każdy wariant potrzebuje oczekiwanych co najmniej ${MIN_EXPECTED} konwersji i ${MIN_EXPECTED} wizyt bez konwersji, aby test był wiarygodny.`,
    }
  }

  const significant = test.pValue < ALPHA
  const intervalExcludesZero = base.diffInterval!.low > 0 || base.diffInterval!.high < 0

  let verdict: Verdict
  if (significant) verdict = "significant"
  else if (
    test.pValue < TREND_P ||
    (base.requiredPerVariant !== null &&
      base.requiredPerVariant <= Math.max(nA, nB) * REACHABLE_FACTOR)
  ) {
    verdict = "keep-testing"
  } else verdict = "not-significant"

  return {
    ...base,
    z: test.z,
    pValue: test.pValue,
    verdict,
    insufficientReason: null,
    borderline: significant !== intervalExcludesZero,
  }
}
