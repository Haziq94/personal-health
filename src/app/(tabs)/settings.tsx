import { Card } from '@/components/card';
import { Placeholder } from '@/components/placeholder';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function SettingsScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Settings</ThemedText>

      <Card title="Profile & goals">
        <Placeholder phase="Phase 4">
          Height, age, sex and activity level, feeding a TDEE-based calorie target.
        </Placeholder>
      </Card>

      <Card title="Units">
        <Placeholder phase="Phase 4">Switch between kg/lb and ml/fl oz.</Placeholder>
      </Card>

      <Card title="Reminders">
        <Placeholder phase="Phase 5">
          Meal reminders and a weekly weigh-in notification.
        </Placeholder>
      </Card>

      <Card title="Your data">
        <Placeholder phase="Phase 6">
          Export and import everything as JSON or CSV. Until this ships, the only copy
          of your data lives on this device.
        </Placeholder>
      </Card>
    </Screen>
  );
}
