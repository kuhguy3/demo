import { describe, it, expect } from 'vitest';
import {
  americanToDecimal,
  decimalToAmerican,
  fractionalToDecimal,
  parseOdds,
  validateDecimal,
  impliedProbability,
  fairDecimalOdds,
  deVig,
  validateProbability,
  expectedValue,
  edge,
  kelly,
  margin,
  arbitrage,
  parlay,
  MAX_PARLAY_LEGS,
  hedge,
  roi,
  maxDrawdown,
  simulate,
  analyze,
  unwrap,
  approxEqual,
} from './index';

const near = (a: number, b: number, eps = 1e-9) => approxEqual(a, b, eps);

describe('odds conversions', () => {
  it('american +150 → decimal 2.5 → implied 0.4', () => {
    const d = unwrap(americanToDecimal(150));
    expect(near(d, 2.5)).toBe(true);
    expect(near(unwrap(impliedProbability(d)), 0.4)).toBe(true);
  });

  it('american -200 → decimal 1.5 → implied 0.6667', () => {
    const d = unwrap(americanToDecimal(-200));
    expect(near(d, 1.5)).toBe(true);
    expect(near(unwrap(impliedProbability(d)), 2 / 3)).toBe(true);
  });

  it('decimal 2.0 ↔ american +100', () => {
    expect(near(unwrap(decimalToAmerican(2.0)), 100)).toBe(true);
    expect(near(unwrap(americanToDecimal(100)), 2.0)).toBe(true);
    expect(near(unwrap(americanToDecimal(-100)), 2.0)).toBe(true);
  });

  it('fractional 5/1 → 6.0', () => {
    expect(near(unwrap(fractionalToDecimal(5, 1)), 6.0)).toBe(true);
  });

  it('parseOdds handles all formats and a leading +', () => {
    expect(near(unwrap(parseOdds('+150', 'american')), 2.5)).toBe(true);
    expect(near(unwrap(parseOdds('-200', 'american')), 1.5)).toBe(true);
    expect(near(unwrap(parseOdds('2.5', 'decimal')), 2.5)).toBe(true);
    expect(near(unwrap(parseOdds('5/2', 'fractional')), 3.5)).toBe(true);
  });

  it('rejects invalid American in (-100, 100) and 0', () => {
    expect(americanToDecimal(50).ok).toBe(false);
    expect(americanToDecimal(-99).ok).toBe(false);
    expect(americanToDecimal(0).ok).toBe(false);
  });

  it('rejects decimal odds <= 1', () => {
    expect(validateDecimal(1).ok).toBe(false);
    expect(validateDecimal(0.5).ok).toBe(false);
    expect(validateDecimal(Infinity).ok).toBe(false);
    expect(validateDecimal(NaN).ok).toBe(false);
  });

  it('handles very large and very small odds without blowing up', () => {
    expect(unwrap(impliedProbability(1e6))).toBeCloseTo(1e-6, 12);
    expect(unwrap(impliedProbability(1.001))).toBeCloseTo(0.999, 3);
  });
});

describe('probability & de-vig', () => {
  it('validates the [0,1] range with boundaries allowed', () => {
    expect(validateProbability(0).ok).toBe(true);
    expect(validateProbability(1).ok).toBe(true);
    expect(validateProbability(-0.01).ok).toBe(false);
    expect(validateProbability(1.01).ok).toBe(false);
  });

  it('fair odds from p: p=0 → Infinity, p=0.5 → 2.0', () => {
    expect(unwrap(fairDecimalOdds(0))).toBe(Infinity);
    expect(near(unwrap(fairDecimalOdds(0.5)), 2.0)).toBe(true);
  });

  it('proportional de-vig on 1.9/1.9 → fair 0.5/0.5 summing to 1', () => {
    const r = unwrap(deVig([1.9, 1.9]));
    expect(near(r.fairProbs[0]!, 0.5)).toBe(true);
    expect(near(r.fairProbs[0]! + r.fairProbs[1]!, 1)).toBe(true);
    expect(r.overround).toBeCloseTo(1.0526, 3);
  });
});

