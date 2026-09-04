'use client';
import { useMemo, useState } from 'react';
import { type StakingRule, type SimResult } from '@/engine';
import { useQueryState } from '@/hooks/useQueryState';
import { useSimWorker } from '@/hooks/useSimWorker';
import { Card, NumberField, Segmented, Slider, Stat, StatGrid, Disclaimer } from '@/components/ui';
import { money, pct, num } from '@/lib/format';

const STAKING: { value: StakingRule; label: string }[] = [
  { value: 'flatPct', label: '% of bankroll' },
  { value: 'flat', label: 'Flat unit' },
  { value: 'kelly', label: 'Fractional Kelly' },
];

function FanChart({ result }: { result: SimResult }) {
  const paths = result.paths;
  if (paths.length === 0) return null;
  const allVals = paths.flat();
  const min = Math.min(...allVals);
  const max = Math.max(...allVals, min + 1);
  const len = Math.max(...paths.map((p) => p.length));
  const W = 100;
  const H = 60;
  const toXY = (i: number, v: number, n: number) => {
    const x = (i / Math.max(1, n - 1)) * W;
    const y = H - ((v - min) / (max - min)) * (H - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-56 w-full" role="img" aria-label="Simulated bankroll paths over time">
        {paths.map((p, idx) => (
          <polyline
            key={idx}
            points={p.map((v, i) => toXY(i, v, p.length)).join(' ')}
            fill="none"
            stroke="var(--brand)"
            strokeOpacity={0.18}
            strokeWidth={0.4}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* starting bankroll reference line */}
        <line x1="0" x2={W} y1={H - ((paths[0]![0]! - min) / (max - min)) * (H - 4) - 2} y2={H - ((paths[0]![0]! - min) / (max - min)) * (H - 4) - 2} stroke="var(--muted)" strokeDasharray="1,1" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function Simulator() {
  const { state, update } = useQueryState({
    p: '54',
    odds: '2.00',
    bankroll: '1000',
    bets: '200',
    runs: '2000',
    staking: 'flatPct',
    fraction: '2',
    seed: '12345',
  });

  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { run: runInWorker } = useSimWorker();

  const cfg = useMemo(() => {
    const staking = state.staking as StakingRule;
    const fractionInput = Number(state.fraction) || 0;
    return {
      p: Number(state.p) / 100,
      decimal: Number(state.odds),
      bankroll: Number(state.bankroll),
      bets: Math.round(Number(state.bets)),
      runs: Math.round(Number(state.runs)),
      staking,
      // fraction UI is a percent for flatPct, a multiplier for kelly
      fraction: staking === 'kelly' ? fractionInput : fractionInput / 100,
      unit: Number(state.bankroll) * 0.01,
      seed: Math.round(Number(state.seed)) || 1,
    };
  }, [state]);

  async function run() {
    setRunning(true);
    setError(null);
    const r = await runInWorker(cfg);
    setRunning(false);
    if (r.ok) {
      setResult(r.value);
      setError(null);
    } else {
      setResult(null);
      setError(r.error.message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card>
        <h2 className="text-lg font-semibold">Setup</h2>
        <div className="mt-4 space-y-4">
          <div>
            <NumberField label="Your win probability per bet" value={state.p} onChange={(v) => update({ p: v })} suffix="%" />
            <div className="mt-2">
              <Slider label="Win probability" min={1} max={99} step={0.5} value={Number(state.p) || 50} onChange={(v) => update({ p: String(v) })} />
            </div>
          </div>
          <NumberField label="Decimal odds per bet" value={state.odds} onChange={(v) => update({ odds: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Starting bankroll" value={state.bankroll} onChange={(v) => update({ bankroll: v })} suffix="$" />
            <NumberField label="Bets per run" value={state.bets} onChange={(v) => update({ bets: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Simulation runs" value={state.runs} onChange={(v) => update({ runs: v })} />
            <NumberField label="Seed" value={state.seed} onChange={(v) => update({ seed: v })} inputMode="numeric" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Staking rule</div>
            <Segmented label="Staking rule" options={STAKING} value={state.staking} onChange={(v) => update({ staking: v })} />
          </div>
          <NumberField
            label={state.staking === 'kelly' ? 'Kelly fraction (1 = full)' : state.staking === 'flatPct' ? 'Stake (% of bankroll)' : 'Flat unit (% of start)'}
            value={state.fraction}
            onChange={(v) => update({ fraction: v })}
            suffix={state.staking === 'kelly' ? '×' : '%'}
          />
          <button
            type="button"
            onClick={run}
            disabled={running}
            aria-busy={running}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {running ? 'Running…' : 'Run simulation'}
          </button>
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
        </div>
      </Card>

      <div className="space-y-4">
        {result ? (
          <>
            <Card>
              <h2 className="text-lg font-semibold">Outcome over {num(cfg.bets, 0)} bets · {num(cfg.runs, 0)} runs</h2>
              <div className="mt-4">
                <StatGrid>
                  <Stat label="Median ending bankroll" value={money(result.median)} tone={result.median >= cfg.bankroll ? 'positive' : 'negative'} />
                  <Stat label="Mean ending bankroll" value={money(result.mean)} />
                  <Stat label="5th percentile" value={money(result.p05)} tone="negative" />
                  <Stat label="95th percentile" value={money(result.p95)} tone="positive" />
                  <Stat label="Risk of ruin" value={pct(result.riskOfRuin)} tone={result.riskOfRuin > 0.05 ? 'negative' : 'neutral'} />
                  <Stat label="Median max drawdown" value={pct(result.medianMaxDrawdownPct)} />
                </StatGrid>
              </div>
              <div className="mt-5">
                <FanChart result={result} />
              </div>
            </Card>
            <p className="text-sm text-muted">
              This assumes your probability and edge are exactly correct and constant for every bet —
              which is never true in reality. The lesson is the <em>shape</em> of variance and
              drawdown, not the specific dollar figures.
            </p>
          </>
        ) : (
          <Card>
            <p className="text-muted" aria-live="polite">
              {running
                ? 'Running simulation in the background…'
                : 'Set your parameters and run the simulation to see the distribution of outcomes.'}
            </p>
          </Card>
        )}
        <Disclaimer />
      </div>
    </div>
  );
}
