/**
 * Sample-size checks for audit rules. A rule fires only when the data make the observation
 * unlikely to be chance, judged against the account's own conversion rate.
 */

/** P(X ≤ k) for X ~ Binomial(n, p), summed term by term (exact, stable for k ≪ n). */
export function binomialCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0
  if (k >= n || p <= 0) return 1
  if (p >= 1) return 0
  const q = 1 - p
  let term = Math.exp(n * Math.log(q)) // P(X = 0)
  let sum = term
  for (let i = 0; i < Math.floor(k); i++) {
    term *= ((n - i) / (i + 1)) * (p / q)
    sum += term
  }
  return Math.min(1, sum)
}

/**
 * How surprising is "k conversions or fewer in n clicks" if the true rate were p (the account
 * average)? Small values mean the entity converts worse than the account, beyond chance.
 */
export const pLower = (k: number, n: number, p: number) =>
  binomialCdf(Math.round(k), Math.round(n), p)

/** The same for "k conversions or more": the entity converts better than the account. */
export const pHigher = (k: number, n: number, p: number) =>
  1 - binomialCdf(Math.round(k) - 1, Math.round(n), p)

/**
 * Clicks needed before zero conversions becomes meaningful at rate p: (1 − p)ⁿ < α.
 * With p = 3% that is about 99 clicks; with 1% about 299.
 */
export function clicksToJudge(p: number, alpha = 0.05): number {
  if (p <= 0 || p >= 1) return Infinity
  return Math.ceil(Math.log(alpha) / Math.log(1 - p))
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}
