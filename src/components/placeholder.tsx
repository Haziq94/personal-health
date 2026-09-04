import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';

/**
 * Marks a screen region that is scaffolded but not yet implemented, so an
 * unfinished screen reads as deliberate rather than broken.
 */
export function Placeholder({ phase, children }: { phase: string; children: string }) {
  return (
    <Card>
      <ThemedText type="small">{children}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Arrives in {phase}.
      </ThemedText>
    </Card>
  );
}
