'use client';
import { useMemo, useState } from 'react';
import { parseOdds, expectedValue, edge, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Slider, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, signedPct, signedMoney, num, odds as fmtOdds } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function ExpectedValueCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [oddsStr, setOddsStr] = useState('2.10');
  const [probPct, setProbPct] = useState('52');
  const [stake, setStake] = useState('100');

  const parsed = useMemo(() => parseOdds(oddsStr, fmt), [oddsStr, fmt]);
  const p = Number(probPct) / 100;
  const d = parsed.ok ? parsed.value : null;
  const ev = d !== null && p >= 0 && p <= 1 ? expectedValue(p, d, Number(stake) || 0) : null;
  const e = d !== null && p >= 0 && p <= 1 ? edge(p, d) : null;
  const r = ev && ev.ok ? ev.value : null;
  const eg = e && e.ok ? e.value : null;
  const probError = probPct.trim() !== '' && (p < 0 || p > 1) ? 'Probability must be 0–100%.' : undefined;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-3">
          <div className="mb-1 text-sm font-medium">Format</div>
          <Segmented label="Format" options={FORMATS} value={fmt} onChange={setFmt} />
        </div>
        <NumberField label="Odds" value={oddsStr} onChange={setOddsStr} error={!parsed.ok && oddsStr.trim() !== '' ? parsed.error.message : undefined} inputMode={fmt === 'fractional' ? 'text' : 'decimal'} />
        <NumberField label="Your probability" value={probPct} onChange={setProbPct} suffix="%" error={probError} />
        <NumberField label="Stake" value={stake} onChange={setStake} suffix="$" />
      </div>
      <div className="mt-3">
        <Slider label="Your probability" min={0} max={100} step={0.5} value={Number.isFinite(Number(probPct)) ? Number(probPct) : 50} onChange={(v) => setProbPct(String(v))} />
      </div>

      {r && eg && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <div className={`rounded-lg border p-4 ${r.evPerUnit > 0 ? 'border-positive/40' : r.evPerUnit < 0 ? 'border-negative/40' : 'border-border'}`}>
            <div className="text-sm text-muted">Expected value</div>
            <div className={`text-2xl font-bold tnum ${r.evPerUnit > 0 ? 'text-positive' : r.evPerUnit < 0 ? 'text-negative' : 'text-neutral'}`}>
              {signedMoney(r.ev)} <span className="text-base font-normal text-muted">({signedPct(r.evPerUnit)} per $1)</span>
            </div>
          </div>
          <StatGrid>
            <Stat label="Break-even probability" value={pct(r.breakEvenProb)} />
            <Stat label="Edge (points)" value={signedPct(eg.edgePoints)} tone={eg.edgePoints > 0 ? 'positive' : eg.edgePoints < 0 ? 'negative' : 'neutral'} />
            <Stat label="Edge (relative / EV per $1)" value={signedPct(eg.evEdge)} />
          </StatGrid>
          <ShowMath>
            <p className="tnum">EV = stake × (p·d − 1) = {num(Number(stake) || 0, 2)} × ({num(p, 4)} × {fmtOdds(d!)} − 1) = {signedMoney(r.ev)}</p>
            <p className="tnum">Break-even p = 1 / d = {pct(r.breakEvenProb)} (bet is +EV whenever your p exceeds this)</p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
