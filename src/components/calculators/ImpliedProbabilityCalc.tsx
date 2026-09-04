'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseOdds, impliedProbability, fairDecimalOdds, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid, ShowMath } from '@/components/ui';
import { pct, odds as fmtOdds } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function ImpliedProbabilityCalc() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [value, setValue] = useState('1.91');
  const parsed = useMemo(() => parseOdds(value, fmt), [value, fmt]);
  const d = parsed.ok ? parsed.value : null;
  const implied = d ? impliedProbability(d) : null;
  const p = implied && implied.ok ? implied.value : null;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="mb-1 text-sm font-medium">Format</div>
          <Segmented label="Format" options={FORMATS} value={fmt} onChange={setFmt} />
        </div>
        <NumberField
          label="Odds"
          value={value}
          onChange={setValue}
          error={!parsed.ok && value.trim() !== '' ? parsed.error.message : undefined}
          inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
        />
      </div>

      {p !== null && d !== null && (
        <div className="mt-5 space-y-4" aria-live="polite">
          <StatGrid>
            <Stat label="Implied probability (with vig)" value={pct(p)} />
            <Stat label="Fair odds if that were true" value={fmtOdds(fairDecimalOdds(p).ok ? (fairDecimalOdds(p) as { value: number }).value : NaN)} />
          </StatGrid>
          <ShowMath>
            <p className="tnum">Implied probability = 1 / decimal odds = 1 / {fmtOdds(d)} = {pct(p)}</p>
            <p className="mt-2">
              This is the probability the price implies, <em>including</em> the bookmaker margin — so
              the summed implied probabilities across a market are more than 100%. Strip the margin
              with the{' '}
              <Link href="/tools/vig-calculator" className="text-brand hover:underline">
                vig calculator
              </Link>{' '}
              to estimate fair probability.
            </p>
          </ShowMath>
        </div>
      )}
    </Card>
  );
}
