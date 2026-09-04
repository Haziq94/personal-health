/**
 * Reminder settings and time-of-day handling.
 *
 * Times are stored as "HH:MM" strings rather than timestamps: a reminder means
 * "08:00 local, every day", which must survive travel and daylight saving. A
 * stored instant would drift; a wall-clock time does not.
 */

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface MealReminder {
  /** Stable key, so rescheduling replaces rather than duplicates. */
  id: string;
  label: string;
  /** "HH:MM", 24-hour. */
  time: string;
  enabled: boolean;
}

export interface WeighInReminder {
  enabled: boolean;
  /** 1 = Sunday, 7 = Saturday, matching expo-notifications' weekday. */
  weekday: number;
  time: string;
}

export interface ReminderSettings {
  meals: MealReminder[];
  weighIn: WeighInReminder;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  meals: [
    { id: 'breakfast', label: 'Breakfast', time: '08:00', enabled: false },
    { id: 'lunch', label: 'Lunch', time: '13:00', enabled: false },
    { id: 'dinner', label: 'Dinner', time: '19:30', enabled: false },
  ],
  weighIn: { enabled: false, weekday: 2, time: '07:30' },
};

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? '';
}

/** Parses "HH:MM". Returns null for anything out of range or malformed. */
export function parseTimeOfDay(value: string): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatTimeOfDay(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

/**
 * Shifts a time by whole minutes, wrapping within the day.
 *
 * Used by the settings stepper, so nudging 00:00 back by 15 minutes gives
 * 23:45 rather than a negative hour.
 */
export function shiftTime(time: TimeOfDay, minutes: number): TimeOfDay {
  const total = ((time.hour * 60 + time.minute + minutes) % 1440 + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/** The reminders that should actually be scheduled, with valid times only. */
export function activeReminders(
  settings: ReminderSettings,
): { id: string; title: string; body: string; time: TimeOfDay; weekday?: number }[] {
  const scheduled: {
    id: string;
    title: string;
    body: string;
    time: TimeOfDay;
    weekday?: number;
  }[] = [];

  for (const meal of settings.meals) {
    const time = parseTimeOfDay(meal.time);
    if (!meal.enabled || !time) continue;

    scheduled.push({
      id: `meal-${meal.id}`,
      title: `Log your ${meal.label.toLowerCase()}`,
      body: 'A few taps now beats reconstructing it tonight.',
      time,
    });
  }

  const weighInTime = parseTimeOfDay(settings.weighIn.time);
  if (settings.weighIn.enabled && weighInTime) {
    scheduled.push({
      id: 'weigh-in',
      title: 'Weekly weigh-in',
      body: 'Same day, same time, before breakfast — that is what makes the trend readable.',
      time: weighInTime,
      weekday: settings.weighIn.weekday,
    });
  }

  return scheduled;
}

/**
 * Merges stored settings over the defaults.
 *
 * Settings are stored as JSON that an older build may have written, so a
 * missing meal or field must not crash the reminders screen.
 */
export function normalizeReminders(stored: Partial<ReminderSettings> | null): ReminderSettings {
  if (!stored) return DEFAULT_REMINDERS;

  const meals = DEFAULT_REMINDERS.meals.map((fallback) => {
    const found = stored.meals?.find((meal) => meal.id === fallback.id);
    return found ? { ...fallback, ...found } : fallback;
  });

  return {
    meals,
    weighIn: { ...DEFAULT_REMINDERS.weighIn, ...(stored.weighIn ?? {}) },
  };
}
