'use client';
import { useMemo, useState } from 'react';
import { parlay, validateDecimal, MAX_PARLAY_LEGS } from '@/engine';
import { Card, NumberField, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, odds as fmtOdds, num } from '@/lib/format';

export function ParlayCalc() {
  const [legs, setLegs] = useState<string[]>(['1.91', '1.91', '1.91']);

  const decimals = useMemo(() => legs.map((l) => Number(l)), [legs]);
  const allValid = decimals.every((d) => validateDecimal(d).ok);
  const result = allValid && decimals.length >= 2 ? parlay(decimals.map((d) => ({ decimal: d }))) : null;
  const r = result && result.ok ? result.value : null;

  function setLeg(i: number, v: string) {
    setLegs((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {legs.map((leg, i) => (
          <NumberField key={i} label={`Leg ${i + 1} (decimal)`} value={leg} onChange={(v) => setLeg(i, v)} />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {legs.length < MAX_PARLAY_LEGS && (
          <button type="button" onClick={() => setLegs((p) => [...p, ''])} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
            + Add leg
          </button>
        )}
        {legs.length > 2 && (
          <button type="button" onClick={() => setLegs((p) => p.slice(0, -1))} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
            − Remove leg
          </button>
        )}
      </div>

      {r && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <StatGrid>
            <Stat label="Combined decimal odds" value={fmtOdds(r.combinedDecimal)} />
            <Stat label="Combined implied prob" value={pct(r.combinedImplied)} />
            <Stat label="Payout on $100" value={`$${num(100 * r.combinedDecimal, 2)}`} />
          </StatGrid>
          <p className="text-sm text-muted">
            The combined price is the product of each leg. The bookmaker margin compounds with every
            leg, which is why parlays are usually worse value than the same bets placed singly — and
            this assumes the legs are independent, which fails for correlated markets.
          </p>
          <ShowMath>
            <p className="tnum">Combined odds = {legs.filter(Boolean).join(' × ')} = {fmtOdds(r.combinedDecimal)}</p>
            <p className="tnum">Combined implied probability = 1 / {fmtOdds(r.combinedDecimal)} = {pct(r.combinedImplied)}</p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
