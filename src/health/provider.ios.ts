// Type-only import: erased at build time, so requiring the native module stays
// lazy and Expo Go — where it does not exist — can still run the app.
import type * as HealthKit from '@kingstinct/react-native-healthkit';

import { startOfDay } from '@/domain/dates';
import { toDailySteps } from '@/health/aggregate';
import type { DailySteps, StepsAvailability, StepsProvider } from '@/health/types';

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';

let cached: typeof HealthKit | null | undefined;

function load(): typeof HealthKit | null {
  if (cached !== undefined) return cached;

  try {
    cached = require('@kingstinct/react-native-healthkit') as typeof HealthKit;
  } catch {
    // Present in a development build, absent in Expo Go.
    cached = null;
  }

  return cached;
}

async function availability(): Promise<StepsAvailability> {
  const hk = load();
  if (!hk) return 'needs-development-build';

  try {
    // False on iPad and in the simulator, where HealthKit has no data.
    return (await hk.isHealthDataAvailableAsync()) ? 'available' : 'not-installed';
  } catch {
    return 'needs-development-build';
  }
}

async function requestPermission(): Promise<boolean> {
  const hk = load();
  if (!hk) return false;

  // HealthKit deliberately does not reveal whether read access was granted —
  // this resolves true once the sheet has been answered either way. An empty
  // result from a later query is indistinguishable from a refusal, by design.
  return hk.requestAuthorization({ toRead: [STEP_COUNT] });
}

async function readDailySteps(from: number, to: number): Promise<DailySteps[]> {
  const hk = load();
  if (!hk) return [];

  // Anchoring on local midnight makes the daily intervals line up with the
  // days the rest of the app reports.
  const anchor = new Date(startOfDay(from));

  const results = await hk.queryStatisticsCollectionForQuantity(
    STEP_COUNT,
    ['cumulativeSum'],
    anchor,
    { day: 1 },
    {
      unit: 'count',
      filter: { date: { startDate: new Date(from), endDate: new Date(to) } },
    },
  );

  return toDailySteps(
    results.map((result) => ({
      start: (result.startDate ?? anchor).getTime(),
      steps: result.sumQuantity?.quantity ?? 0,
    })),
  );
}

export const stepsProvider: StepsProvider = {
  availability,
  requestPermission,
  readDailySteps,
};
