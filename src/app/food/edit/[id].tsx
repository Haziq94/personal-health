import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, NumberField, Segmented } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import { formatKcal, formatServings, formatTime, parseNumber } from '@/domain/format';
import { MEAL_TYPES, type MealType } from '@/domain/types';

const MEAL_OPTIONS = MEAL_TYPES.map((meal) => ({
  value: meal,
  label: meal === 'snack' ? 'Snack' : meal[0].toUpperCase() + meal.slice(1),
}));

export default function EditEntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const entry = useDbQuery((db) => foodEntriesRepo.getEntry(db, id), [id]);
  const mutate = useDbMutation();

  const [servings, setServings] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealType | null>(null);

  // Seed the form once the entry arrives, without clobbering later edits.
  useEffect(() => {
    if (entry.data && servings === null) {
      setServings(formatServings(entry.data.servings));
      setMeal(entry.data.meal);
    }
  }, [entry.data, servings]);

  if (entry.loading) return <Screen />;

  if (!entry.data) {
    return (
      <Screen>
        <ThemedText type="subtitle">Entry not found</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          It may have been deleted already.
        </ThemedText>
        <Button label="Close" variant="secondary" onPress={router.back} />
      </Screen>
    );
  }

  const current = entry.data;
  const servingCount = parseNumber(servings ?? '');
  const canSave = servingCount !== null && servingCount > 0 && meal !== null;

  async function save() {
    if (servingCount === null || meal === null) return;

    await mutate((db) =>
      foodEntriesRepo.updateEntry(db, { ...current, servings: servingCount, meal }),
    );
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete this entry?', `“${current.name}” will be removed from today.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await mutate((db) => foodEntriesRepo.deleteEntry(db, current.id));
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <View>
        <ThemedText type="subtitle">{current.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Logged at {formatTime(current.loggedAt)} ·{' '}
          {formatKcal(current.perServing.kcal)} kcal per serving
        </ThemedText>
      </View>

      <NumberField
        label="Servings"
        value={servings ?? ''}
        onChangeText={setServings}
      />

      {meal ? <Segmented options={MEAL_OPTIONS} value={meal} onChange={setMeal} /> : null}

      <ThemedText type="small" themeColor="textSecondary">
        {formatKcal(current.perServing.kcal * (servingCount ?? 0))} kcal total
      </ThemedText>

      <View style={styles.actions}>
        <Button label="Save" onPress={save} disabled={!canSave} />
        <Button label="Delete" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two, marginTop: Spacing.two },
});
