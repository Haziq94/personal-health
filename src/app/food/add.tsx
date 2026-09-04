import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Field, NumberField, Segmented } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import * as foodsRepo from '@/db/repositories/foods';
import { formatKcal, parseNumber } from '@/domain/format';
import { defaultMealFor } from '@/domain/meals';
import { kcalFromMacros } from '@/domain/nutrition';
import { MEAL_TYPES, type Food, type Macros, type MealType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const MEAL_OPTIONS = MEAL_TYPES.map((meal) => ({
  value: meal,
  label: meal === 'snack' ? 'Snack' : meal[0].toUpperCase() + meal.slice(1),
}));

export default function AddFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [meal, setMeal] = useState<MealType>(() => initialMeal(params.meal));
  const [mode, setMode] = useState<'search' | 'create'>('search');

  return mode === 'create' ? (
    <CreateFood meal={meal} onMeal={setMeal} onCancel={() => setMode('search')} onDone={router.back} />
  ) : (
    <SearchLibrary
      meal={meal}
      onMeal={setMeal}
      onCreate={() => setMode('create')}
      onDone={router.back}
    />
  );
}

function initialMeal(value: string | undefined): MealType {
  return MEAL_TYPES.includes(value as MealType) ? (value as MealType) : defaultMealFor();
}

type SharedProps = {
  meal: MealType;
  onMeal: (meal: MealType) => void;
  onDone: () => void;
};

function SearchLibrary({
  meal,
  onMeal,
  onCreate,
  onDone,
}: SharedProps & { onCreate: () => void }) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');

  const foods = useDbQuery((db) => foodsRepo.listFoods(db, { search }), [search]);
  const mutate = useDbMutation();

  const servingCount = parseNumber(servings);
  const canLog = selected !== null && servingCount !== null && servingCount > 0;

  async function log() {
    if (!selected || servingCount === null) return;

    await mutate((db) =>
      foodEntriesRepo.insertEntry(db, {
        foodId: selected.id,
        name: selected.name,
        loggedAt: Date.now(),
        meal,
        servings: servingCount,
        perServing: selected.perServing,
      }),
    );
    onDone();
  }

  return (
    <Screen scroll={false}>
      <Field
        label="Search your foods"
        value={search}
        onChangeText={setSearch}
        placeholder="Name or brand"
        autoCorrect={false}
      />

      <FlatList
        data={foods.data ?? []}
        keyExtractor={(food) => food.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        ListEmptyComponent={
          foods.loading ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {search
                ? `Nothing matches “${search}”. Add it as a new food below.`
                : 'Your food library is empty. Add your first food below.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selected?.id === item.id }}
            onPress={() => setSelected(item)}
            style={({ pressed }) => [
              styles.foodRow,
              selected?.id === item.id && { backgroundColor: theme.backgroundSelected },
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <View style={styles.foodText}>
              <ThemedText numberOfLines={1}>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {item.brand ? `${item.brand} · ` : ''}
                {item.servingLabel}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatKcal(item.perServing.kcal)} kcal
            </ThemedText>
          </Pressable>
        )}
      />

      {selected ? (
        <Card title={selected.name}>
          <NumberField
            label="Servings"
            value={servings}
            onChangeText={setServings}
            suffix={selected.servingLabel}
          />
          <Segmented options={MEAL_OPTIONS} value={meal} onChange={onMeal} />
          <ThemedText type="small" themeColor="textSecondary">
            {formatKcal(selected.perServing.kcal * (servingCount ?? 0))} kcal total
          </ThemedText>
          <Button label="Log it" onPress={log} disabled={!canLog} />
        </Card>
      ) : (
        <Button label="Add a new food" variant="secondary" onPress={onCreate} />
      )}
    </Screen>
  );
}

function CreateFood({
  meal,
  onMeal,
  onCancel,
  onDone,
}: SharedProps & { onCancel: () => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('1 serving');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutate = useDbMutation();

  const kcalValue = parseNumber(kcal);
  const perServing: Macros = {
    kcal: kcalValue ?? 0,
    proteinG: parseNumber(protein) ?? 0,
    carbsG: parseNumber(carbs) ?? 0,
    fatG: parseNumber(fat) ?? 0,
  };

  const nameError = submitted && !name.trim() ? 'Give the food a name.' : null;
  const kcalError =
    submitted && (kcalValue === null || kcalValue < 0)
      ? 'Enter the calories in one serving.'
      : null;

  // Non-blocking: a large gap between stated and derived calories usually means
  // a mistyped digit, but plenty of real foods do not add up exactly.
  const derived = kcalFromMacros(perServing);
  const mismatch =
    kcalValue !== null && kcalValue > 0 && derived > 0 && Math.abs(derived - kcalValue) > kcalValue * 0.25
      ? `Macros work out to about ${formatKcal(derived)} kcal. Worth a second look.`
      : null;

  async function save() {
    setSubmitted(true);
    if (!name.trim() || kcalValue === null || kcalValue < 0) return;

    await mutate(async (db) => {
      const food = await foodsRepo.insertFood(db, {
        name,
        brand,
        servingLabel,
        perServing,
      });
      // Creating a food is nearly always part of logging it, so do both.
      return foodEntriesRepo.insertEntry(db, {
        foodId: food.id,
        name: food.name,
        loggedAt: Date.now(),
        meal,
        servings: 1,
        perServing: food.perServing,
      });
    });
    onDone();
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Saved to your library, so logging it again later takes one tap.
      </ThemedText>

      <Field label="Name" value={name} onChangeText={setName} error={nameError} />
      <Field label="Brand (optional)" value={brand} onChangeText={setBrand} />
      <Field
        label="One serving is"
        value={servingLabel}
        onChangeText={setServingLabel}
        placeholder="1 bowl, 100 g, 1 slice…"
      />

      <NumberField
        label="Calories per serving"
        value={kcal}
        onChangeText={setKcal}
        suffix="kcal"
        error={kcalError}
      />

      <View style={styles.macroRow}>
        <View style={styles.macroField}>
          <NumberField label="Protein" value={protein} onChangeText={setProtein} suffix="g" />
        </View>
        <View style={styles.macroField}>
          <NumberField label="Carbs" value={carbs} onChangeText={setCarbs} suffix="g" />
        </View>
        <View style={styles.macroField}>
          <NumberField label="Fat" value={fat} onChangeText={setFat} suffix="g" />
        </View>
      </View>

      {mismatch ? (
        <ThemedText type="small" themeColor="textSecondary">
          {mismatch}
        </ThemedText>
      ) : null}

      <Segmented options={MEAL_OPTIONS} value={meal} onChange={onMeal} />

      <Button label="Save and log" onPress={save} />
      <Button label="Back to search" variant="secondary" onPress={onCancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  foodText: { flex: 1, gap: Spacing.half },
  macroRow: { flexDirection: 'row', gap: Spacing.two },
  macroField: { flex: 1 },
});
