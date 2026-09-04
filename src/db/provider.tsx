import * as SplashScreen from 'expo-splash-screen';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { SqlDriver } from '@/db/driver';
import { openDatabase } from '@/db/open';
import { useTheme } from '@/hooks/use-theme';

interface DatabaseContextValue {
  db: SqlDriver;
  /**
   * Bumped after every write. Queries depend on it, so a log entered in the
   * modal refreshes the Today screen behind it without any explicit plumbing.
   */
  version: number;
  invalidate: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/**
 * Opens the database and holds the splash screen until migrations finish.
 *
 * Children only ever mount with a migrated database, so no screen has to handle
 * a "database not ready yet" state.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SqlDriver | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    openDatabase()
      .then((driver) => {
        if (!cancelled) setDb(driver);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Drop the splash once we know the outcome either way — otherwise a failed
    // migration looks like a permanent hang.
    if (db || error) void SplashScreen.hideAsync();
  }, [db, error]);

  const invalidate = useCallback(() => setVersion((n) => n + 1), []);

  const value = useMemo<DatabaseContextValue | null>(
    () => (db ? { db, version, invalidate } : null),
    [db, version, invalidate],
  );

  if (error) return <DatabaseError error={error} />;
  if (!value) return null;

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

function DatabaseError({ error }: { error: Error }) {
  const theme = useTheme();

  return (
    <View style={[styles.error, { backgroundColor: theme.background }]}>
      <ThemedText type="subtitle">Could not open your data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The app could not prepare its database, so nothing has been loaded. Your existing
        data has not been changed.
      </ThemedText>
      <ThemedText type="code" themeColor="danger">
        {error.message}
      </ThemedText>
    </View>
  );
}

function useDatabaseContext(): DatabaseContextValue {
  const value = useContext(DatabaseContext);
  if (!value) {
    throw new Error('Database hooks must be used inside a DatabaseProvider');
  }
  return value;
}

export function useDatabase(): SqlDriver {
  return useDatabaseContext().db;
}

/** Current data version, and the callback that bumps it after a write. */
export function useDataVersion(): { version: number; invalidate: () => void } {
  const { version, invalidate } = useDatabaseContext();
  return { version, invalidate };
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
