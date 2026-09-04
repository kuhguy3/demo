// Overround / margin / hold for a market, plus fair (de-vigged) prices.
import { Result, ok, err } from './result';
import { impliedProbability, deVig, type DeVigMethod } from './probability';

export interface MarginResult {
  /** S = sum of implied probabilities across all outcomes. */
  overround: number;
  /** (S - 1) as a fraction — the "overround" percentage figure. */
  overroundPct: number;
  /** (S - 1)/S — the fraction of stakes the book keeps ("hold"/margin). */
  holdPct: number;
  /** Per-outcome implied probabilities (with vig). */
  impliedProbs: number[];
  /** Per-outcome fair probabilities, computed with the chosen de-vig method. */
  fairProbs: number[];
  method: DeVigMethod;
  /** Shin's estimated insider proportion — only set when method is 'shin'. */
  shinZ?: number;
}

/**
 * Compute overround, hold, and fair probabilities from a market's decimal odds.
 * `method` selects how the vig is removed to estimate fair probabilities —
 * see src/engine/probability.ts for the tradeoffs between 'proportional' and
 * 'shin'.
 */
export function margin(decimals: number[], method: DeVigMethod = 'proportional'): Result<MarginResult> {
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

  const dv = deVig(decimals, method);
  if (!dv.ok) return dv;

  return ok({
    overround,
    overroundPct,
    holdPct,
    impliedProbs,
    fairProbs: dv.value.fairProbs,
    method,
    shinZ: dv.value.shinZ,
  });
}
