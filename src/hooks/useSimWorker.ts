'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { SimConfig, SimResult, Result, EngineError } from '@/engine';
import type { SimWorkerRequest, SimWorkerResponse } from '@/workers/simulate.worker';

/**
 * Runs Monte Carlo simulations in a Web Worker so large runs never block the
 * main thread. Falls back to nothing usable if Worker isn't available (very
 * old/locked-down browsers) — callers should treat a rejected promise as a
 * signal to show an error rather than crash.
 */
export function useSimWorker() {
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const pending = useRef(new Map<number, (res: SimWorkerResponse) => void>());

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('../workers/simulate.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<SimWorkerResponse>) => {
      const resolver = pending.current.get(e.data.id);
      if (resolver) {
        resolver(e.data);
        pending.current.delete(e.data.id);
      }
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback((cfg: SimConfig): Promise<Result<SimResult>> => {
    return new Promise((resolve) => {
      const worker = workerRef.current;
      if (!worker) {
        // Worker unavailable — this browser can't run simulations off-thread.
        const error: EngineError = {
          code: 'INVALID_NUMBER',
          message: 'Simulation is unavailable in this browser.',
        };
        resolve({ ok: false, error });
        return;
      }
      const id = nextId.current++;
      pending.current.set(id, (res) => {
        if (res.ok) resolve({ ok: true, value: res.value });
        else resolve({ ok: false, error: res.error });
      });
      const req: SimWorkerRequest = { id, cfg };
      worker.postMessage(req);
    });
  }, []);

  return { run };
}
