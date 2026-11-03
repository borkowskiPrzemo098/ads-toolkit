/**
 * Every calculation returns either a value or the reason it could not be computed.
 * UI shows the reason instead of a misleading 0, NaN or Infinity.
 */
export type CalcResult<T = number> =
  { ok: true; value: T } | { ok: false; reason: string }

export const calcOk = <T>(value: T): CalcResult<T> => ({ ok: true, value })
export const calcFail = (reason: string): CalcResult<never> => ({ ok: false, reason })
