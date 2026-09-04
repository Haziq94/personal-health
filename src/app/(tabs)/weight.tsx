import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Field, NumberField } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { WeightChart } from '@/components/weight-chart';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as goalsRepo from '@/db/repositories/goals';
import * as weightRepo from '@/db/repositories/weight';
import { formatDay, parseNumber } from '@/domain/format';
import { formatWeight, kgToUnit, unitToKg } from '@/domain/units';
import {
  currentSmoothedKg,
  historySpanDays,
  movingAverage,
  projectTarget,
  trendKgPerWeek,
} from '@/domain/weight';
import { useUnits } from '@/hooks/use-units';

export default function WeightScreen() {
  const units = useUnits();
  const entries = useDbQuery((db) => weightRepo.listWeights(db), []);
  const goal = useDbQuery((db) => goalsRepo.currentGoal(db), []);

  const history = entries.data ?? [];
  const points = movingAverage(history, 7);
  const targetKg = goal.data?.targetWeightKg ?? null;

  const smoothed = currentSmoothedKg(history, 7);
  const trend = trendKgPerWeek(history, 28);
  const projection = targetKg === null ? null : projectTarget(history, targetKg);

  return (
    <Screen>
      <ThemedText type="subtitle">Weight</ThemedText>

      <Card title="Trend">
        <WeightChart points={points} targetKg={targetKg} />

        {smoothed !== null ? (
          <View style={styles.stats}>
            <Stat label="Now (7-day average)" value={formatWeight(smoothed, units.weight)} />
            {trend !== null ? (
              <Stat
                label="Rate"
                value={`${trend > 0 ? '+' : ''}${kgToUnit(trend, units.weight).toFixed(2)} ${
                  units.weight
                }/week`}
              />
            ) : null}
            {targetKg !== null ? (
              <Stat
                label="To go"
                value={formatWeight(Math.abs(targetKg - smoothed), units.weight)}
              />
            ) : null}
          </View>
        ) : null}

        {targetKg !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            {projection
              ? `At this rate you reach ${formatWeight(targetKg, units.weight)} around ${formatDay(
                  projection.date,
                )}.`
              : describeNoProjection(history.length, historySpanDays(history))}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Set a target weight in Settings to see a projection.
          </ThemedText>
        )}
      </Card>

      <LogWeighIn />

      <Card title="Recent weigh-ins">
        {history.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing logged yet.
          </ThemedText>
        ) : (
          [...history]
            .reverse()
            .slice(0, 10)
            .map((entry) => (
              <View key={entry.id} style={styles.row}>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDay(entry.loggedAt)}
                </ThemedText>
                <ThemedText type="smallBold">
                  {formatWeight(entry.weightKg, units.weight)}
                </ThemedText>
              </View>
            ))
        )}
      </Card>
    </Screen>
  );
}

/**
 * A projection is withheld rather than guessed when the trend is flat, heading
 * away from the target, or too short to fit. Say which, so the absence does not
 * read as a bug.
 */
function describeNoProjection(count: number, spanDays: number): string {
  if (count < 2) return 'Log a few more weigh-ins to project a date.';
  if (spanDays < 14) return 'A couple more weeks of weigh-ins will make a projection meaningful.';
  return 'No projection yet — the current trend is flat or moving away from your target.';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function LogWeighIn() {
  const units = useUnits();
  const mutate = useDbMutation();
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const parsed = parseNumber(value);
  const canSave = parsed !== null && parsed > 0;

  async function save() {
    if (parsed === null) return;

    await mutate((db) =>
      weightRepo.insertWeight(db, {
        loggedAt: Date.now(),
        weightKg: unitToKg(parsed, units.weight),
        note,
      }),
    );
    setValue('');
    setNote('');
  }

  return (
    <Card title="Log a weigh-in">
      <NumberField
        label="Weight"
        value={value}
        onChangeText={setValue}
        suffix={units.weight}
        placeholder="0.0"
      />
      <Field
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="After gym, before breakfast…"
      />
      <Button label="Save" onPress={save} disabled={!canSave} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four },
  stat: { gap: Spacing.half },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
});
