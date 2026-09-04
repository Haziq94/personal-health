import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { SqlDriver } from '@/db/driver';
import { openDatabase } from '@/db/open';
import { useTheme } from '@/hooks/use-theme';

const DatabaseContext = createContext<SqlDriver | null>(null);

/**
 * Opens the database and holds the splash screen until migrations finish.
 *
 * Children only ever mount with a migrated database, so no screen has to handle
 * a "database not ready yet" state.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SqlDriver | null>(null);
  const [error, setError] = useState<Error | null>(null);

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

  if (error) return <DatabaseError error={error} />;
  if (!db) return null;

  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
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

export function useDatabase(): SqlDriver {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used inside a DatabaseProvider');
  }
  return db;
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