describe('expected value', () => {
  it('p=0.55 d=2.0 s=100 → EV 10', () => {
    expect(near(unwrap(expectedValue(0.55, 2.0, 100)).ev, 10)).toBe(true);
  });
  it('p=0.5 d=2.0 → EV 0 (neutral)', () => {
    const r = unwrap(expectedValue(0.5, 2.0, 100));
    expect(near(r.ev, 0)).toBe(true);
    expect(r.positive).toBe(false);
  });
  it('p=0.45 d=2.0 s=100 → EV -10', () => {
    expect(near(unwrap(expectedValue(0.45, 2.0, 100)).ev, -10)).toBe(true);
  });
  it('break-even prob is 1/d', () => {
    expect(near(unwrap(expectedValue(0.5, 2.5, 1)).breakEvenProb, 0.4)).toBe(true);
  });
  it('rejects negative stake, accepts zero stake', () => {
    expect(expectedValue(0.5, 2.0, -1).ok).toBe(false);
    const zero = unwrap(expectedValue(0.6, 2.0, 0));
    expect(near(zero.ev, 0)).toBe(true);
    expect(near(zero.evPerUnit, 0.2)).toBe(true);
  });
});

describe('edge (three definitions)', () => {
  it('p=0.52 d=2.0 → points +0.02, relative 0.04, evEdge 0.04', () => {
    const r = unwrap(edge(0.52, 2.0));
    expect(near(r.edgePoints, 0.02)).toBe(true);
    expect(near(r.edgeRelative, 0.04)).toBe(true);
    expect(near(r.evEdge, 0.04)).toBe(true);
  });
  it('uses a supplied reference (fair) probability for points/relative', () => {
    const r = unwrap(edge(0.52, 2.05, 0.5));
    expect(near(r.edgePoints, 0.02)).toBe(true);
    expect(near(r.evEdge, 0.52 * 2.05 - 1)).toBe(true);
  });
});

describe('kelly', () => {
  it('p=0.55 d=2.0 → f=0.10', () => {
    expect(near(unwrap(kelly(0.55, 2.0)).full, 0.1)).toBe(true);
  });
  it('p=0.5 d=2.0 → 0 (no bet)', () => {
    const r = unwrap(kelly(0.5, 2.0));
    expect(near(r.full, 0)).toBe(true);
    expect(r.noBet).toBe(true);
    expect(r.used).toBe(0);
  });
  it('negative Kelly → no bet, used floored at 0', () => {
    const r = unwrap(kelly(0.6, 1.5));
    expect(r.full).toBeCloseTo(-0.2, 10);
    expect(r.noBet).toBe(true);
    expect(r.used).toBe(0);
  });
  it('fractional Kelly scales the used fraction', () => {
    expect(near(unwrap(kelly(0.55, 2.0, 0.5)).used, 0.05)).toBe(true);
    expect(near(unwrap(kelly(0.55, 2.0, 0.25)).used, 0.025)).toBe(true);
  });
  it('computes a dollar stake from bankroll', () => {
    expect(near(unwrap(kelly(0.55, 2.0, 1, 1000)).stake!, 100)).toBe(true);
  });
  it('full Kelly caps at 1 for p=1 (never exceeds 1 for valid p)', () => {
    // For any valid p<=1, full = (p*d-1)/(d-1) <= 1, reaching 1 only at p=1.
    expect(unwrap(kelly(1, 2.0)).full).toBe(1);
    expect(unwrap(kelly(1, 3.0)).full).toBe(1);
    const r = unwrap(kelly(1, 3.0));
    expect(r.suspicious).toBe(false);
    expect(r.used).toBe(1);
  });
});

