'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { parseOdds, analyze, type OddsFormat } from '@/engine';
import { useQueryState } from '@/hooks/useQueryState';
import { NumberField, Segmented, Slider, Stat, StatGrid, ShowMath, Card, Disclaimer } from '@/components/ui';
import { pct, signedPct, num, money, signedMoney, odds as fmtOdds } from '@/lib/format';
import { saveBetFromAnalysis } from '@/persistence/tracker';

const FORMATS: { value: OddsFormat; label: string }[] = [
  { value: 'decimal', label: 'Decimal' },
  { value: 'american', label: 'American' },
  { value: 'fractional', label: 'Fractional' },
];

export function Analyzer() {
  const { state, update } = useQueryState({
    fmt: 'decimal',
    odds: '2.10',
    p: '52',
    opp: '',
    stake: '100',
    bankroll: '1000',
    kf: '0.5',
  });
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const fmt = state.fmt as OddsFormat;
  const probPct = Number(state.p);
  const p = Number.isFinite(probPct) ? probPct / 100 : NaN;

  const parsed = useMemo(() => parseOdds(state.odds, fmt), [state.odds, fmt]);
  const parsedOpp = useMemo(
    () => (state.opp.trim() ? parseOdds(state.opp, fmt) : null),
    [state.opp, fmt],
  );

  const result = useMemo(() => {
    if (!parsed.ok) return null;
    const hasProb = state.p.trim() !== '' && p >= 0 && p <= 1;
    return analyze({
      decimal: parsed.value,
      p: hasProb ? p : undefined,
      opposingDecimal: parsedOpp && parsedOpp.ok ? parsedOpp.value : undefined,
      stake: Number(state.stake) || 0,
      bankroll: Number(state.bankroll) || undefined,
      kellyFraction: Number(state.kf) || 1,
    });
  }, [parsed, parsedOpp, p, state.p, state.stake, state.bankroll, state.kf]);

  const r = result && result.ok ? result.value : null;
  const oddsError = !parsed.ok && state.odds.trim() !== '' ? parsed.error.message : undefined;
  const probError =
    state.p.trim() !== '' && (!Number.isFinite(p) || p < 0 || p > 1)
      ? 'Probability must be between 0% and 100%.'
      : undefined;

  function copyLink() {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function save() {
    if (!r || !parsed.ok) return;
    saveBetFromAnalysis({
      oddsDecimal: parsed.value,
      format: fmt,
      rawOdds: state.odds,
      estimatedProb: r.userProb,
      stake: Number(state.stake) || 0,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const verdictTone =
    r?.verdict === 'positive' ? 'positive' : r?.verdict === 'negative' ? 'negative' : 'neutral';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Inputs */}
      <Card>
        <h2 className="text-lg font-semibold">Your bet</h2>
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1 block text-sm font-medium">Odds format</div>
            <Segmented label="Odds format" options={FORMATS} value={fmt} onChange={(v) => update({ fmt: v })} />
          </div>

          <NumberField
            label="Odds offered"
            value={state.odds}
            onChange={(v) => update({ odds: v })}
            error={oddsError}
            placeholder={fmt === 'fractional' ? '11/10' : fmt === 'american' ? '+110' : '2.10'}
            inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
          />

          <div>
            <NumberField
              label="Your probability estimate"
              value={state.p}
              onChange={(v) => update({ p: v })}
              error={probError}
              suffix="%"
              hint="How likely you think this outcome really is. This is your input — BetLab never guesses it."
            />
            <div className="mt-2">
              <Slider
                label="Your probability estimate"
                min={0}
                max={100}
                step={0.5}
                value={Number.isFinite(probPct) ? probPct : 50}
                onChange={(v) => update({ p: String(v) })}
              />
            </div>
          </div>

          <NumberField
            label="Opposite side odds (optional)"
            value={state.opp}
            onChange={(v) => update({ opp: v })}
            hint="No estimate? Enter the other side's price to compute a fair (de-vigged) probability."
            placeholder="—"
            inputMode={fmt === 'fractional' ? 'text' : 'decimal'}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Stake" value={state.stake} onChange={(v) => update({ stake: v })} suffix="$" />
            <NumberField label="Bankroll" value={state.bankroll} onChange={(v) => update({ bankroll: v })} suffix="$" />
          </div>

          <div>
            <div className="mb-1 block text-sm font-medium">Kelly fraction</div>
            <Segmented
              label="Kelly fraction"
              options={[
                { value: '1', label: 'Full' },
                { value: '0.5', label: 'Half' },
                { value: '0.25', label: 'Quarter' },
              ]}
              value={state.kf}
              onChange={(v) => update({ kf: v })}
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <div aria-live="polite">
          {!parsed.ok ? (
            <Card>
              <p className="text-muted">Enter valid odds to see the analysis.</p>
            </Card>
          ) : (
            <Card
              className={
                verdictTone === 'positive'
                  ? 'border-positive/40'
                  : verdictTone === 'negative'
                    ? 'border-negative/40'
                    : ''
              }
            >
              {r?.verdict === 'incomplete' ? (
                <>
                  <div className="text-sm text-muted">Market read</div>
                  <div className="mt-1 text-2xl font-bold">
                    Implied probability {pct(r.impliedProb)}
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Add your probability estimate to see edge, expected value and a Kelly stake.
                  </p>
                </>
              ) : r ? (
                <>
                  <div className="text-sm text-muted">Verdict</div>
                  <div
                    data-testid="verdict"
                    className={`mt-1 text-2xl font-bold ${
                      verdictTone === 'positive'
                        ? 'text-positive'
                        : verdictTone === 'negative'
                          ? 'text-negative'
                          : 'text-neutral'
                    }`}
                  >
                    {r.verdict === 'positive' && (
                      <>+EV ✓ — expected {signedMoney(r.ev)} on {money(Number(state.stake) || 0)}</>
                    )}
                    {r.verdict === 'negative' && <>−EV ✗ — the math says pass</>}
                    {r.verdict === 'neutral' && <>Break-even — no mathematical edge</>}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {signedPct(r.evPerUnit)} expected return per $1 staked
                  </div>
                </>
              ) : null}
            </Card>
          )}
        </div>

        {r && r.userProb !== undefined && (
          <Card>
            <StatGrid>
              <Stat label="Implied prob (with vig)" value={pct(r.impliedProb)} />
              <Stat label="Your probability" value={pct(r.userProb)} />
              {r.fairProbFromMarket !== undefined && (
                <Stat label="Fair prob (de-vigged)" value={pct(r.fairProbFromMarket)} />
              )}
              <Stat label="Break-even prob" value={pct(r.breakEvenProb)} />
              <Stat label="Fair odds (from your %)" value={fmtOdds(r.fairDecimalFromUser)} />
              <Stat
                label="Edge (points)"
                value={signedPct(r.edgePoints)}
                tone={(r.edgePoints ?? 0) > 0 ? 'positive' : (r.edgePoints ?? 0) < 0 ? 'negative' : 'neutral'}
              />
              <Stat label="Edge (relative)" value={signedPct(r.edgeRelative)} />
              <Stat
                label="Expected value"
                value={signedMoney(r.ev)}
                tone={(r.ev ?? 0) > 0 ? 'positive' : (r.ev ?? 0) < 0 ? 'negative' : 'neutral'}
              />
              <Stat label="Return / $1 (EV edge)" value={signedPct(r.evPerUnit)} />
            </StatGrid>

            <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
              <div className="text-sm font-semibold">Suggested stake sizing</div>
              {r.kellyUsed === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  No edge at this price — Kelly recommends no bet.
                </p>
              ) : (
                <p className="mt-1 text-sm">
                  {['1', '0.5', '0.25'].includes(state.kf)
                    ? `${state.kf === '1' ? 'Full' : state.kf === '0.5' ? 'Half' : 'Quarter'} Kelly: `
                    : 'Kelly: '}
                  <span className="font-semibold tnum">{pct(r.kellyUsed)}</span> of bankroll
                  {r.kellyStake !== undefined && (
                    <>
                      {' '}
                      ≈ <span className="font-semibold tnum">{money(r.kellyStake)}</span>
                    </>
                  )}
                  . Full Kelly here is {pct(r.kellyFull)}. Fractional Kelly is recommended to cut
                  drawdowns.
                </p>
              )}
            </div>

            {r.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-negative">
                {r.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong"
              >
                {saved ? 'Saved ✓' : 'Save to tracker'}
              </button>
              <Link
                href={`/simulator?p=${state.p}&odds=${encodeURIComponent(fmtOdds(r.decimal))}&bankroll=${state.bankroll}`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2"
              >
                Simulate this edge →
              </Link>
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2"
              >
                {copied ? 'Link copied ✓' : 'Copy shareable link'}
              </button>
            </div>
          </Card>
        )}

        {r && r.userProb !== undefined && (
          <ShowMath>
            <p className="tnum">Decimal odds d = {fmtOdds(r.decimal)}</p>
            <p className="tnum">Implied probability = 1 / d = 1 / {fmtOdds(r.decimal)} = {pct(r.impliedProb)}</p>
            <p className="tnum">Your probability p = {pct(r.userProb)}</p>
            <p className="tnum">
              Expected value = stake × (p·d − 1) = {money(Number(state.stake) || 0)} × ({num(r.userProb, 4)}×
              {fmtOdds(r.decimal)} − 1) = {signedMoney(r.ev)}
            </p>
            <p className="tnum">
              Kelly f* = (p·d − 1) / (d − 1) = {pct(r.kellyFull)} of bankroll
            </p>
            {r.fairProbFromMarket !== undefined && (
              <p className="tnum">
                Fair prob (proportional de-vig from both sides) = {pct(r.fairProbFromMarket)}
              </p>
            )}
          </ShowMath>
        )}

        <Disclaimer />
      </div>
    </div>
  );
}
