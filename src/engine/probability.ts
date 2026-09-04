// Probability: implied (with vig), fair odds, and market de-vig.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';
import { validateDecimal } from './odds';

/** Validate a probability in [0, 1]. Boundaries 0 and 1 are allowed. */
export function validateProbability(p: number): Result<number> {
  if (!isFiniteNumber(p)) {
    return err('INVALID_PROBABILITY', 'Enter a valid probability.', 'probability');
  }
  if (p < 0 || p > 1) {
    return err('INVALID_PROBABILITY', 'Probability must be between 0% and 100%.', 'probability');
  }
  return ok(p);
}

/** Implied probability from decimal odds: P = 1/d. This is WITH the bookmaker vig. */
export function impliedProbability(d: number): Result<number> {
  const v = validateDecimal(d);
  if (!v.ok) return v;
  return ok(1 / d);
}

/** Fair decimal odds from a probability estimate: d = 1/p. */
export function fairDecimalOdds(p: number): Result<number> {
  const v = validateProbability(p);
  if (!v.ok) return v;
  if (p === 0) return ok(Infinity); // certain loss → infinite fair price
  return ok(1 / p);
}

export type DeVigMethod = 'proportional' | 'shin';

export interface DeVigResult {
  method: DeVigMethod;
  overround: number; // S = sum of implied probs
  fairProbs: number[];
  fairDecimals: number[];
  /** Shin's estimated "insider" proportion z ∈ [0, 1). Only set for method 'shin'. */
  shinZ?: number;
}

/**
 * Proportional (multiplicative) de-vig: fair_i = (1/d_i) / S.
 * Simple, but biased — it over-taxes favorites relative to longshots because it
 * assumes the bookmaker's margin is spread evenly across outcomes in proportion
 * to their raw implied probability, which empirically it is not (the
 * "favorite-longshot bias").
 */
function proportionalFair(implied: number[], S: number): number[] {
  return implied.map((i) => i / S);
}

/**
 * Shin's (1992, 1993) method models the overround as arising from a fraction z
 * of "insider" money rather than an even tax, which better matches the
 * empirically observed favorite-longshot bias. Given the raw implied
 * probabilities π_i (summing to S = overround), the true probabilities satisfy:
 *
 *   p_i(z) = ( sqrt(z² + 4(1−z)·πᵢ²/S) − z ) / (2(1−z))
 *
 * z is the unique root in [0, 1) of Σ p_i(z) = 1. p_i(z) is continuous and
 * strictly decreasing in z (checked at the boundaries: at z=0, Σp_i = √S > 1
 * since S>1; the sum decreases as z→1), so it is found by bisection.
 */
function shinFair(implied: number[], S: number): { fairProbs: number[]; z: number } {
  const sumAt = (z: number): number => {
    if (z <= 0) return implied.reduce((a, p) => a + p / Math.sqrt(S), 0);
    let sum = 0;
    for (const p of implied) {
      sum += (Math.sqrt(z * z + (4 * (1 - z) * p * p) / S) - z) / (2 * (1 - z));
    }
    return sum;
  };

  let lo = 0;
  let hi = 1 - 1e-9;
  // Guard: if even the z→1 limit can't bring the sum down to 1 (degenerate
  // markets with extreme favorites), fall back to the upper bound rather than
  // looping forever — proportional is used as the practical fallback by callers.
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const s = sumAt(mid);
    if (s > 1) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const fairProbs = implied.map(
    (p) => (Math.sqrt(z * z + (4 * (1 - z) * p * p) / S) - z) / (2 * (1 - z)),
  );
  return { fairProbs, z };
}

/**
 * Remove the vig from a market's decimal odds to estimate fair probabilities.
 *
 * Two methods:
 *  - 'proportional' (default): simple, but over-taxes favorites (see above).
 *  - 'shin': accounts for favorite-longshot bias; generally a better estimate
 *    for markets with a clear favorite, at the cost of being harder to explain.
 */
export function deVig(decimals: number[], method: DeVigMethod = 'proportional'): Result<DeVigResult> {
  if (decimals.length < 2) {
    return err('EMPTY_INPUT', 'Provide odds for at least two outcomes to de-vig a market.', 'odds');
  }
  const implied: number[] = [];
  for (const d of decimals) {
    const v = impliedProbability(d);
    if (!v.ok) return v;
    implied.push(v.value);
  }
  const S = implied.reduce((a, b) => a + b, 0);
  if (S <= 0) {
    return err('NON_FINITE_RESULT', 'Could not compute fair probabilities from these odds.', 'odds');
  }

  if (method === 'shin') {
    const { fairProbs, z } = shinFair(implied, S);
    const fairDecimals = fairProbs.map((p) => 1 / p);
    return ok({ method, overround: S, fairProbs, fairDecimals, shinZ: z });
  }

  const fairProbs = proportionalFair(implied, S);
  const fairDecimals = fairProbs.map((p) => 1 / p);
  return ok({ method, overround: S, fairProbs, fairDecimals });
}
