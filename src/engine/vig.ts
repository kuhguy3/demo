// Overround / margin / hold for a market, plus fair (de-vigged) prices.
import { Result, ok, err } from './result';
import { impliedProbability } from './probability';

export interface MarginResult {
  /** S = sum of implied probabilities across all outcomes. */
  overround: number;
  /** (S - 1) as a fraction — the "overround" percentage figure. */
  overroundPct: number;
  /** (S - 1)/S — the fraction of stakes the book keeps ("hold"/margin). */
  holdPct: number;
  /** Per-outcome implied probabilities (with vig). */
  impliedProbs: number[];
  /** Per-outcome fair probabilities (proportional de-vig). */
  fairProbs: number[];
}

/** Compute overround, hold, and fair probabilities from a market's decimal odds. */
export function margin(decimals: number[]): Result<MarginResult> {
  if (decimals.length < 2) {
    return err('EMPTY_INPUT', 'Enter odds for at least two outcomes.', 'odds');
  }
  const impliedProbs: number[] = [];
  for (const d of decimals) {
    const v = impliedProbability(d);
    if (!v.ok) return v;
    impliedProbs.push(v.value);
  }
  const overround = impliedProbs.reduce((a, b) => a + b, 0);
  const overroundPct = overround - 1;
  const holdPct = overround > 0 ? (overround - 1) / overround : 0;
  const fairProbs = impliedProbs.map((i) => i / overround);
  return ok({ overround, overroundPct, holdPct, impliedProbs, fairProbs });
}
