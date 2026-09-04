/**
 * Platform-agnostic step reading.
 *
 * Steps are the one thing this app does not own: they live in Apple Health or
 * Health Connect, which are the source of truth. Nothing is copied into the
 * local database — it is read through on demand, so a correction made in the
 * health app is reflected here rather than diverging from a stale snapshot.
 */

export type StepsAvailability =
  /** The platform store is present and usable. */
  | 'available'
  /** Running in Expo Go, where the native module does not exist. */
  | 'needs-development-build'
  /** Health Connect is not installed, or the OS is too old. */
  | 'not-installed'
  /** No health store on this platform (web). */
  | 'unsupported';

export interface DailySteps {
  /** Local midnight for the day. */
  day: number;
  steps: number;
}

export interface StepsProvider {
  availability(): Promise<StepsAvailability>;
  /** Returns whether read access was granted. Safe to call repeatedly. */
  requestPermission(): Promise<boolean>;
  /** `from` inclusive, `to` exclusive. Days with no data are omitted. */
  readDailySteps(from: number, to: number): Promise<DailySteps[]>;
}

/** Used on platforms with no health store, so callers need no special case. */
export const unsupportedProvider: StepsProvider = {
  availability: async () => 'unsupported',
  requestPermission: async () => false,
  readDailySteps: async () => [],
};

export function describeAvailability(availability: StepsAvailability): string {
  switch (availability) {
    case 'available':
      return 'Connected.';
    case 'needs-development-build':
      return 'Step tracking needs a development build — it cannot run in Expo Go.';
    case 'not-installed':
      return 'No health store found on this device.';
    case 'unsupported':
      return 'Step tracking is not available on this platform.';
  }
}
