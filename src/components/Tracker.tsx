'use client';
import { useEffect, useRef, useState } from 'react';
import type { Bet, BetStatus, TrackerState } from '@/models/types';
import * as store from '@/persistence/tracker';
import { summarize, toCsv, parseCsv } from '@/persistence/analytics';
import { parseOdds } from '@/engine';
import { Card, NumberField, Stat, StatGrid, Disclaimer } from '@/components/ui';
import { money, signedMoney, pct, signedPct, odds as fmtOdds } from '@/lib/format';

const STATUSES: BetStatus[] = ['pending', 'won', 'lost', 'void'];

function download(filename: string, content: string, type: string) {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

export function Tracker() {
  const [state, setState] = useState<TrackerState | null>(null);
  const [label, setLabel] = useState('');
  const [oddsStr, setOddsStr] = useState('2.00');
  const [probStr, setProbStr] = useState('');
  const [stakeStr, setStakeStr] = useState('50');
  const [filter, setFilter] = useState<BetStatus | 'all'>('all');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(store.load());
  }, []);

  if (!state) {
    return (
      <Card>
        <p className="text-muted">Loading your local data…</p>
      </Card>
    );
  }

  const summary = summarize(state);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2000);
  }

  function addBet() {
    const parsed = parseOdds(oddsStr, 'decimal');
    if (!parsed.ok) {
      flash(parsed.error.message);
      return;
    }
    const p = probStr.trim() ? Number(probStr) / 100 : undefined;
    const next = store.addBet({
      label: label.trim() || 'Untitled bet',
      oddsDecimal: parsed.value,
      format: 'decimal',
      rawOdds: oddsStr,
      estimatedProb: p !== undefined && p >= 0 && p <= 1 ? p : undefined,
      stake: Number(stakeStr) || 0,
      status: 'pending',
    });
    setState({ ...next });
    setLabel('');
    flash('Bet added');
  }

  function setStatus(id: string, status: BetStatus) {
    setState({ ...store.updateBet(id, { status }) });
  }

  function remove(id: string) {
    setState({ ...store.deleteBet(id) });
  }

  function clearAll() {
    if (confirm('Delete ALL tracked bets and settings from this browser? This cannot be undone.')) {
      setState({ ...store.deleteAll() });
      flash('All data deleted');
    }
  }

  function exportCsv() {
    download('betlab-bets.csv', toCsv(state!.bets), 'text/csv');
  }
  function exportJson() {
    download('betlab-tracker.json', JSON.stringify(state, null, 2), 'application/json');
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        let imported = 0;
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text) as unknown;
          const bets = (data as { bets?: unknown[] })?.bets ?? (Array.isArray(data) ? data : []);
          for (const raw of bets as unknown[]) {
            const b = store.sanitizeBet(raw);
            if (b) {
              store.addBet(b);
              imported++;
            }
          }
        } else {
          const rows = parseCsv(text);
          for (const row of rows) {
            const b = store.sanitizeBet({
              ...row,
              oddsDecimal: Number(row.oddsDecimal),
              stake: Number(row.stake),
              estimatedProb: row.estimatedProb ? Number(row.estimatedProb) : undefined,
              closingDecimal: row.closingDecimal ? Number(row.closingDecimal) : undefined,
            });
            if (b) {
              store.addBet(b);
              imported++;
            }
          }
        }
        setState({ ...store.load() });
        flash(`Imported ${imported} bet${imported === 1 ? '' : 's'}`);
      } catch {
        flash('Could not read that file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const bets = state.bets.filter((b) => filter === 'all' || b.status === filter);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <StatGrid>
        <Stat label="Record (W-L-V)" value={`${summary.record.won}-${summary.record.lost}-${summary.record.void}`} />
        <Stat label="Turnover" value={money(summary.turnover)} />
        <Stat label="Profit" value={signedMoney(summary.profit)} tone={summary.profit > 0 ? 'positive' : summary.profit < 0 ? 'negative' : 'neutral'} />
        <Stat label="Yield (ROI on turnover)" value={signedPct(summary.yield)} tone={summary.yield > 0 ? 'positive' : summary.yield < 0 ? 'negative' : 'neutral'} />
        <Stat label="Current bankroll" value={money(summary.currentBankroll)} />
        <Stat label="Max drawdown" value={pct(summary.maxDrawdownPct)} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Add bet */}
        <Card>
          <h2 className="text-lg font-semibold">Add a bet</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">
              Selection
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Team A to win" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand" />
            </label>
            <NumberField label="Decimal odds" value={oddsStr} onChange={setOddsStr} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Your prob (optional)" value={probStr} onChange={setProbStr} suffix="%" />
              <NumberField label="Stake" value={stakeStr} onChange={setStakeStr} suffix="$" />
            </div>
            <button type="button" onClick={addBet} className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-strong">
              Add bet
            </button>
            {msg && <p aria-live="polite" className="text-sm text-brand">{msg}</p>}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Your data</h3>
            <p className="mt-1 text-xs text-muted">Stored only in this browser. Nothing is uploaded.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={exportCsv} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">Export CSV</button>
              <button type="button" onClick={exportJson} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">Export JSON</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">Import</button>
              <input ref={fileRef} type="file" accept=".csv,.json" onChange={onImport} className="hidden" />
              <button type="button" onClick={clearAll} className="rounded-lg border border-negative/50 px-3 py-1.5 text-sm text-negative hover:bg-negative/10">Delete all</button>
            </div>
          </div>
        </Card>

        {/* Bet list */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Bets</h2>
            <div className="flex gap-1" role="group" aria-label="Filter by status">
              {(['all', ...STATUSES] as const).map((s) => (
                <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-md px-2.5 py-1 text-xs capitalize ${filter === s ? 'bg-brand text-white' : 'text-muted hover:text-text'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {bets.length === 0 ? (
            <p className="mt-6 text-muted">
              No bets yet. Add one on the left, or save a bet from the{' '}
              <a href="/analyze" className="text-brand hover:underline">analyzer</a>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {bets.map((b) => (
                <BetRow key={b.id} bet={b} onStatus={setStatus} onDelete={remove} />
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Disclaimer />
    </div>
  );
}

function BetRow({ bet, onStatus, onDelete }: { bet: Bet; onStatus: (id: string, s: BetStatus) => void; onDelete: (id: string) => void }) {
  const profit = bet.status === 'won' ? bet.stake * (bet.oddsDecimal - 1) : bet.status === 'lost' ? -bet.stake : 0;
  return (
    <li className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {/* React escapes label text — safe against injected markup */}
          <div className="truncate font-medium">{bet.label}</div>
          <div className="mt-0.5 text-xs text-muted tnum">
            {fmtOdds(bet.oddsDecimal)} · {money(bet.stake)} stake
            {bet.estimatedProb !== undefined && ` · est ${pct(bet.estimatedProb, 0)}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bet.status !== 'pending' && (
            <span className={`text-sm font-semibold tnum ${profit > 0 ? 'text-positive' : profit < 0 ? 'text-negative' : 'text-neutral'}`}>
              {signedMoney(profit)}
            </span>
          )}
          <label className="sr-only" htmlFor={`status-${bet.id}`}>Status</label>
          <select
            id={`status-${bet.id}`}
            value={bet.status}
            onChange={(e) => onStatus(bet.id, e.target.value as BetStatus)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="button" onClick={() => onDelete(bet.id)} aria-label={`Delete bet ${bet.label}`} className="rounded-md border border-border px-2 py-1 text-sm text-muted hover:text-negative">
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
