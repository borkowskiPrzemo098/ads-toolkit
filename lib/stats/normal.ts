/**
 * Standard normal distribution helpers. erf uses Abramowitz & Stegun 7.1.26
 * (|error| < 1.5e-7), plenty for p-values shown to three decimals.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-a * a))
}

/** P(Z ≤ z) for Z ~ N(0, 1). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Two-sided p-value for a z statistic. */
export function twoSidedP(z: number): number {
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))
}

/** z for 95% two-sided confidence (α = 0.05). */
export const Z_95 = 1.959963984540054
/** z for 80% power (β = 0.2), one-sided. */
export const Z_POWER_80 = 0.8416212335729143
