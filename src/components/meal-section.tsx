import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatKcal, formatServings, mealLabel } from '@/domain/format';
import { entryTotal, sumEntries } from '@/domain/nutrition';
import type { FoodEntry, MealType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type MealSectionProps = {
  meal: MealType;
  entries: readonly FoodEntry[];
  onAdd: (meal: MealType) => void;
  onSelect: (entry: FoodEntry) => void;
};

export function MealSection({ meal, entries, onAdd, onSelect }: MealSectionProps) {
  const theme = useTheme();
  const total = sumEntries(entries);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{mealLabel(meal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entries.length ? `${formatKcal(total.kcal)} kcal` : ''}
        </ThemedText>
      </View>

      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} onPress={() => onSelect(entry)} />
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add to ${mealLabel(meal).toLowerCase()}`}
        onPress={() => onAdd(meal)}
        style={({ pressed }) => [styles.add, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="add-circle-outline" size={18} color={theme.tint} />
        <ThemedText type="small" style={{ color: theme.tint }}>
          Add
        </ThemedText>
      </Pressable>
    </View>
  );
}

function EntryRow({ entry, onPress }: { entry: FoodEntry; onPress: () => void }) {
  const theme = useTheme();
  const total = entryTotal(entry);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1}>{entry.name}</ThemedText>
        {entry.servings !== 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatServings(entry.servings)} servings
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatKcal(total.kcal)} kcal
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.one },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: Spacing.half },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
