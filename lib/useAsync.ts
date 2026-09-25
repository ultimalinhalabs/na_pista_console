"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
}

/**
 * F29: the Console's one data-fetching convention (replaces per-page
 * useState/useEffect/try-catch triplets). Ignores responses from stale
 * requests (a slow earlier filter can never overwrite a newer result), keeps
 * the previous data visible while reloading, and never swallows errors.
 * `enabled: false` skips fetching (e.g. until a timezone is known).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, options: { enabled?: boolean } = {}): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const sequence = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (current === sequence.current) setData(result);
    } catch (err) {
      if (current === sequence.current) setError(err);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return { data, error, loading, reload: run, setData };
}
