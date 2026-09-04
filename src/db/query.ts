import { useCallback, useEffect, useRef, useState } from 'react';

import type { SqlDriver } from '@/db/driver';
import { useDatabase, useDataVersion } from '@/db/provider';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Runs a read against the database and re-runs it whenever the data version
 * changes or `deps` change.
 *
 * Deliberately not a cache: this app's queries are small, local and fast, so
 * refetching everything after a write is simpler and always correct.
 */
export function useDbQuery<T>(
  run: (db: SqlDriver) => Promise<T>,
  deps: readonly unknown[] = [],
): QueryState<T> {
  const db = useDatabase();
  const { version } = useDataVersion();
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // Held in a ref so callers can pass an inline function without it counting
  // as a dependency and re-running the query on every render.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true }));

    runRef
      .current(db)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: cause instanceof Error ? cause : new Error(String(cause)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return state;
}

/**
 * Wraps a write so that every query refetches once it succeeds. Returns the
 * mutation's own result, so callers can use the created row.
 */
export function useDbMutation(): <T>(write: (db: SqlDriver) => Promise<T>) => Promise<T> {
  const db = useDatabase();
  const { invalidate } = useDataVersion();

  return useCallback(
    async <T,>(write: (driver: SqlDriver) => Promise<T>): Promise<T> => {
      const result = await write(db);
      invalidate();
      return result;
    },
    [db, invalidate],
  );
}
