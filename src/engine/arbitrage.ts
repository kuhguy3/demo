// Arbitrage detection and stake allocation for mutually exclusive outcomes.
import { Result, ok, err } from './result';
import { validateDecimal } from './odds';
import { validateStake } from './ev';

export interface ArbAllocation {
  index: number;
  stake: number;
  payout: number;
}

export interface ArbResult {
  /** S = sum(1/d_i). Arbitrage exists iff S < 1. */
  sum: number;
  exists: boolean;
  /** Guaranteed ROI on total stake: 1/S - 1 (only meaningful when exists). */
  roi: number;
  /** Guaranteed return on every outcome: total/S. */
  guaranteedReturn: number;
  allocation: ArbAllocation[];
}

/**
 * Best-price-per-outcome is assumed already chosen; pass one decimal per outcome.
 * @param total total stake to distribute
 */
export function arbitrage(decimals: number[], total = 100): Result<ArbResult> {
  if (decimals.length < 2) {
    return err('EMPTY_INPUT', 'Enter odds for at least two outcomes.', 'odds');
  }
  const vt = validateStake(total);
  if (!vt.ok) return vt;

  let sum = 0;
  for (const d of decimals) {
    const v = validateDecimal(d);
    if (!v.ok) return v;
    sum += 1 / d;
  }

  const exists = sum < 1;
  const guaranteedReturn = total / sum;
  const roi = 1 / sum - 1;
  const allocation: ArbAllocation[] = decimals.map((d, index) => {
    const stake = (total * (1 / d)) / sum;
    return { index, stake, payout: stake * d };
  });

  return ok({ sum, exists, roi, guaranteedReturn, allocation });
}
