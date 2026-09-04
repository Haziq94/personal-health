import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { activeReminders, type ReminderSettings } from '@/domain/reminders';

/**
 * Local notification scheduling.
 *
 * Everything here is local-only — there is no push token, no server, and no
 * network call. The app schedules against the device clock and the OS delivers.
 */

const ANDROID_CHANNEL_ID = 'reminders';

/**
 * How a reminder behaves while the app is open.
 *
 * Called once at startup. Without it, a reminder that fires while you are
 * looking at the app is swallowed silently, which reads as a broken schedule.
 */
export function configureForegroundBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type PermissionOutcome = 'granted' | 'denied';

/**
 * Asks for permission, if it has not been decided already.
 *
 * Returns the outcome rather than throwing: a refused permission is a normal
 * answer, and the settings screen needs to say so rather than fail.
 */
export async function requestPermission(): Promise<PermissionOutcome> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return 'granted';

  // Asking again after an explicit refusal is a no-op on both platforms, so
  // only ask while the system still allows it.
  if (!existing.canAskAgain) return 'denied';

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

/** Android requires an explicit channel before anything will be delivered. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
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
  await Notifications.cancelAllScheduledNotificationsAsync();

  const reminders = activeReminders(settings);
  if (reminders.length === 0) return 0;

  await ensureAndroidChannel();

  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
      },
      trigger:
        reminder.weekday === undefined
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: reminder.time.hour,
              minute: reminder.time.minute,
              channelId: ANDROID_CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
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
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** What the OS currently has queued — used to show the real state, not our guess. */
export async function scheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
