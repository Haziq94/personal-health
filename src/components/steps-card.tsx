import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { MS_PER_DAY, startOfDay } from '@/domain/dates';
import { stepsForDay } from '@/health/aggregate';
import { stepsProvider } from '@/health/provider';
import { describeAvailability, type DailySteps, type StepsAvailability } from '@/health/types';

/**
 * Steps read through from Apple Health or Health Connect.
 *
 * Nothing is stored locally: the health store owns this data, so a correction
 * made there shows up here rather than diverging from a stale copy.
 */
export function StepsCard({ day }: { day: number }) {
  const [availability, setAvailability] = useState<StepsAvailability | null>(null);
  const [daily, setDaily] = useState<DailySteps[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const from = startOfDay(day) - 6 * MS_PER_DAY;
    const to = startOfDay(day) + MS_PER_DAY;

    try {
      setDaily(await stepsProvider.readDailySteps(from, to));
    } catch {
      // A permission that was never granted reads as no data, not an error.
      setDaily([]);
    }
  }, [day]);

  useEffect(() => {
    let cancelled = false;

    void stepsProvider.availability().then(async (result) => {
      if (cancelled) return;
      setAvailability(result);
      if (result === 'available') await refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function connect() {
    setBusy(true);
    try {
      const granted = await stepsProvider.requestPermission();
      if (granted) await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (availability === null) return null;

  if (availability !== 'available') {
    return (
      <Card title="Steps">
        <ThemedText type="small" themeColor="textSecondary">
          {describeAvailability(availability)}
        </ThemedText>
      </Card>
    );
  }

  const today = daily === null ? null : stepsForDay(daily, day);
  const week = daily?.filter((entry) => entry.day <= startOfDay(day)) ?? [];
  const average =
    week.length > 0
      ? Math.round(week.reduce((sum, entry) => sum + entry.steps, 0) / week.length)
      : null;

  return (
    <Card title="Steps">
      <View style={styles.headline}>
        <ThemedText type="subtitle">
          {today === null ? '—' : today.toLocaleString()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          today
        </ThemedText>
      </View>

      {average !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {average.toLocaleString()} a day over the last {week.length}{' '}
          {week.length === 1 ? 'day' : 'days'}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No step data yet. If you have not granted access, connect below.
        </ThemedText>
      )}

      {today === null ? (
        <Button
          label="Connect health data"
          variant="secondary"
          onPress={() => void connect()}
          disabled={busy}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
});