describe('vig / margin', () => {
  it('1.9/1.9 → overround ~5.26%, hold ~5.0%', () => {
    const r = unwrap(margin([1.9, 1.9]));
    expect(r.overroundPct).toBeCloseTo(0.0526, 3);
    expect(r.holdPct).toBeCloseTo(0.05, 3);
    expect(near(r.fairProbs[0]!, 0.5)).toBe(true);
  });
  it('fair market (2.0/2.0) has zero overround', () => {
    const r = unwrap(margin([2.0, 2.0]));
    expect(near(r.overroundPct, 0)).toBe(true);
  });
});

describe('arbitrage', () => {
  it('2.10/2.10 → arb exists, roi ~5%', () => {
    const r = unwrap(arbitrage([2.1, 2.1], 100));
    expect(r.exists).toBe(true);
    expect(r.roi).toBeCloseTo(0.05, 3);
    // equal payout on both outcomes
    expect(near(r.allocation[0]!.payout, r.allocation[1]!.payout)).toBe(true);
  });
  it('2.0/2.0 → sum exactly 1, no arb', () => {
    const r = unwrap(arbitrage([2.0, 2.0]));
    expect(near(r.sum, 1)).toBe(true);
    expect(r.exists).toBe(false);
  });
  it('normal vig market has no arb', () => {
    expect(unwrap(arbitrage([1.9, 1.9])).exists).toBe(false);
  });
});

describe('parlay', () => {
  it('[2,2,2] → combined 8.0, implied 0.125', () => {
    const r = unwrap(parlay([{ decimal: 2 }, { decimal: 2 }, { decimal: 2 }]));
    expect(near(r.combinedDecimal, 8)).toBe(true);
    expect(near(r.combinedImplied, 0.125)).toBe(true);
    expect(r.trueCombinedProb).toBeUndefined();
  });
  it('with true probs [.5,.5,.5] → trueProb .125, EV 0', () => {
    const r = unwrap(parlay([
      { decimal: 2, p: 0.5 },
      { decimal: 2, p: 0.5 },
      { decimal: 2, p: 0.5 },
    ]));
    expect(near(r.trueCombinedProb!, 0.125)).toBe(true);
    expect(near(r.evPerUnit!, 0)).toBe(true);
  });
  it('rejects a single leg and too many legs', () => {
    expect(parlay([{ decimal: 2 }]).ok).toBe(false);
    const many = Array.from({ length: MAX_PARLAY_LEGS + 1 }, () => ({ decimal: 2 }));
    const r = parlay(many);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('TOO_MANY_LEGS');
  });
});

describe('hedge', () => {
  it('$100 @ 3.00 hedged at 2.00 equalizes profit on both sides', () => {
    const r = unwrap(hedge(100, 3.0, 2.0));
    // S2 = 100*3/2 = 150
    expect(near(r.hedgeStake, 150)).toBe(true);
    expect(near(r.profitIfOriginalWins, r.profitIfHedgeWins)).toBe(true);
    // total staked = 250; if original wins: 300 - 250 = 50
    expect(near(r.profitIfOriginalWins, 50)).toBe(true);
    expect(r.guaranteedProfit).toBe(true);
  });
  it('hedging at a worse combined price can lock in a guaranteed loss (still equalized)', () => {
    const r = unwrap(hedge(100, 1.5, 1.5));
    // S2 = 100*1.5/1.5 = 100; total = 200; if original wins: 150-200=-50
    expect(near(r.hedgeStake, 100)).toBe(true);
    expect(near(r.profitIfOriginalWins, -50)).toBe(true);
    expect(near(r.profitIfHedgeWins, -50)).toBe(true);
    expect(r.guaranteedProfit).toBe(false);
  });
  it('rejects invalid original stake/odds and hedge odds', () => {
    expect(hedge(-10, 2, 2).ok).toBe(false);
    expect(hedge(0, 2, 2).ok).toBe(false);
    expect(hedge(100, 1, 2).ok).toBe(false);
    expect(hedge(100, 2, 1).ok).toBe(false);
  });
});

