import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { MacroSummary } from '@/components/macro-summary';
import { MealSection } from '@/components/meal-section';
import { Screen } from '@/components/screen';
import { StepsCard } from '@/components/steps-card';
import { ThemedText } from '@/components/themed-text';
import { WaterCard } from '@/components/water-card';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import * as foodsRepo from '@/db/repositories/foods';
import * as goalsRepo from '@/db/repositories/goals';
import { MS_PER_DAY } from '@/domain/dates';
import { formatDay } from '@/domain/format';
import { defaultMealFor } from '@/domain/meals';
import { sumEntries } from '@/domain/nutrition';
import { MEAL_TYPES, type Food, type FoodEntry, type MealType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function TodayScreen() {
  const router = useRouter();
  const today = Date.now();

  const entries = useDbQuery((db) => foodEntriesRepo.listEntriesForDay(db, today), []);
  const quickAdd = useDbQuery(
    (db) => foodsRepo.listMostLogged(db, { since: today - 30 * MS_PER_DAY, limit: 8 }),
    [],
  );
  const goal = useDbQuery((db) => goalsRepo.goalAt(db, today), []);
  const mutate = useDbMutation();

  const byMeal = useMemo(() => groupByMeal(entries.data ?? []), [entries.data]);
  const total = useMemo(() => sumEntries(entries.data ?? []), [entries.data]);

  function openAdd(meal: MealType) {
    router.push({ pathname: '/food/add', params: { meal } });
  }

  function openEntry(entry: FoodEntry) {
    router.push({ pathname: '/food/edit/[id]', params: { id: entry.id } });
  }

  async function logOneServing(food: Food) {
    const now = Date.now();
    await mutate((db) =>
      foodEntriesRepo.insertEntry(db, {
        foodId: food.id,
        name: food.name,
        loggedAt: now,
        meal: defaultMealFor(now),
        servings: 1,
        perServing: food.perServing,
      }),
    );
  }

  return (
    <Screen>
      <View>
        <ThemedText type="subtitle">Today</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDay(today)}
        </ThemedText>
      </View>

      <Card title="Calories">
        <MacroSummary total={total} target={goal.data?.daily ?? null} />
      </Card>

      {quickAdd.data?.length ? (
        <Card title="Quick add">
          <QuickAddRow foods={quickAdd.data} onPick={logOneServing} />
        </Card>
      ) : null}

      <Card title="Meals">
        {MEAL_TYPES.map((meal) => (
          <MealSection
            key={meal}
            meal={meal}
            entries={byMeal[meal]}
            onAdd={openAdd}
            onSelect={openEntry}
          />
        ))}
      </Card>

      <WaterCard day={today} />

      <StepsCard day={today} />
    </Screen>
  );
}

function QuickAddRow({
  foods,
  onPick,
}: {
  foods: readonly Food[];
  onPick: (food: Food) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickAdd}>
      {foods.map((food) => (
        <Pressable
          accessibilityRole="button"
          key={food.id}
          onPress={() => onPick(food)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <ThemedText type="small" numberOfLines={1}>
            {food.name}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function groupByMeal(entries: readonly FoodEntry[]): Record<MealType, FoodEntry[]> {
  const grouped = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  } as Record<MealType, FoodEntry[]>;

  for (const entry of entries) {
    grouped[entry.meal].push(entry);
  }

  return grouped;
}

const styles = StyleSheet.create({
  quickAdd: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    maxWidth: 160,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
