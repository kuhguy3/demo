// Kelly criterion staking. f* = (b*p - q)/b = (p*d - 1)/(d - 1), b = d-1, q = 1-p.
import { Result, ok } from './result';
import { validateDecimal } from './odds';
import { validateProbability } from './probability';
import { clamp } from './math-utils';

export interface KellyResult {
  /** Full Kelly fraction of bankroll. Can be negative (→ no bet). */
  full: number;
  /** The fraction actually applied (full * fraction), floored at 0 for staking. */
  fraction: number; // e.g. 1, 0.5, 0.25
  used: number; // full * fraction, but never below 0 for a recommended stake
  /** Suggested stake in currency, if a bankroll is provided. */
  stake?: number;
  /** True when full > 1 — implies near-certainty; treat as suspicious input. */
  suspicious: boolean;
  /** True when full <= 0 — no mathematical edge, do not bet. */
  noBet: boolean;
}

/**
 * Kelly fraction for a single decimal-odds bet.
 * @param fraction fractional-Kelly multiplier (1 = full, 0.5 = half, 0.25 = quarter)
 * @param bankroll optional; when given, `stake` is returned
 */
export function kelly(p: number, d: number, fraction = 1, bankroll?: number): Result<KellyResult> {
  const vp = validateProbability(p);
  if (!vp.ok) return vp;
  const vd = validateDecimal(d);
  if (!vd.ok) return vd;

  const b = d - 1;
  const full = (p * d - 1) / b; // == (b*p - (1-p))/b
  const noBet = full <= 0;
  const suspicious = full > 1;

  // For a recommended stake, never go negative; cap at 1 (100% of bankroll).
  const usedRaw = full * fraction;
  const used = clamp(usedRaw <= 0 ? 0 : usedRaw, 0, 1);

  const result: KellyResult = { full, fraction, used, suspicious, noBet };
  if (bankroll !== undefined && Number.isFinite(bankroll) && bankroll >= 0) {
    result.stake = used * bankroll;
  }
  return ok(result);
}
