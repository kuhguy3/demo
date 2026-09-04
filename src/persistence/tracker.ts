// localStorage-backed bet tracker. Data NEVER leaves the browser.
// Every read is validated/sanitized; every access is try/caught (private mode,
// quota, disabled storage). Falls back to an in-memory store when unavailable.
import type { Bet, BetStatus, TrackerState, TrackerMeta } from '@/models/types';
import type { OddsFormat } from '@/engine';

const KEY = 'betlab.v1.tracker';
export const SCHEMA_VERSION = 1;

let memoryFallback: TrackerState | null = null;

function defaultState(): TrackerState {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      startingBankroll: 1000,
      currency: 'USD',
      createdAt: new Date().toISOString(),
    },
    bets: [],
  };
}

function isStatus(s: unknown): s is BetStatus {
  return s === 'pending' || s === 'won' || s === 'lost' || s === 'void';
}

function isFormat(s: unknown): s is OddsFormat {
  return s === 'american' || s === 'decimal' || s === 'fractional';
}

/** Coerce an untrusted object into a valid Bet, or null if unusable. */
export function sanitizeBet(raw: unknown): Bet | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const oddsDecimal = Number(o.oddsDecimal);
  const stake = Number(o.stake);
  if (!Number.isFinite(oddsDecimal) || oddsDecimal <= 1) return null;
  if (!Number.isFinite(stake) || stake < 0) return null;
  const bet: Bet = {
    id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    label: typeof o.label === 'string' ? o.label.slice(0, 200) : '',
    oddsDecimal,
    format: isFormat(o.format) ? o.format : 'decimal',
    rawOdds: typeof o.rawOdds === 'string' ? o.rawOdds.slice(0, 40) : String(oddsDecimal),
    stake,
    status: isStatus(o.status) ? o.status : 'pending',
  };
  const p = Number(o.estimatedProb);
  if (Number.isFinite(p) && p >= 0 && p <= 1) bet.estimatedProb = p;
  const cd = Number(o.closingDecimal);
  if (Number.isFinite(cd) && cd > 1) bet.closingDecimal = cd;
  if (typeof o.note === 'string') bet.note = o.note.slice(0, 500);
  if (Array.isArray(o.tags)) bet.tags = o.tags.filter((t): t is string => typeof t === 'string').slice(0, 10);
  if (typeof o.settledAt === 'string') bet.settledAt = o.settledAt;
  return bet;
}

export function load(): TrackerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memoryFallback ?? defaultState();
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return defaultState();
    const obj = parsed as Record<string, unknown>;
    const metaRaw = (obj.meta ?? {}) as Record<string, unknown>;
    const meta: TrackerMeta = {
      schemaVersion: SCHEMA_VERSION,
      startingBankroll: Number(metaRaw.startingBankroll) > 0 ? Number(metaRaw.startingBankroll) : 1000,
      currency: typeof metaRaw.currency === 'string' ? metaRaw.currency : 'USD',
      createdAt: typeof metaRaw.createdAt === 'string' ? metaRaw.createdAt : new Date().toISOString(),
    };
    const betsRaw = Array.isArray(obj.bets) ? obj.bets : [];
    const bets = betsRaw.map(sanitizeBet).filter((b): b is Bet => b !== null);
    return { meta, bets };
  } catch {
    return memoryFallback ?? defaultState();
  }
}

export function save(state: TrackerState): void {
  memoryFallback = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / unavailable — memory fallback holds it for the session */
  }
}

export function addBet(bet: Omit<Bet, 'id' | 'createdAt'> & Partial<Pick<Bet, 'id' | 'createdAt'>>): TrackerState {
  const state = load();
  const full: Bet = {
    id: bet.id ?? crypto.randomUUID(),
    createdAt: bet.createdAt ?? new Date().toISOString(),
    ...bet,
  } as Bet;
  const sanitized = sanitizeBet(full);
  if (sanitized) {
    state.bets.unshift(sanitized);
    save(state);
  }
  return state;
}

export function saveBetFromAnalysis(input: {
  oddsDecimal: number;
  format: OddsFormat;
  rawOdds: string;
  estimatedProb?: number;
  stake: number;
  label?: string;
}): TrackerState {
  return addBet({
    label: input.label ?? 'Bet from analyzer',
    oddsDecimal: input.oddsDecimal,
    format: input.format,
    rawOdds: input.rawOdds,
    estimatedProb: input.estimatedProb,
    stake: input.stake,
    status: 'pending',
  });
}

export function updateBet(id: string, patch: Partial<Bet>): TrackerState {
  const state = load();
  const idx = state.bets.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const merged = { ...state.bets[idx]!, ...patch };
    if (patch.status && patch.status !== 'pending' && !merged.settledAt) {
      merged.settledAt = new Date().toISOString();
    }
    const sanitized = sanitizeBet(merged);
    if (sanitized) state.bets[idx] = sanitized;
    save(state);
  }
  return state;
}

export function deleteBet(id: string): TrackerState {
  const state = load();
  state.bets = state.bets.filter((b) => b.id !== id);
  save(state);
  return state;
}

export function deleteAll(): TrackerState {
  const fresh = defaultState();
  memoryFallback = fresh;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return fresh;
}

export function setMeta(patch: Partial<TrackerMeta>): TrackerState {
  const state = load();
  state.meta = { ...state.meta, ...patch, schemaVersion: SCHEMA_VERSION };
  save(state);
  return state;
}
