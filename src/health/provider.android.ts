// Type-only import: erased at build time, so requiring the native module stays
// lazy and Expo Go — where it does not exist — can still run the app.
import type * as HealthConnect from 'react-native-health-connect';

import { toDailySteps } from '@/health/aggregate';
import type { DailySteps, StepsAvailability, StepsProvider } from '@/health/types';

const SDK_AVAILABLE = 3;

let cached: typeof HealthConnect | null | undefined;

function load(): typeof HealthConnect | null {
  if (cached !== undefined) return cached;

  try {
    cached = require('react-native-health-connect') as typeof HealthConnect;
  } catch {
    // Present in a development build, absent in Expo Go.
    cached = null;
  }

  return cached;
}

async function availability(): Promise<StepsAvailability> {
  const hc = load();
  if (!hc) return 'needs-development-build';

  try {
    const status = await hc.getSdkStatus();
    return status === SDK_AVAILABLE ? 'available' : 'not-installed';
  } catch {
    // The JS module loaded but the native side did not — Expo Go again.
    return 'needs-development-build';
  }
}

async function requestPermission(): Promise<boolean> {
  const hc = load();
  if (!hc) return false;

  const initialized = await hc.initialize();
  if (!initialized) return false;

  const granted = await hc.requestPermission([
    { accessType: 'read', recordType: 'Steps' },
  ]);

  return granted.some(
    (permission) =>
      'recordType' in permission &&
      permission.recordType === 'Steps' &&
      permission.accessType === 'read',
  );
}

async function readDailySteps(from: number, to: number): Promise<DailySteps[]> {
  const hc = load();
  if (!hc) return [];

  await hc.initialize();

  const groups = await hc.aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: new Date(from).toISOString(),
      endTime: new Date(to).toISOString(),
    },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });

  return toDailySteps(
    groups.map((group) => ({
      start: new Date(group.startTime).getTime(),
      steps: group.result.COUNT_TOTAL,
    })),
  );
}

export const stepsProvider: StepsProvider = {
  availability,
  requestPermission,
  readDailySteps,
};
