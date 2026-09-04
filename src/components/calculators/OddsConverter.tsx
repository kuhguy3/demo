'use client';
import { useMemo, useState } from 'react';
import { parseOdds, decimalToAmerican, decimalToFractional, impliedProbability, type OddsFormat } from '@/engine';
import { Card, NumberField, Segmented, Stat, StatGrid } from '@/components/ui';
import { pct, odds as fmtOdds, num } from '@/lib/format';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function OddsConverter() {
  const [fmt, setFmt] = useState<OddsFormat>('decimal');
  const [value, setValue] = useState('2.50');

  const parsed = useMemo(() => parseOdds(value, fmt), [value, fmt]);
  const d = parsed.ok ? parsed.value : null;
  const american = d ? decimalToAmerican(d) : null;
  const fractional = d ? decimalToFractional(d) : null;
  const implied = d ? impliedProbability(d) : null;

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="mb-1 text-sm font-medium">Input format</div>
          <Segmented label="Input format" options={FORMATS} value={fmt} onChange={setFmt} />
        </div>
        <NumberField
          label="Odds"
          value={value}
          onChange={setValue}
          error={!parsed.ok && value.trim() !== '' ? parsed.error.message : undefined}
          inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
          placeholder={fmt === 'fractional' ? '3/2' : fmt === 'american' ? '+150' : '2.50'}
        />
      </div>

      {d && (
        <div className="mt-5" aria-live="polite">
          <StatGrid>
            <Stat label="Decimal" value={fmtOdds(d)} />
            <Stat label="American" value={american?.ok ? (american.value >= 0 ? `+${num(american.value, 0)}` : num(american.value, 0)) : '—'} />
            <Stat label="Fractional" value={fractional?.ok ? fractional.value : '—'} />
            <Stat label="Implied probability" value={implied?.ok ? pct(implied.value) : '—'} />
          </StatGrid>
        </div>
      )}
    </Card>
  );
}
