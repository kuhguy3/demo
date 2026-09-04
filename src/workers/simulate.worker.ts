// Runs the Monte Carlo simulation off the main thread so large runs never
// block the UI. Communicates via a simple request/response message protocol.
import { simulate, type SimConfig, type SimResult, type EngineError } from '@/engine';

export interface SimWorkerRequest {
  id: number;
  cfg: SimConfig;
}

export type SimWorkerResponse =
  | { id: number; ok: true; value: SimResult }
  | { id: number; ok: false; error: EngineError };

self.onmessage = (e: MessageEvent<SimWorkerRequest>) => {
  const { id, cfg } = e.data;
  const result = simulate(cfg);
  const response: SimWorkerResponse = result.ok
    ? { id, ok: true, value: result.value }
    : { id, ok: false, error: result.error };
  (self as unknown as Worker).postMessage(response);
};
