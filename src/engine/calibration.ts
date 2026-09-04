// Probability calibration and closing-line value (CLV) — the analytics that
// answer "were my own probability estimates actually any good?", using only
// the bets a user has tracked and settled. Pure and framework-free, like the
// rest of the engine; the tracker persistence layer feeds it plain data.
import { Result, ok, err } from './result';
import { validateDecimal } from './odds';
import { validateProbability } from './probability';
import { isFiniteNumber } from './math-utils';

/**
 * Closing-line value: the relative difference between the price you took and
 * the price the market closed at. Positive CLV (you got a better price than
 * the close) is a well-established proxy for making sharp decisions,
 * independent of whether any single bet actually won.
 *
 * clv = takenDecimal / closingDecimal − 1
 */
export function clv(takenDecimal: number, closingDecimal: number): Result<number> {
  const vt = validateDecimal(takenDecimal);
  if (!vt.ok) return vt;
  const vc = validateDecimal(closingDecimal);
  if (!vc.ok) return { ok: false, error: { ...vc.error, field: 'closingDecimal' } };
  return ok(takenDecimal / closingDecimal - 1);
}

export interface CalibrationInput {
  /** The probability estimated at the time the bet was placed, in [0, 1]. */
  estimatedProb: number;
  /** True if the bet won, false if it lost. (Void/pending bets are excluded by callers.) */
  won: boolean;
}

export interface CalibrationBucket {
  probLow: number;
  probHigh: number;
  /** Mean of the estimated probabilities that fell in this bucket. */
  predictedAvg: number;
  /** Actual win rate of bets in this bucket. */
  actualRate: number;
  n: number;
}

export interface CalibrationResult {
  buckets: CalibrationBucket[];
  /** Mean squared error between estimate and outcome (0=won,1=... see below); lower is better, 0 is perfect, 1 is worst possible. */
  brierScore?: number;
  /** Number of settled bets with a probability estimate that were used. */
  n: number;
}

/**
 * Bucket settled, probability-estimated bets by their estimated probability
 * and compare the average estimate in each bucket to the bucket's actual win
 * rate — the standard "reliability diagram" input. Also computes the Brier
 * score (mean squared error of estimate vs. outcome) as a single-number
 * summary. Returns an empty result (n=0) rather than an error when there is
 * no data — "not enough data yet" is a normal state, not invalid input.
 */
export function calibration(bets: CalibrationInput[], bucketSize = 0.2): Result<CalibrationResult> {
  if (!isFiniteNumber(bucketSize) || bucketSize <= 0 || bucketSize > 1) {
    return err('OUT_OF_RANGE', 'Bucket size must be between 0 and 1.', 'bucketSize');
  }
  for (const b of bets) {
    const vp = validateProbability(b.estimatedProb);
    if (!vp.ok) return vp;
  }

  if (bets.length === 0) {
    return ok({ buckets: [], n: 0 });
  }

  const bucketCount = Math.ceil(1 / bucketSize);
  const sums = new Array(bucketCount).fill(0) as number[];
  const wins = new Array(bucketCount).fill(0) as number[];
  const counts = new Array(bucketCount).fill(0) as number[];

  let sqErrSum = 0;
  for (const b of bets) {
    const idx = Math.min(bucketCount - 1, Math.floor(b.estimatedProb / bucketSize));
    sums[idx] = sums[idx]! + b.estimatedProb;
    counts[idx] = counts[idx]! + 1;
    if (b.won) wins[idx] = wins[idx]! + 1;
    const outcome = b.won ? 1 : 0;
    sqErrSum += (b.estimatedProb - outcome) ** 2;
  }

  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    if (counts[i]! === 0) continue;
    buckets.push({
      probLow: i * bucketSize,
      probHigh: Math.min(1, (i + 1) * bucketSize),
      predictedAvg: sums[i]! / counts[i]!,
      actualRate: wins[i]! / counts[i]!,
      n: counts[i]!,
    });
  }

  return ok({ buckets, brierScore: sqErrSum / bets.length, n: bets.length });
}
