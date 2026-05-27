import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useApi - hook untuk fetch dengan AbortController, dedup, dan refresh manual.
 * @param {(signal: AbortSignal) => Promise<T>} fetcher
 * @param {Array} deps
 * @param {{ initialData?: T, skip?: boolean, pollMs?: number }} options
 */
export function useApi(fetcher, deps = [], options = {}) {
  const { initialData = null, skip = false, pollMs = 0 } = options;
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const fetcherRef = useRef(fetcher);

  // Update ref tanpa trigger re-render (advanced-use-latest pattern)
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const result = await fetcherRef.current(controller.signal);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
      }
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skip) return;
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetcherRef.current(controller.signal)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  // Polling (rerender-defer-reads: pakai ref untuk handler stabil)
  useEffect(() => {
    if (!pollMs || skip) return;
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, skip, refresh]);

  return { data, error, loading, refresh, setData };
}

/**
 * useInterval dengan ref pattern untuk callback stabil.
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || delay === undefined) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