describe('roi & drawdown', () => {
  it('yield vs bankroll ROI use different denominators', () => {
    const r = unwrap(roi(50, 1000, 500));
    expect(near(r.yield, 0.05)).toBe(true);
    expect(near(r.roiBankroll, 0.1)).toBe(true);
  });
  it('max drawdown on a known series', () => {
    const r = unwrap(maxDrawdown([100, 120, 60, 90, 130]));
    // peak 120 → trough 60 → 50% drawdown, abs 60
    expect(near(r.maxDrawdownPct, 0.5)).toBe(true);
    expect(near(r.maxDrawdownAbs, 60)).toBe(true);
  });
});

describe('simulate', () => {
  it('is reproducible for a fixed seed', () => {
    const cfg = { p: 0.55, decimal: 2, bankroll: 1000, bets: 100, runs: 200, staking: 'flatPct' as const, fraction: 0.02, seed: 42 };
    const a = unwrap(simulate(cfg));
    const b = unwrap(simulate(cfg));
    expect(a.median).toBe(b.median);
    expect(a.riskOfRuin).toBe(b.riskOfRuin);
  });
  it('positive edge grows median above starting bankroll on average', () => {
    const r = unwrap(simulate({ p: 0.6, decimal: 2, bankroll: 1000, bets: 500, runs: 500, staking: 'flatPct', fraction: 0.02, seed: 7 }));
    expect(r.median).toBeGreaterThan(1000);
    expect(r.riskOfRuin).toBeGreaterThanOrEqual(0);
    expect(r.riskOfRuin).toBeLessThanOrEqual(1);
  });
  it('rejects out-of-range bet/run counts', () => {
    expect(simulate({ p: 0.5, decimal: 2, bankroll: 100, bets: 0, runs: 10, staking: 'flat', seed: 1 }).ok).toBe(false);
    expect(simulate({ p: 0.5, decimal: 2, bankroll: 100, bets: 10, runs: 0, staking: 'flat', seed: 1 }).ok).toBe(false);
  });
});

describe('analyze (composite)', () => {
  it('odds only → market layer, verdict incomplete', () => {
    const r = unwrap(analyze({ decimal: 2.0 }));
    expect(near(r.impliedProb, 0.5)).toBe(true);
    expect(r.verdict).toBe('incomplete');
    expect(r.userProb).toBeUndefined();
  });
  it('positive EV bet → verdict positive with full readout', () => {
    const r = unwrap(analyze({ decimal: 2.0, p: 0.55, stake: 100, bankroll: 1000 }));
    expect(r.verdict).toBe('positive');
    expect(near(r.ev!, 10)).toBe(true);
    expect(near(r.kellyFull!, 0.1)).toBe(true);
    expect(near(r.kellyStake!, 100)).toBe(true);
  });
  it('negative EV bet → verdict negative', () => {
    expect(unwrap(analyze({ decimal: 2.0, p: 0.45 })).verdict).toBe('negative');
  });
  it('break-even → verdict neutral', () => {
    expect(unwrap(analyze({ decimal: 2.0, p: 0.5 })).verdict).toBe('neutral');
  });
  it('de-vigs from opposing odds when provided', () => {
    const r = unwrap(analyze({ decimal: 1.9, p: 0.55, opposingDecimal: 1.9 }));
    expect(near(r.fairProbFromMarket!, 0.5)).toBe(true);
  });
  it('rejects invalid odds and probability', () => {
    expect(analyze({ decimal: 1 }).ok).toBe(false);
    expect(analyze({ decimal: 2, p: 1.5 }).ok).toBe(false);
  });
});

describe('no NaN/Infinity leaks on boundaries', () => {
  it('p=0 and p=1 produce finite EV', () => {
    expect(unwrap(expectedValue(0, 2.0, 100)).ev).toBe(-100);
    expect(unwrap(expectedValue(1, 2.0, 100)).ev).toBe(100);
  });
});
