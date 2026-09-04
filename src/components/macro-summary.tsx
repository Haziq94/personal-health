import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { formatGrams, formatKcal } from '@/domain/format';
import type { Macros } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const MACROS: { key: keyof Macros; label: string; color: ThemeColor }[] = [
  { key: 'proteinG', label: 'Protein', color: 'protein' },
  { key: 'carbsG', label: 'Carbs', color: 'carbs' },
  { key: 'fatG', label: 'Fat', color: 'fat' },
];

/**
 * Calories plus the macro split.
 *
 * Phase 4 adds the target and turns this into a remaining-for-today figure;
 * until then it reports consumption only, with no goal implied.
 */
export function MacroSummary({ total }: { total: Macros }) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.calories}>
        <ThemedText type="title">{formatKcal(total.kcal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          kcal
        </ThemedText>
      </View>

      <View style={styles.macros}>
        {MACROS.map(({ key, label, color }) => (
          <View key={key} style={styles.macro}>
            <View style={[styles.swatch, { backgroundColor: theme[color] }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="smallBold">{formatGrams(total[key])} g</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  calories: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  macros: { flexDirection: 'row', gap: Spacing.three },
  macro: { flex: 1, alignItems: 'flex-start', gap: Spacing.half },
  swatch: { width: 24, height: 4, borderRadius: 2 },
});
