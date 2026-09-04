'use client';
import { useMemo, useState } from 'react';
import { parseOdds, kelly, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Slider, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, money, num, odds as fmtOdds } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function KellyCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [oddsStr, setOddsStr] = useState('2.20');
  const [probPct, setProbPct] = useState('50');
  const [bankroll, setBankroll] = useState('1000');

  const parsed = useMemo(() => parseOdds(oddsStr, fmt), [oddsStr, fmt]);
  const p = Number(probPct) / 100;
  const d = parsed.ok ? parsed.value : null;
  const bank = Number(bankroll) || 0;

  const full = d !== null && p >= 0 && p <= 1 ? kelly(p, d, 1, bank) : null;
  const half = d !== null && p >= 0 && p <= 1 ? kelly(p, d, 0.5, bank) : null;
  const quarter = d !== null && p >= 0 && p <= 1 ? kelly(p, d, 0.25, bank) : null;
  const f = full && full.ok ? full.value : null;
  const h = half && half.ok ? half.value : null;
  const q = quarter && quarter.ok ? quarter.value : null;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-3">
          <div className="mb-1 text-sm font-medium">Format</div>
          <Segmented label="Format" options={FORMATS} value={fmt} onChange={setFmt} />
        </div>
        <NumberField label="Odds" value={oddsStr} onChange={setOddsStr} error={!parsed.ok && oddsStr.trim() !== '' ? parsed.error.message : undefined} inputMode={fmt === 'fractional' ? 'text' : 'decimal'} />
        <NumberField label="Your probability" value={probPct} onChange={setProbPct} suffix="%" />
        <NumberField label="Bankroll" value={bankroll} onChange={setBankroll} suffix="$" />
      </div>
      <div className="mt-3">
        <Slider label="Your probability" min={0} max={100} step={0.5} value={Number.isFinite(Number(probPct)) ? Number(probPct) : 50} onChange={(v) => setProbPct(String(v))} />
      </div>

      {f && (
        <div className="mt-5 space-y-4" aria-live="polite">
          {f.noBet ? (
            <div className="rounded-lg border border-negative/40 p-4">
              <div className="font-semibold text-negative">No edge → Kelly says don&apos;t bet</div>
              <p className="mt-1 text-sm text-muted">
                At this price your probability is at or below break-even ({pct(1 / (d as number))}), so
                the growth-optimal stake is zero.
              </p>
            </div>
          ) : (
            <StatGrid>
              <Stat label="Full Kelly" value={`${pct(f.used)} · ${money(f.stake)}`} tone="neutral" />
              <Stat label="Half Kelly (recommended)" value={`${pct(h?.used)} · ${money(h?.stake)}`} tone="positive" />
              <Stat label="Quarter Kelly" value={`${pct(q?.used)} · ${money(q?.stake)}`} />
            </StatGrid>
          )}
          {f.suspicious && (
            <p className="text-sm text-negative">⚠ Kelly exceeds 100% — double-check your inputs.</p>
          )}
          <ShowMath>
            <p className="tnum">b = d − 1 = {num((d as number) - 1, 3)}, q = 1 − p = {num(1 - p, 4)}</p>
            <p className="tnum">Full Kelly f* = (b·p − q) / b = {pct(f.full)} of bankroll</p>
            <p className="mt-2">
              Full Kelly maximizes long-run growth but its drawdowns are brutal. Most practitioners
              use half or quarter Kelly to cut variance for a small growth cost.
            </p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
