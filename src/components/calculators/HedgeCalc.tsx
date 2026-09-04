'use client';
import { useMemo, useState } from 'react';
import { parseOdds, hedge, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid, ShowMath } from '@/components/ui';
import { money, signedMoney, num } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function HedgeCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [stake, setStake] = useState('100');
  const [origOdds, setOrigOdds] = useState('3.00');
  const [hedgeOdds, setHedgeOdds] = useState('2.00');

  const origParsed = useMemo(() => parseOdds(origOdds, fmt), [origOdds, fmt]);
  const hedgeParsed = useMemo(() => parseOdds(hedgeOdds, fmt), [hedgeOdds, fmt]);
  const s = Number(stake);

  const result = origParsed.ok && hedgeParsed.ok && Number.isFinite(s) ? hedge(s, origParsed.value, hedgeParsed.value) : null;
  const r = result && result.ok ? result.value : null;

  return (
    <Card>
      <div className="mb-1 text-sm font-medium">Format</div>
      <Segmented label="Format" options={FORMATS} value={fmt} onChange={setFmt} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <NumberField label="Your original stake" value={stake} onChange={setStake} suffix="$" />
        <NumberField
          label="Original bet's odds"
          value={origOdds}
          onChange={setOrigOdds}
          error={!origParsed.ok && origOdds.trim() !== '' ? origParsed.error.message : undefined}
          inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
        />
        <NumberField
          label="Hedge (opposite side) odds now"
          value={hedgeOdds}
          onChange={setHedgeOdds}
          error={!hedgeParsed.ok && hedgeOdds.trim() !== '' ? hedgeParsed.error.message : undefined}
          inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
        />
      </div>

      {r && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <div className={`rounded-lg border p-4 ${r.guaranteedProfit ? 'border-positive/40' : 'border-border'}`}>
            <div className="text-sm text-muted">Hedge stake</div>
            <div className="text-2xl font-bold tnum">{money(r.hedgeStake)}</div>
            <p className="mt-1 text-sm text-muted">
              Bet this much on the other side to lock in the <em>same</em> result whichever way it goes.
            </p>
          </div>
          <StatGrid>
            <Stat
              label="Profit if original bet wins"
              value={signedMoney(r.profitIfOriginalWins)}
              tone={r.profitIfOriginalWins > 0 ? 'positive' : r.profitIfOriginalWins < 0 ? 'negative' : 'neutral'}
            />
            <Stat
              label="Profit if hedge bet wins"
              value={signedMoney(r.profitIfHedgeWins)}
              tone={r.profitIfHedgeWins > 0 ? 'positive' : r.profitIfHedgeWins < 0 ? 'negative' : 'neutral'}
            />
            <Stat label="Total staked (both bets)" value={money(r.totalStaked)} />
          </StatGrid>
          {!r.guaranteedProfit && (
            <p className="text-sm text-negative">
              ⚠ At these prices, hedging locks in the same result on both sides — but that result is a
              loss. Hedging guarantees an <em>equal</em> outcome either way, not necessarily a
              profitable one.
            </p>
          )}
          <ShowMath>
            <p className="tnum">Hedge stake S₂ = (S₁ × d₁) / d₂ = ({num(s, 2)} × {num(origParsed.ok ? origParsed.value : 0, 2)}) / {num(hedgeParsed.ok ? hedgeParsed.value : 0, 2)} = {money(r.hedgeStake)}</p>
            <p className="mt-2">
              This sizes the hedge so your profit is identical no matter which side wins — useful when
              a price has moved in your favor since you placed the original bet, or you want to lock in
              a result before an event finishes.
            </p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
