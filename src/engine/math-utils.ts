// Numeric helpers used across the engine. Keep display rounding separate from
// internal precision: compute at full precision, round only for presentation.

export const EPSILON = 1e-9;

/** Is `x` a real, finite number (rejects NaN, Infinity, non-numbers)? */
export function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Compare floats with tolerance. */
export function approxEqual(a: number, b: number, epsilon = EPSILON): boolean {
  return Math.abs(a - b) < epsilon;
}

/** True when |x| is within epsilon of zero. */
export function isNearZero(x: number, epsilon = EPSILON): boolean {
  return Math.abs(x) < epsilon;
}

/** Round to `dp` decimal places for display (half away from zero). */
export function round(x: number, dp = 4): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Clamp x into [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}
