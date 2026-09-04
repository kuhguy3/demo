'use client';
import { useState } from 'react';
import { expectedValue } from '@/engine';
import { signedMoney, pct } from '@/lib/format';
import { Slider } from '@/components/ui';

/** Small interactive teaching widget for the homepage hero. */
export function EvDemo() {
  const [probPct, setProbPct] = useState(53);
  const [decimal, setDecimal] = useState(2.0);
  const p = probPct / 100;
  const r = expectedValue(p, decimal, 100);
  const ev = r.ok ? r.value.ev : 0;
  const positive = ev > 0.001;
  const negative = ev < -0.001;

  // Simple deterministic bankroll projection at flat $100 stakes (expectation only).
  const evPerBet = r.ok ? r.value.ev : 0;
  const points = Array.from({ length: 21 }, (_, i) => 1000 + evPerBet * i * 5);
  const min = Math.min(...points);
  const max = Math.max(...points, min + 1);
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 40 - ((v - min) / (max - min)) * 36 - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Try it: is a $100 bet worth it?</h2>
        <span
          className={`text-sm font-semibold ${positive ? 'text-positive' : negative ? 'text-negative' : 'text-neutral'}`}
        >
          {positive ? '+EV' : negative ? '−EV' : 'Break-even'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Your win probability</span>
          <div className="mt-1 text-lg font-semibold tnum">{pct(p, 0)}</div>
          <Slider label="Win probability" min={1} max={99} step={1} value={probPct} onChange={setProbPct} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Decimal odds</span>
          <div className="mt-1 text-lg font-semibold tnum">{decimal.toFixed(2)}</div>
          <Slider label="Decimal odds" min={1.1} max={5} step={0.05} value={decimal} onChange={setDecimal} />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div>
          <div className="text-xs text-muted">Expected value / bet</div>
          <div className={`text-2xl font-bold tnum ${positive ? 'text-positive' : negative ? 'text-negative' : 'text-neutral'}`}>
            {signedMoney(ev)}
          </div>
        </div>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 flex-1" aria-hidden>
          <path d={path} fill="none" stroke={positive ? 'var(--positive)' : negative ? 'var(--negative)' : 'var(--neutral)'} strokeWidth="1.5" />
        </svg>
      </div>
      <p className="mt-2 text-xs text-muted">
        EV = stake × (probability × odds − 1). Line shows expected bankroll from $1,000 over 100 bets.
      </p>
    </div>
  );
}
