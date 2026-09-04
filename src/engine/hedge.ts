// Hedging: given an existing bet, size a second bet on the opposing outcome
// so the payout is equalized regardless of which outcome wins.
//
// Original bet: stake S1 at decimal odds d1 on outcome A (already placed).
// Hedge bet: stake S2 at decimal odds d2 on outcome B (mutually exclusive
// with A — e.g. the same market's other side, now at a different price).
//
// Equalizing the two possible profits (A wins vs B wins) gives:
//   S1*d1 - S1 - S2  =  S2*d2 - S1 - S2
//   S1*d1  =  S2*d2
//   S2  =  S1*d1 / d2
import { Result, ok, err } from './result';
import { validateDecimal } from './odds';
import { validateStake } from './ev';

export interface HedgeResult {
  /** Stake to place on the hedge (opposing) side. */
  hedgeStake: number;
  /** Guaranteed net profit if the original bet's outcome wins. */
  profitIfOriginalWins: number;
  /** Guaranteed net profit if the hedge bet's outcome wins. */
  profitIfHedgeWins: number;
  /** Total money committed (original stake + hedge stake). */
  totalStaked: number;
  /** Whether hedging locks in a guaranteed profit (both outcomes > 0). */
  guaranteedProfit: boolean;
}

export function hedge(
  originalStake: number,
  originalDecimal: number,
  hedgeDecimal: number,
): Result<HedgeResult> {
  const vs = validateStake(originalStake);
  if (!vs.ok) return vs;
  if (originalStake === 0) {
    return err('INVALID_STAKE', 'Enter the stake you already have on the original bet.', 'originalStake');
  }
  const vd1 = validateDecimal(originalDecimal);
  if (!vd1.ok) return vd1;
  const vd2 = validateDecimal(hedgeDecimal);
  if (!vd2.ok) return { ok: false, error: { ...vd2.error, field: 'hedgeDecimal' } };

  const hedgeStake = (originalStake * originalDecimal) / hedgeDecimal;
  const totalStaked = originalStake + hedgeStake;
  // Both branches equal by construction (S1*d1 = S2*d2), computed independently
  // as a correctness check / for display.
  const profitIfOriginalWins = originalStake * originalDecimal - totalStaked;
  const profitIfHedgeWins = hedgeStake * hedgeDecimal - totalStaked;

  return ok({
    hedgeStake,
    profitIfOriginalWins,
    profitIfHedgeWins,
    totalStaked,
    guaranteedProfit: profitIfOriginalWins > 0 && profitIfHedgeWins > 0,
  });
}
