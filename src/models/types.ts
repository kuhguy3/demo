// Shared app types. Engine-owned types live in the engine; these are app/UI/storage types.
import type { OddsFormat } from '@/engine';

export type BetStatus = 'pending' | 'won' | 'lost' | 'void';

export interface Bet {
  id: string;
  createdAt: string; // ISO
  label: string; // user text — always rendered as plain text
  oddsDecimal: number;
  format: OddsFormat;
  rawOdds: string;
  estimatedProb?: number; // user's p AT TIME OF BET (key for future calibration)
  stake: number;
  status: BetStatus;
  closingDecimal?: number; // for future CLV
  tags?: string[];
  note?: string;
  settledAt?: string;
}

export interface TrackerMeta {
  schemaVersion: number;
  startingBankroll: number;
  currency: string;
  createdAt: string;
}

export interface TrackerState {
  meta: TrackerMeta;
  bets: Bet[];
}
