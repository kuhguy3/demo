// Parlay (accumulator) mathematics. Combined odds = product of legs.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';
import { validateDecimal } from './odds';
import { validateProbability } from './probability';

export const MAX_PARLAY_LEGS = 25;

export interface ParlayLegInput {
  decimal: number;
  /** Optional true probability for this leg (to compute honest EV). */
  p?: number;
}

export interface ParlayResult {
  combinedDecimal: number;
  /** 1 / combinedDecimal — implied probability WITH compounded vig. */
  combinedImplied: number;
  /** Product of per-leg true probabilities, if all provided (independence assumed). */
  trueCombinedProb?: number;
  /** EV per unit if true probabilities are provided: trueProb*combinedDecimal - 1. */
  evPerUnit?: number;
}

/**
 * Combine parlay legs. Assumes leg independence for probability/EV — this fails
 * for correlated markets, which callers should warn about.
 */
export function parlay(legs: ParlayLegInput[]): Result<ParlayResult> {
  if (legs.length < 2) {
    return err('EMPTY_INPUT', 'A parlay needs at least two legs.', 'legs');
  }
  if (legs.length > MAX_PARLAY_LEGS) {
    return err('TOO_MANY_LEGS', `A parlay can have at most ${MAX_PARLAY_LEGS} legs.`, 'legs');
  }

  let combinedDecimal = 1;
  let allProbs = true;
  let trueCombinedProb = 1;

  for (const leg of legs) {
    const vd = validateDecimal(leg.decimal);
    if (!vd.ok) return vd;
    combinedDecimal *= leg.decimal;

    if (leg.p === undefined) {
      allProbs = false;
    } else {
      const vp = validateProbability(leg.p);
      if (!vp.ok) return vp;
      trueCombinedProb *= leg.p;
    }
  }

  if (!isFiniteNumber(combinedDecimal)) {
    return err('NON_FINITE_RESULT', 'Combined odds are too large to represent — remove some legs.', 'legs');
  }

  const result: ParlayResult = {
    combinedDecimal,
    combinedImplied: 1 / combinedDecimal,
  };
  if (allProbs) {
    result.trueCombinedProb = trueCombinedProb;
    result.evPerUnit = trueCombinedProb * combinedDecimal - 1;
  }
  return ok(result);
}
