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

export type DeVigMethod = 'proportional';

export interface DeVigResult {
  method: DeVigMethod;
  overround: number; // S = sum of implied probs
  fairProbs: number[];
  fairDecimals: number[];
}

/**
 * Remove the vig from a market's decimal odds to estimate fair probabilities.
 *
 * MVP method = proportional (multiplicative): fair_i = (1/d_i) / S.
 * NOTE: proportional de-vig is simple but biased (it over-taxes favorites).
 * The method is a parameter so better methods (Shin / power) can be added later.
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
  const fairProbs = implied.map((i) => i / S);
  const fairDecimals = fairProbs.map((p) => 1 / p);
  return ok({ method, overround: S, fairProbs, fairDecimals });
}
