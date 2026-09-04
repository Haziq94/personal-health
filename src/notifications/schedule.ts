// Type-only import: erased at build time. expo-notifications THROWS on
// evaluation in Expo Go on Android (push support was removed in SDK 53), so a
// normal top-level import here takes the root layout — and the whole app — down
// with it. Loading it lazily keeps that failure contained to this module.
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { activeReminders, type ReminderSettings } from '@/domain/reminders';

/**
 * Local notification scheduling.
 *
 * Everything here is local-only — there is no push token, no server, and no
 * network call. The app schedules against the device clock and the OS delivers.
 */

type Notifications = typeof NotificationsModule;

const ANDROID_CHANNEL_ID = 'reminders';

let cached: Notifications | null | undefined;

function load(): Notifications | null {
  if (cached !== undefined) return cached;

  try {
    cached = require('expo-notifications') as Notifications;
  } catch {
    // Expo Go. Every function below degrades to a no-op.
    cached = null;
  }

  return cached;
}

export type RemindersAvailability = 'available' | 'needs-development-build';

export function remindersAvailability(): RemindersAvailability {
  return load() ? 'available' : 'needs-development-build';
}

/**
 * How a reminder behaves while the app is open.
 *
 * Called once at startup. Without it, a reminder that fires while you are
 * looking at the app is swallowed silently, which reads as a broken schedule.
 */
export function configureForegroundBehavior(): void {
  const notifications = load();
  if (!notifications) return;

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable';

/**
 * Asks for permission, if it has not been decided already.
 *
 * Returns the outcome rather than throwing: a refused permission is a normal
 * answer, and the settings screen needs to say so rather than fail.
 */
export async function requestPermission(): Promise<PermissionOutcome> {
  const notifications = load();
  if (!notifications) return 'unavailable';

  const existing = await notifications.getPermissionsAsync();
  if (existing.granted) return 'granted';

  // Asking again after an explicit refusal is a no-op on both platforms, so
  // only ask while the system still allows it.
  if (!existing.canAskAgain) return 'denied';

  const requested = await notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

/** Android requires an explicit channel before anything will be delivered. */
async function ensureAndroidChannel(notifications: Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;

  await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Rewrites the schedule to match `settings`.
 *
 * Cancels everything first and reschedules from scratch. The alternative —
 * diffing against what is already scheduled — is where duplicate notifications
 * come from, and there are at most four of these.
 *
 * Returns the number of reminders scheduled.
 */
export async function syncReminders(settings: ReminderSettings): Promise<number> {
  const notifications = load();
  if (!notifications) return 0;

  await notifications.cancelAllScheduledNotificationsAsync();

  const reminders = activeReminders(settings);
  if (reminders.length === 0) return 0;

  await ensureAndroidChannel(notifications);

  for (const reminder of reminders) {
    await notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
      },
      trigger:
        reminder.weekday === undefined
          ? {
              type: notifications.SchedulableTriggerInputTypes.DAILY,
              hour: reminder.time.hour,
              minute: reminder.time.minute,
              channelId: ANDROID_CHANNEL_ID,
            }
          : {
              type: notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: reminder.weekday,
              hour: reminder.time.hour,
              minute: reminder.time.minute,
              channelId: ANDROID_CHANNEL_ID,
            },
    });
  }

  return reminders.length;
}

export async function cancelAllReminders(): Promise<void> {
  const notifications = load();
  if (!notifications) return;

  await notifications.cancelAllScheduledNotificationsAsync();
}

/** What the OS currently has queued — used to show the real state, not our guess. */
export async function scheduledCount(): Promise<number> {
  const notifications = load();
  if (!notifications) return 0;

  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
