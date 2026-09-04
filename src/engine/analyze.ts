// Composite bet analysis — the engine behind the flagship /analyze page.
// Produces a full readout from odds + optional probability estimate.
import { Result, ok } from './result';
import { impliedProbability, validateProbability, fairDecimalOdds, deVig } from './probability';
import { validateDecimal } from './odds';
import { expectedValue } from './ev';
import { edge } from './edge';
import { kelly } from './kelly';

export type Verdict = 'positive' | 'negative' | 'neutral' | 'incomplete';

export interface AnalyzeInput {
  decimal: number; // the offered price (canonical)
  p?: number; // user probability estimate (optional → gates value layer)
  opposingDecimal?: number; // optional opposite-side price to de-vig a 2-way market
  stake?: number;
  bankroll?: number;
  kellyFraction?: number; // 1 | 0.5 | 0.25
}

export interface AnalyzeResult {
  decimal: number;
  impliedProb: number; // 1/d (with vig)
  breakEvenProb: number; // == impliedProb
  fairProbFromMarket?: number; // de-vigged, if opposing given
  // Value layer (present only when p is given):
  userProb?: number;
  fairDecimalFromUser?: number;
  edgePoints?: number;
  edgeRelative?: number;
  evPerUnit?: number;
  ev?: number;
  kellyFull?: number;
  kellyUsed?: number;
  kellyStake?: number;
  kellySuspicious?: boolean;
  verdict: Verdict;
  warnings: string[];
}

export function analyze(input: AnalyzeInput): Result<AnalyzeResult> {
  const vd = validateDecimal(input.decimal);
  if (!vd.ok) return vd;
  const d = input.decimal;

  const impliedR = impliedProbability(d);
  if (!impliedR.ok) return impliedR;
  const impliedProb = impliedR.value;

  const warnings: string[] = [];
  const result: AnalyzeResult = {
    decimal: d,
    impliedProb,
    breakEvenProb: impliedProb,
    verdict: 'incomplete',
    warnings,
  };

  // Optional de-vig from opposing side.
  let fairProbFromMarket: number | undefined;
  if (input.opposingDecimal !== undefined) {
    const dv = deVig([d, input.opposingDecimal]);
    if (dv.ok) {
      fairProbFromMarket = dv.value.fairProbs[0];
      result.fairProbFromMarket = fairProbFromMarket;
    } else {
      warnings.push('Could not de-vig the market from the opposing odds provided.');
    }
  }

  // No probability estimate → stop after the market-only layer.
  if (input.p === undefined) {
    return ok(result);
  }

  const vp = validateProbability(input.p);
  if (!vp.ok) return vp;
  const p = input.p;
  const stake = input.stake ?? 1;

  result.userProb = p;

  const fdo = fairDecimalOdds(p);
  if (fdo.ok) result.fairDecimalFromUser = fdo.value;

  const evR = expectedValue(p, d, stake);
  if (evR.ok) {
    result.evPerUnit = evR.value.evPerUnit;
    result.ev = evR.value.ev;
  }

  const edgeR = edge(p, d, fairProbFromMarket);
  if (edgeR.ok) {
    result.edgePoints = edgeR.value.edgePoints;
    result.edgeRelative = edgeR.value.edgeRelative;
  }

  const kR = kelly(p, d, input.kellyFraction ?? 1, input.bankroll);
  if (kR.ok) {
    result.kellyFull = kR.value.full;
    result.kellyUsed = kR.value.used;
    result.kellyStake = kR.value.stake;
    result.kellySuspicious = kR.value.suspicious;
    if (kR.value.suspicious) {
      warnings.push('Kelly exceeds 100% — double-check your inputs; this implies near-certainty.');
    }
  }

  const evPerUnit = result.evPerUnit ?? 0;
  const EPS = 1e-9;
  if (evPerUnit > EPS) result.verdict = 'positive';
  else if (evPerUnit < -EPS) result.verdict = 'negative';
  else result.verdict = 'neutral';

  return ok(result);
}
