import { Card } from '@/components/card';
import { Placeholder } from '@/components/placeholder';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function HistoryScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">History</ThemedText>

      <Card title="Past days">
        <Placeholder phase="Phase 3">
          A day-by-day list of totals; tap a day to review or edit it.
        </Placeholder>
      </Card>
    </Screen>
  );
}
