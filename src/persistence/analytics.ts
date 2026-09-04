// Derived analytics over tracked bets. Uses the engine for ROI/drawdown/CLV/calibration.
import type { Bet, TrackerState } from '@/models/types';
import { roi, maxDrawdown, clv, calibration, type CalibrationResult } from '@/engine';

export interface PerformanceSummary {
  n: number;
  settled: number;
  record: { won: number; lost: number; void: number; pending: number };
  turnover: number; // total staked on settled bets
  profit: number;
  yield: number; // profit / turnover
  roiBankroll: number; // profit / starting bankroll
  currentBankroll: number;
  bankrollSeries: number[];
  maxDrawdownPct: number;
  clvAvg?: number; // average closing-line value, when closing odds present
  calibration: CalibrationResult;
}

/** Minimum settled+estimated bets before a calibration read is meaningful. */
export const MIN_CALIBRATION_BETS = 10;

/** Net profit of a single settled bet. */
function betProfit(b: Bet): number {
  if (b.status === 'won') return b.stake * (b.oddsDecimal - 1);
  if (b.status === 'lost') return -b.stake;
  return 0; // void / pending
}

export function summarize(state: TrackerState): PerformanceSummary {
  const { bets, meta } = state;
  const record = { won: 0, lost: 0, void: 0, pending: 0 };
  let turnover = 0;
  let profit = 0;

  // Oldest-first for the bankroll curve.
  const chrono = [...bets].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bankrollSeries: number[] = [meta.startingBankroll];
  let running = meta.startingBankroll;

  let clvSum = 0;
  let clvCount = 0;

  for (const b of chrono) {
    if (b.status === 'pending') record.pending++;
    else if (b.status === 'won') record.won++;
    else if (b.status === 'lost') record.lost++;
    else record.void++;

    if (b.status === 'won' || b.status === 'lost') {
      turnover += b.stake;
      const pr = betProfit(b);
      profit += pr;
      running += pr;
      bankrollSeries.push(running);
    }

    if (b.closingDecimal && b.closingDecimal > 1) {
      const c = clv(b.oddsDecimal, b.closingDecimal);
      if (c.ok) {
        clvSum += c.value;
        clvCount++;
      }
    }
  }

  const r = roi(profit, turnover, meta.startingBankroll);
  const dd = maxDrawdown(bankrollSeries);

  const calibrationInputs = bets
    .filter((b) => (b.status === 'won' || b.status === 'lost') && b.estimatedProb !== undefined)
    .map((b) => ({ estimatedProb: b.estimatedProb!, won: b.status === 'won' }));
  const cal = calibration(calibrationInputs);

  return {
    n: bets.length,
    settled: record.won + record.lost,
    record,
    turnover,
    profit,
    yield: r.ok ? r.value.yield : 0,
    roiBankroll: r.ok ? r.value.roiBankroll : 0,
    currentBankroll: running,
    bankrollSeries,
    maxDrawdownPct: dd.ok ? dd.value.maxDrawdownPct : 0,
    clvAvg: clvCount > 0 ? clvSum / clvCount : undefined,
    calibration: cal.ok ? cal.value : { buckets: [], n: 0 },
  };
}

// ---- CSV export/import ----

const CSV_HEADERS = [
  'id',
  'createdAt',
  'label',
  'oddsDecimal',
  'format',
  'rawOdds',
  'estimatedProb',
  'stake',
  'status',
  'closingDecimal',
  'note',
] as const;

/** Prefix a cell that could be read as a formula by a spreadsheet (CSV injection). */
function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(bets: Bet[]): string {
  const rows = [CSV_HEADERS.join(',')];
  for (const b of bets) {
    rows.push(
      [
        b.id,
        b.createdAt,
        b.label,
        b.oddsDecimal,
        b.format,
        b.rawOdds,
        b.estimatedProb ?? '',
        b.stake,
        b.status,
        b.closingDecimal ?? '',
        b.note ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return rows.join('\n');
}

/** Minimal, defensive CSV parser (handles quoted fields). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').replace(/^'/, '');
    });
    out.push(row);
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}
