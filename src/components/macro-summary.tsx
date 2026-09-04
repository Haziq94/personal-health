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

type MacroSummaryProps = {
  total: Macros;
  /** When absent, consumption is reported with no goal implied. */
  target?: Macros | null;
};

export function MacroSummary({ total, target }: MacroSummaryProps) {
  const remaining = target ? target.kcal - total.kcal : null;
  const over = remaining !== null && remaining < 0;

  return (
    <View style={styles.root}>
      <View style={styles.calories}>
        <ThemedText type="title" themeColor={over ? 'danger' : 'text'}>
          {formatKcal(remaining === null ? total.kcal : Math.abs(remaining))}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {remaining === null ? 'kcal' : over ? 'kcal over' : 'kcal left'}
        </ThemedText>
      </View>

      {target ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatKcal(total.kcal)} of {formatKcal(target.kcal)} kcal
        </ThemedText>
      ) : null}

      <View style={styles.macros}>
        {MACROS.map(({ key, label, color }) => (
          <MacroBar
            key={key}
            label={label}
            color={color}
            consumed={total[key]}
            target={target ? target[key] : null}
          />
        ))}
      </View>
    </View>
  );
}

function MacroBar({
  label,
  color,
  consumed,
  target,
}: {
  label: string;
  color: ThemeColor;
  consumed: number;
  target: number | null;
}) {
  const theme = useTheme();
  // Clamped so going over fills the bar rather than overflowing its container.
  const fill = target && target > 0 ? Math.min(1, consumed / target) : 0;

  return (
    <View style={styles.macro}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme[color], width: `${fill * 100}%` },
          ]}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">
        {formatGrams(consumed)}
        {target ? ` / ${formatGrams(target)}` : ''} g
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  calories: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  macros: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  macro: { flex: 1, gap: Spacing.half },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
