// ROI / yield and drawdown definitions for the tracker & simulator.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';

export interface RoiResult {
  /** Yield: profit / total staked (turnover). The standard betting "ROI". */
  yield: number;
  /** ROI on bankroll: profit / starting bankroll. */
  roiBankroll: number;
  profit: number;
  turnover: number;
}

export function roi(profit: number, turnover: number, startingBankroll: number): Result<RoiResult> {
  if (!isFiniteNumber(profit) || !isFiniteNumber(turnover) || !isFiniteNumber(startingBankroll)) {
    return err('INVALID_NUMBER', 'ROI inputs must be valid numbers.');
  }
  return ok({
    yield: turnover > 0 ? profit / turnover : 0,
    roiBankroll: startingBankroll > 0 ? profit / startingBankroll : 0,
    profit,
    turnover,
  });
}

export interface DrawdownResult {
  /** Max peak-to-trough decline as a fraction of the running high-water mark. */
  maxDrawdownPct: number;
  /** Max peak-to-trough decline in absolute currency. */
  maxDrawdownAbs: number;
}

/**
 * Compute maximum drawdown over a bankroll series (index 0 = starting value).
 * Drawdown_t = (peak_t - value_t) / peak_t, peak_t = running max.
 */
export function maxDrawdown(series: number[]): Result<DrawdownResult> {
  if (series.length === 0) {
    return err('EMPTY_INPUT', 'Bankroll series is empty.');
  }
  let peak = series[0]!;
  let maxPct = 0;
  let maxAbs = 0;
  for (const v of series) {
    if (!isFiniteNumber(v)) {
      return err('INVALID_NUMBER', 'Bankroll series contains an invalid value.');
    }
    if (v > peak) peak = v;
    const abs = peak - v;
    const pct = peak > 0 ? abs / peak : 0;
    if (abs > maxAbs) maxAbs = abs;
    if (pct > maxPct) maxPct = pct;
  }
  return ok({ maxDrawdownPct: maxPct, maxDrawdownAbs: maxAbs });
}
