'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * Read initial state from the URL query string (once, on mount) and provide a
 * setter that mirrors state back into the URL via replaceState — so any result
 * is a shareable link. Static-export friendly (no router data dependency).
 *
 * Generic over the defaults object so `state.foo` is typed `string` (a named
 * property) rather than `string | undefined` (an index signature).
 */
export function useQueryState<T extends Record<string, string>>(defaults: T) {
  const [state, setState] = useState<T>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = { ...defaults };
      for (const key of Object.keys(defaults) as (keyof T)[]) {
        const v = params.get(key as string);
        if (v !== null) next[key] = v as T[keyof T];
      }
      setState(next);
    } catch {
      /* ignore */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch: Partial<T>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(next)) {
          if (v !== '') params.set(k, v as string);
        }
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { state, update, ready };
}
