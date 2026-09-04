// Monte Carlo bankroll simulation. Pure and seedable so shared runs reproduce.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';
import { validateProbability } from './probability';
import { validateDecimal } from './odds';
import { mulberry32 } from './rng';
import { maxDrawdown } from './roi';

export type StakingRule = 'flat' | 'flatPct' | 'kelly';

export interface SimConfig {
  p: number; // true win probability per bet
  decimal: number; // decimal odds per bet
  bankroll: number; // starting bankroll
  bets: number; // number of sequential bets per run
  runs: number; // number of Monte Carlo runs
  staking: StakingRule;
  fraction?: number; // for flatPct (% of bankroll) or kelly (fractional Kelly)
  unit?: number; // for flat staking (currency per bet)
  seed: number;
  ruinThreshold?: number; // bankroll at/below which a run is "ruined"
}

export interface SimResult {
  finalBankrolls: number[];
  /** A capped sample of full bankroll paths (for plotting). */
  paths: number[][];
  median: number;
  mean: number;
  p05: number;
  p95: number;
  riskOfRuin: number; // fraction of runs that hit the ruin threshold
  medianMaxDrawdownPct: number;
}

export const SIM_LIMITS = { maxBets: 10_000, maxRuns: 100_000, maxPlottedPaths: 40 };

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx]!;
}

export function simulate(cfg: SimConfig): Result<SimResult> {
  const vp = validateProbability(cfg.p);
  if (!vp.ok) return vp;
  const vd = validateDecimal(cfg.decimal);
  if (!vd.ok) return vd;
  if (!isFiniteNumber(cfg.bankroll) || cfg.bankroll <= 0) {
    return err('INVALID_NUMBER', 'Starting bankroll must be positive.', 'bankroll');
  }
  if (!Number.isInteger(cfg.bets) || cfg.bets < 1 || cfg.bets > SIM_LIMITS.maxBets) {
    return err('OUT_OF_RANGE', `Number of bets must be between 1 and ${SIM_LIMITS.maxBets}.`, 'bets');
  }
  if (!Number.isInteger(cfg.runs) || cfg.runs < 1 || cfg.runs > SIM_LIMITS.maxRuns) {
    return err('OUT_OF_RANGE', `Number of runs must be between 1 and ${SIM_LIMITS.maxRuns}.`, 'runs');
  }

  const { p, decimal, bankroll, bets, runs, staking } = cfg;
  const b = decimal - 1;
  const fraction = cfg.fraction ?? 1;
  const unit = cfg.unit ?? bankroll * 0.01;
  const ruinThreshold = cfg.ruinThreshold ?? bankroll * 0.0; // default: exactly broke
  const kellyFull = (p * decimal - 1) / b;

  const rand = mulberry32(cfg.seed >>> 0);
  const finalBankrolls: number[] = new Array(runs);
  const paths: number[][] = [];
  const drawdowns: number[] = new Array(runs);
  let ruined = 0;
  const plotEvery = Math.max(1, Math.floor(runs / SIM_LIMITS.maxPlottedPaths));

  for (let r = 0; r < runs; r++) {
    let money = bankroll;
    const keepPath = r % plotEvery === 0 && paths.length < SIM_LIMITS.maxPlottedPaths;
    const path: number[] = keepPath ? [money] : [];
    let peak = money;
    let maxDd = 0;
    let hitRuin = false;

    for (let i = 0; i < bets; i++) {
      if (money <= ruinThreshold) {
        hitRuin = true;
        break;
      }
      let stake: number;
      if (staking === 'flat') {
        stake = Math.min(unit, money);
      } else if (staking === 'flatPct') {
        stake = money * fraction;
      } else {
        // kelly (fractional): never stake a negative Kelly
        stake = Math.max(0, kellyFull * fraction) * money;
      }
      const won = rand() < p;
      money += won ? stake * b : -stake;
      if (money < 0) money = 0;
      if (money > peak) peak = money;
      const dd = peak > 0 ? (peak - money) / peak : 0;
      if (dd > maxDd) maxDd = dd;
      if (keepPath) path.push(money);
    }

    if (money <= ruinThreshold) hitRuin = true;
    if (hitRuin) ruined++;
    finalBankrolls[r] = money;
    drawdowns[r] = maxDd;
    if (keepPath) paths.push(path);
  }

  const sorted = [...finalBankrolls].sort((a, b) => a - b);
  const sortedDd = [...drawdowns].sort((a, b) => a - b);
  const mean = finalBankrolls.reduce((a, b) => a + b, 0) / runs;

  return ok({
    finalBankrolls,
    paths,
    median: percentile(sorted, 0.5),
    mean,
    p05: percentile(sorted, 0.05),
    p95: percentile(sorted, 0.95),
    riskOfRuin: ruined / runs,
    medianMaxDrawdownPct: percentile(sortedDd, 0.5),
  });
}

// Re-export for callers that want to compute drawdown on a single path.
export { maxDrawdown };
