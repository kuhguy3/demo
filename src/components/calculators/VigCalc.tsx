'use client';
import { useMemo, useState } from 'react';
import { parseOdds, margin, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, odds as fmtOdds } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function VigCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [rows, setRows] = useState<string[]>(['1.91', '1.91']);

  const decimals = useMemo(
    () => rows.map((r) => parseOdds(r, fmt)).map((p) => (p.ok ? p.value : NaN)),
    [rows, fmt],
  );
  const valid = decimals.every((d) => Number.isFinite(d)) && decimals.length >= 2;
  const result = valid ? margin(decimals) : null;
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
            label={`Outcome ${i + 1} odds`}
            value={row}
            onChange={(v) => setRow(i, v)}
            inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setRows((p) => [...p, ''])}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          + Add outcome
        </button>
        {rows.length > 2 && (
          <button
            type="button"
            onClick={() => setRows((p) => p.slice(0, -1))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            − Remove
          </button>
        )}
      </div>

      {r && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <StatGrid>
            <Stat label="Overround (booktake)" value={pct(r.overroundPct)} tone={r.overroundPct > 0 ? 'negative' : 'positive'} />
            <Stat label="Hold / margin" value={pct(r.holdPct)} />
            <Stat label="Sum of implied probs" value={pct(r.overround)} />
          </StatGrid>
          <div>
            <div className="mb-2 text-sm font-medium">Fair (de-vigged) probabilities & odds</div>
            <StatGrid>
              {r.fairProbs.map((fp, i) => (
                <Stat key={i} label={`Outcome ${i + 1} fair`} value={`${pct(fp)} · ${fmtOdds(1 / fp)}`} />
              ))}
            </StatGrid>
          </div>
          <ShowMath>
            <p className="tnum">Overround S = Σ (1 / dᵢ) = {pct(r.overround)}</p>
            <p className="tnum">Overround % = S − 1 = {pct(r.overroundPct)}</p>
            <p className="tnum">Hold = (S − 1) / S = {pct(r.holdPct)}</p>
            <p className="mt-2">
              Fair probabilities use proportional de-vig (fairᵢ = (1/dᵢ) / S). This is the simplest
              method but slightly over-taxes favorites — treat it as an estimate, not gospel.
            </p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
