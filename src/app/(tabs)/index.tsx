import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Placeholder } from '@/components/placeholder';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function TodayScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <ThemedText type="subtitle">Today</ThemedText>

      <Card title="Calories">
        <Placeholder phase="Phase 4">
          Calorie ring, macro bars and remaining-for-today.
        </Placeholder>
      </Card>

      <Card title="Meals">
        <Placeholder phase="Phase 3">
          Breakfast, lunch, dinner and snacks with their logged entries.
        </Placeholder>
        <Link href="/food/add" style={[styles.action, { color: theme.tint }]}>
          + Add food
        </Link>
      </Card>

      <Card title="Water">
        <Placeholder phase="Phase 5">Quick-add buttons and a daily tally.</Placeholder>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: Spacing.two,
  },
});
