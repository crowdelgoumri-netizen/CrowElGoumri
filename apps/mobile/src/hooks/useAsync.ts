/**
 * useAsync — generic data-fetch + loading/error state.
 *
 * Every list/detail screen fetches via this so the loading/error/refresh
 * boilerplate lives in one place. `refresh()` re-runs the fetch; `setData`
 * lets screens patch local state after a mutation (e.g. flip a parcel's
 * status) without a round-trip.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setData: (updater: T | null | ((prev: T | null) => T | null)) => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): UseAsyncResult<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((d) => {
        if (alive) {
          setDataState(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "Une erreur est survenue");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback<UseAsyncResult<T>["setData"]>((updater) => {
    setDataState((prev) =>
      typeof updater === "function"
        ? (updater as (p: T | null) => T | null)(prev)
        : updater,
    );
  }, []);

  return { data, loading, error, refresh, setData };
}
