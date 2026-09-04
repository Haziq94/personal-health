import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DataCard } from '@/components/data-card';
import { Button, NumberField, Segmented } from '@/components/form';
import { RemindersCard } from '@/components/reminders-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as goalsRepo from '@/db/repositories/goals';
import * as settingsRepo from '@/db/repositories/settings';
import * as weightRepo from '@/db/repositories/weight';
import { formatKcal, parseNumber } from '@/domain/format';
import {
  DEFAULT_MACRO_SPLIT,
  KCAL_PER_KG_FAT,
  calorieTarget,
  macroTargets,
  totalDailyEnergyExpenditure,
} from '@/domain/nutrition';
import type {
  ActivityLevel,
  HeightUnit,
  Profile,
  Sex,
  UnitPreferences,
  VolumeUnit,
  WeightUnit,
} from '@/domain/types';
import { cmToUnit, formatWeight, kgToUnit, unitToCm, unitToKg } from '@/domain/units';
import { useUnits } from '@/hooks/use-units';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
];

const RATE_OPTIONS = [
  { value: '-0.75', label: '-0.75' },
  { value: '-0.5', label: '-0.5' },
  { value: '-0.25', label: '-0.25' },
  { value: '0', label: 'Maintain' },
  { value: '0.25', label: '+0.25' },
];

const DEFAULT_WATER_ML = 2000;

export default function SettingsScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Settings</ThemedText>
      <ProfileAndGoal />
      <UnitsCard />

      <RemindersCard />

      <DataCard />
    </Screen>
  );
}

function ProfileAndGoal() {
  const units = useUnits();
  const mutate = useDbMutation();

  const stored = useDbQuery((db) => settingsRepo.getProfile(db), []);
  const latest = useDbQuery((db) => weightRepo.latestWeight(db), []);
  const goal = useDbQuery((db) => goalsRepo.currentGoal(db), []);

  const [height, setHeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [rate, setRate] = useState('-0.5');
  const [targetWeight, setTargetWeight] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Seed the form from storage once, then leave the user's edits alone.
  useEffect(() => {
    if (seeded || stored.loading || goal.loading) return;

    if (stored.data) {
      setHeight(cmToUnit(stored.data.heightCm, units.height).toFixed(0));
      setBirthYear(String(stored.data.birthYear));
      setSex(stored.data.sex);
      setActivity(stored.data.activityLevel);
    }
    if (goal.data?.targetWeightKg != null) {
      setTargetWeight(kgToUnit(goal.data.targetWeightKg, units.weight).toFixed(1));
    }
    setSeeded(true);
  }, [seeded, stored.loading, stored.data, goal.loading, goal.data, units]);

  const heightValue = parseNumber(height);
  const yearValue = parseNumber(birthYear);
  const rateValue = parseNumber(rate) ?? 0;
  const targetValue = parseNumber(targetWeight);

  const profile: Profile | null =
    heightValue !== null && heightValue > 0 && yearValue !== null && yearValue > 1900
      ? {
          heightCm: unitToCm(heightValue, units.height),
          birthYear: yearValue,
          sex,
          activityLevel: activity,
        }
      : null;

  const weightKg = latest.data?.weightKg ?? null;
  const preview = buildPreview(profile, weightKg, rateValue);

  async function save() {
    if (!profile || weightKg === null) return;

    const kcal = calorieTarget(profile, weightKg, rateValue);

    await mutate(async (db) => {
      await settingsRepo.setProfile(db, profile);
      return goalsRepo.insertGoal(db, {
        // Effective from today, leaving past days judged against the goal that
        // was actually in force at the time.
        effectiveFrom: Date.now(),
        daily: macroTargets(kcal, DEFAULT_MACRO_SPLIT),
        dailyWaterMl: goal.data?.dailyWaterMl ?? DEFAULT_WATER_ML,
        targetWeightKg:
          targetValue !== null ? unitToKg(targetValue, units.weight) : null,
        targetDate: null,
      });
    });
  }

  return (
    <Card title="Profile & goal">
      <View style={styles.pair}>
        <View style={styles.half}>
          <NumberField
            label="Height"
            value={height}
            onChangeText={setHeight}
            suffix={units.height}
          />
        </View>
        <View style={styles.half}>
          <NumberField label="Birth year" value={birthYear} onChangeText={setBirthYear} />
        </View>
      </View>

      <Segmented options={SEX_OPTIONS} value={sex} onChange={setSex} />

      <ThemedText type="small" themeColor="textSecondary">
        Activity level
      </ThemedText>
      <Segmented options={ACTIVITY_OPTIONS} value={activity} onChange={setActivity} />

      <ThemedText type="small" themeColor="textSecondary">
        Goal ({units.weight} per week)
      </ThemedText>
      <Segmented options={RATE_OPTIONS} value={rate} onChange={setRate} />

      <NumberField
        label="Target weight (optional)"
        value={targetWeight}
        onChangeText={setTargetWeight}
        suffix={units.weight}
      />

      {weightKg === null ? (
        <ThemedText type="small" themeColor="textSecondary">
          Log a weigh-in first — the calculation needs your current weight.
        </ThemedText>
      ) : preview ? (
        <View style={styles.preview}>
          <ThemedText type="small" themeColor="textSecondary">
            At {formatWeight(weightKg, units.weight)} you burn about{' '}
            {formatKcal(preview.tdee)} kcal a day.
          </ThemedText>
          <ThemedText type="smallBold">
            Daily target: {formatKcal(preview.target)} kcal
          </ThemedText>
          {preview.floored ? (
            <ThemedText type="small" themeColor="textSecondary">
              Raised to your basal rate — the requested deficit was steeper than is
              sensible.
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Fill in height and birth year to calculate a target.
        </ThemedText>
      )}

      <Button
        label="Save goal"
        onPress={save}
        disabled={!profile || weightKg === null}
      />
    </Card>
  );
}

interface GoalPreview {
  tdee: number;
  target: number;
  /** True when calorieTarget clamped the deficit up to the basal rate. */
  floored: boolean;
}

function buildPreview(
  profile: Profile | null,
  weightKg: number | null,
  rateKgPerWeek: number,
): GoalPreview | null {
  if (!profile || weightKg === null) return null;

  const tdee = totalDailyEnergyExpenditure(profile, weightKg);
  const target = calorieTarget(profile, weightKg, rateKgPerWeek);
  const requested = tdee + (rateKgPerWeek * KCAL_PER_KG_FAT) / 7;

  return { tdee, target, floored: target > requested + 1 };
}

function UnitsCard() {
  const units = useUnits();
  const mutate = useDbMutation();

  function update(patch: Partial<UnitPreferences>) {
    void mutate((db) => settingsRepo.setUnits(db, { ...units, ...patch }));
  }

  return (
    <Card title="Units">
      <Segmented
        options={
          [
            { value: 'kg', label: 'Kilograms' },
            { value: 'lb', label: 'Pounds' },
          ] as { value: WeightUnit; label: string }[]
        }
        value={units.weight}
        onChange={(weight) => update({ weight })}
      />
      <Segmented
        options={
          [
            { value: 'cm', label: 'Centimetres' },
            { value: 'in', label: 'Inches' },
          ] as { value: HeightUnit; label: string }[]
        }
        value={units.height}
        onChange={(height) => update({ height })}
      />
      <Segmented
        options={
          [
            { value: 'ml', label: 'Millilitres' },
            { value: 'floz', label: 'Fluid ounces' },
          ] as { value: VolumeUnit; label: string }[]
        }
        value={units.volume}
        onChange={(volume) => update({ volume })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1 },
  preview: { gap: Spacing.half },
});
