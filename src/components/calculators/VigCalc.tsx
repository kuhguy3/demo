'use client';
import { useMemo, useState } from 'react';
import { parseOdds, margin, type OddsFormat, type DeVigMethod } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, odds as fmtOdds, num } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

const METHODS: { value: DeVigMethod; label: string }[] = [
  { value: 'proportional', label: 'Proportional' },
  { value: 'shin', label: 'Shin' },
];

export function VigCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [method, setMethod] = useState<DeVigMethod>('proportional');
  const [rows, setRows] = useState<string[]>(['1.91', '1.91']);

  const decimals = useMemo(
    () => rows.map((r) => parseOdds(r, fmt)).map((p) => (p.ok ? p.value : NaN)),
    [rows, fmt],
  );
  const valid = decimals.every((d) => Number.isFinite(d)) && decimals.length >= 2;
  const result = valid ? margin(decimals, method) : null;
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
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
        <div>
          <div className="mb-1 text-xs font-medium text-muted">De-vig method</div>
          <Segmented label="De-vig method" options={METHODS} value={method} onChange={setMethod} />
        </div>
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
            {method === 'proportional' ? (
              <p className="mt-2">
                Fair probabilities use proportional de-vig (fairᵢ = (1/dᵢ) / S). This is the simplest
                method, but it over-taxes favorites relative to longshots — the &ldquo;favorite-longshot
                bias&rdquo; means bookmakers typically load more of their margin onto longshots than
                proportional scaling assumes.
              </p>
            ) : (
              <p className="mt-2 tnum">
                Fair probabilities use Shin&apos;s method (estimated insider proportion z ={' '}
                {num(r.shinZ, 4)}), which models the overround as coming from informed bettors
                concentrated on the more likely outcome rather than an even tax. It typically assigns
                favorites a higher fair probability — and longshots a lower one — than proportional
                de-vig, correcting for the favorite-longshot bias. It is harder to explain but usually
                more accurate for markets with a clear favorite.
              </p>
            )}
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
