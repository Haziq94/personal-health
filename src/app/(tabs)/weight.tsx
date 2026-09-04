import { Card } from '@/components/card';
import { Placeholder } from '@/components/placeholder';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function WeightScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Weight</ThemedText>

      <Card title="Trend">
        <Placeholder phase="Phase 4">
          Line chart with a 7-day moving average and your goal line.
        </Placeholder>
      </Card>

      <Card title="Log a weigh-in">
        <Placeholder phase="Phase 4">
          Entry form, plus current-vs-target and a projected date.
        </Placeholder>
      </Card>
    </Screen>
  );
}
