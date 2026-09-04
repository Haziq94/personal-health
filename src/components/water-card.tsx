import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as goalsRepo from '@/db/repositories/goals';
import * as waterRepo from '@/db/repositories/water';
import { formatVolume } from '@/domain/units';
import { useTheme } from '@/hooks/use-theme';
import { useUnits } from '@/hooks/use-units';

/** Stored in millilitres; shown in whatever unit the user prefers. */
const PRESETS_ML = [250, 500];

export function WaterCard({ day }: { day: number }) {
  const theme = useTheme();
  const units = useUnits();
  const mutate = useDbMutation();

  const entries = useDbQuery((db) => waterRepo.listWaterForDay(db, day), [day]);
  const goal = useDbQuery((db) => goalsRepo.goalAt(db, day), [day]);

  const logged = entries.data ?? [];
  const total = logged.reduce((sum, entry) => sum + entry.volumeMl, 0);
  const targetMl = goal.data?.dailyWaterMl ?? null;
  const fill = targetMl && targetMl > 0 ? Math.min(1, total / targetMl) : 0;

  function add(volumeMl: number) {
    void mutate((db) => waterRepo.insertWater(db, { loggedAt: Date.now(), volumeMl }));
  }

  function undoLast() {
    const last = logged[logged.length - 1];
    if (last) void mutate((db) => waterRepo.deleteWater(db, last.id));
  }

  return (
    <Card title="Water">
      <View style={styles.headline}>
        <ThemedText type="subtitle">{formatVolume(total, units.volume)}</ThemedText>
        {targetMl !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            of {formatVolume(targetMl, units.volume)}
          </ThemedText>
        ) : null}
      </View>

      {targetMl !== null ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[styles.fill, { backgroundColor: theme.water, width: `${fill * 100}%` }]}
          />
        </View>
      ) : null}

      <View style={styles.buttons}>
        {PRESETS_ML.map((volumeMl) => (
          <Pressable
            accessibilityRole="button"
            key={volumeMl}
            onPress={() => add(volumeMl)}
            style={({ pressed }) => [
              styles.preset,
              {
                borderColor: theme.border,
                backgroundColor: theme.background,
                opacity: pressed ? 0.6 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.water }}>
              +{formatVolume(volumeMl, units.volume)}
            </ThemedText>
          </Pressable>
        ))}

        {/* A mis-tap on a one-tap control needs a one-tap way back. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: logged.length === 0 }}
          disabled={logged.length === 0}
          onPress={undoLast}
          style={({ pressed }) => [
            styles.preset,
            {
              borderColor: theme.border,
              backgroundColor: theme.background,
              opacity: logged.length === 0 ? 0.35 : pressed ? 0.6 : 1,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Undo
          </ThemedText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  buttons: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  preset: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
});
