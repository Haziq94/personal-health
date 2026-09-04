import { Card } from '@/components/card';
import { Placeholder } from '@/components/placeholder';
import { Screen } from '@/components/screen';

export default function AddFoodScreen() {
  return (
    <Screen>
      <Card title="Search your library">
        <Placeholder phase="Phase 3">
          Fuzzy search over foods you have logged before, favourites first.
        </Placeholder>
      </Card>

      <Card title="New food">
        <Placeholder phase="Phase 3">
          Name, serving and macros for something you have not logged before.
        </Placeholder>
      </Card>
    </Screen>
  );
}
