// Expected value for a single decimal-odds bet.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';
import { validateDecimal } from './odds';
import { validateProbability } from './probability';

export interface EvResult {
  evPerUnit: number; // p*d - 1  (expected profit per unit staked)
  ev: number; // stake * evPerUnit  (expected net profit)
  breakEvenProb: number; // 1/d  (the probability at which EV = 0)
  positive: boolean;
}

export function validateStake(stake: number): Result<number> {
  if (!isFiniteNumber(stake)) {
    return err('INVALID_STAKE', 'Enter a valid stake.', 'stake');
  }
  if (stake < 0) {
    return err('INVALID_STAKE', 'Stake cannot be negative.', 'stake');
  }
  return ok(stake);
}

/** EV = stake * (p*d - 1). Net expected profit. */
export function expectedValue(p: number, d: number, stake = 1): Result<EvResult> {
  const vp = validateProbability(p);
  if (!vp.ok) return vp;
  const vd = validateDecimal(d);
  if (!vd.ok) return vd;
  const vs = validateStake(stake);
  if (!vs.ok) return vs;

  const evPerUnit = p * d - 1;
  const ev = stake * evPerUnit;
  const breakEvenProb = 1 / d;
  return ok({ evPerUnit, ev, breakEvenProb, positive: evPerUnit > 0 });
}
