'use client';
import { useMemo, useState } from 'react';
import { parseOdds, arbitrage, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, money, num } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function ArbitrageCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [rows, setRows] = useState<string[]>(['2.10', '2.05']);
  const [total, setTotal] = useState('100');

  const decimals = useMemo(
    () => rows.map((r) => parseOdds(r, fmt)).map((p) => (p.ok ? p.value : NaN)),
    [rows, fmt],
  );
  const allValid = decimals.every((d) => Number.isFinite(d)) && decimals.length >= 2;
  const result = allValid ? arbitrage(decimals, Number(total) || 0) : null;
  const r = result && result.ok ? result.value : null;

  function setRow(i: number, v: string) {
    setRows((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <Card>
      <div className="mb-3">
        <div className="mb-1 text-sm font-medium">Format</div>
        <Segmented label="Format" options={FORMATS} value={fmt} onChange={setFmt} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row, i) => (
          <NumberField
            key={i}
            label={`Outcome ${i + 1} — best price found`}
            value={row}
            onChange={(v) => setRow(i, v)}
            inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((p) => [...p, ''])} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
            + Add outcome
          </button>
          {rows.length > 2 && (
            <button type="button" onClick={() => setRows((p) => p.slice(0, -1))} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
              − Remove
            </button>
          )}
        </div>
        <div className="w-40">
          <NumberField label="Total stake to split" value={total} onChange={setTotal} suffix="$" />
        </div>
      </div>

      {r && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <div className={`rounded-lg border p-4 ${r.exists ? 'border-positive/40' : 'border-border'}`}>
            <div className="text-sm text-muted">Arbitrage</div>
            <div className={`text-xl font-bold ${r.exists ? 'text-positive' : 'text-neutral'}`}>
              {r.exists ? `Exists — guaranteed ${pct(r.roi)} return` : 'None at these prices'}
            </div>
          </div>

          {r.exists && (
            <>
              <div>
                <div className="mb-2 text-sm font-medium">Stake allocation</div>
                <StatGrid>
                  {r.allocation.map((a) => (
                    <Stat key={a.index} label={`Outcome ${a.index + 1} stake`} value={money(a.stake)} />
                  ))}
                  <Stat label="Guaranteed return (any outcome)" value={money(r.guaranteedReturn)} tone="positive" />
                </StatGrid>
              </div>
              <p className="text-sm text-muted">
                Stakes are rounded here for display only — real-money rounding, in-play price
                movement, and stake limits will erode this edge. Both books must actually accept the
                bets at these prices for the arbitrage to hold.
              </p>
            </>
          )}

          <ShowMath>
            <p className="tnum">S = Σ (1 / dᵢ) = {num(r.sum, 4)}</p>
            <p>Arbitrage exists when S &lt; 1. {r.exists ? 'It does here.' : 'It does not here.'}</p>
            {r.exists && <p className="tnum">Guaranteed ROI = 1/S − 1 = {pct(r.roi)}</p>}
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
