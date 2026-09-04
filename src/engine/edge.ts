// Edge, disambiguated into three explicitly-labeled quantities.
// Never render a single unlabeled "edge".
import { Result, ok } from './result';
import { validateDecimal } from './odds';
import { impliedProbability, validateProbability } from './probability';

export interface EdgeResult {
  /** Reference probability the estimate is compared against (implied or fair). */
  referenceProb: number;
  /** p - referenceProb, in probability POINTS. */
  edgePoints: number;
  /** (p - ref)/ref, relative to the reference. Equals evPerUnit when ref = 1/d. */
  edgeRelative: number;
  /** p*d - 1: expected return per unit staked (same figure as relative edge vs implied). */
  evEdge: number;
}

/**
 * Compute edge of a probability estimate `p` against odds `d`.
 * If `referenceProb` is supplied (e.g. a de-vigged fair prob) it is used for the
 * points/relative edge; otherwise the market implied probability (1/d) is used.
 */
export function edge(p: number, d: number, referenceProb?: number): Result<EdgeResult> {
  const vp = validateProbability(p);
  if (!vp.ok) return vp;
  const vd = validateDecimal(d);
  if (!vd.ok) return vd;

  const implied = impliedProbability(d);
  if (!implied.ok) return implied;

  let ref = referenceProb ?? implied.value;
  if (referenceProb !== undefined) {
    const vr = validateProbability(referenceProb);
    if (!vr.ok) return vr;
    ref = referenceProb;
  }

  const edgePoints = p - ref;
  const edgeRelative = ref > 0 ? (p - ref) / ref : Infinity;
  const evEdge = p * d - 1;
  return ok({ referenceProb: ref, edgePoints, edgeRelative, evEdge });
}
