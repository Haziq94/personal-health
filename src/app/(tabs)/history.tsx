import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbQuery } from '@/db/query';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import { MS_PER_DAY, startOfDay } from '@/domain/dates';
import { formatDay, formatGrams, formatKcal } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

const WINDOW_DAYS = 30;

export default function HistoryScreen() {
  const to = startOfDay(Date.now()) + MS_PER_DAY;
  const from = to - WINDOW_DAYS * MS_PER_DAY;

  const totals = useDbQuery((db) => foodEntriesRepo.dailyTotals(db, from, to), []);

  // Newest first: recent days are the ones worth looking at.
  const days = [...(totals.data ?? [])].reverse();

  return (
    <Screen>
      <ThemedText type="subtitle">History</ThemedText>

      <Card title={`Last ${WINDOW_DAYS} days`}>
        {days.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {totals.loading
              ? ' '
              : 'Nothing logged yet. Days you log food will show up here.'}
          </ThemedText>
        ) : (
          days.map((day) => <DayRow key={day.day} total={day} />)
        )}
      </Card>
    </Screen>
  );
}

function DayRow({ total }: { total: foodEntriesRepo.DailyTotal }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderTopColor: theme.border }]}>
      <View style={styles.label}>
        <ThemedText type="small">{formatDay(total.day)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {total.entryCount} {total.entryCount === 1 ? 'item' : 'items'}
        </ThemedText>
      </View>

      <View style={styles.figures}>
        <ThemedText type="smallBold">{formatKcal(total.kcal)} kcal</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          P {formatGrams(total.proteinG)} · C {formatGrams(total.carbsG)} · F{' '}
          {formatGrams(total.fatG)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { gap: Spacing.half },
  figures: { alignItems: 'flex-end', gap: Spacing.half },
});
