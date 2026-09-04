import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REMINDERS,
  activeReminders,
  formatTimeOfDay,
  normalizeReminders,
  parseTimeOfDay,
  shiftTime,
  weekdayLabel,
  type ReminderSettings,
} from '@/domain/reminders';

describe('parseTimeOfDay', () => {
  it('parses a 24-hour time', () => {
    expect(parseTimeOfDay('08:00')).toEqual({ hour: 8, minute: 0 });
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay('7:05')).toEqual({ hour: 7, minute: 5 });
  });

  it('rejects out-of-range values', () => {
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('12:60')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseTimeOfDay('')).toBeNull();
    expect(parseTimeOfDay('8am')).toBeNull();
    expect(parseTimeOfDay('08:0')).toBeNull();
  });
});

describe('formatTimeOfDay', () => {
  it('pads to HH:MM', () => {
    expect(formatTimeOfDay({ hour: 7, minute: 5 })).toBe('07:05');
    expect(formatTimeOfDay({ hour: 0, minute: 0 })).toBe('00:00');
  });

  it('round-trips through the parser', () => {
    const time = { hour: 19, minute: 30 };
    expect(parseTimeOfDay(formatTimeOfDay(time))).toEqual(time);
  });
});

describe('shiftTime', () => {
  it('moves forward and back within the day', () => {
    expect(shiftTime({ hour: 8, minute: 0 }, 15)).toEqual({ hour: 8, minute: 15 });
    expect(shiftTime({ hour: 8, minute: 0 }, -15)).toEqual({ hour: 7, minute: 45 });
  });

  it('wraps at midnight in both directions', () => {
    expect(shiftTime({ hour: 0, minute: 0 }, -15)).toEqual({ hour: 23, minute: 45 });
    expect(shiftTime({ hour: 23, minute: 45 }, 30)).toEqual({ hour: 0, minute: 15 });
  });
});

describe('activeReminders', () => {
  it('schedules nothing while everything is off', () => {
    expect(activeReminders(DEFAULT_REMINDERS)).toEqual([]);
  });

  it('schedules only the enabled meals', () => {
    const settings: ReminderSettings = {
      ...DEFAULT_REMINDERS,
      meals: DEFAULT_REMINDERS.meals.map((meal) => ({
        ...meal,
        enabled: meal.id === 'lunch',
      })),
    };

    const active = activeReminders(settings);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('meal-lunch');
    expect(active[0].time).toEqual({ hour: 13, minute: 0 });
    expect(active[0].weekday).toBeUndefined();
  });

  it('carries the weekday for the weigh-in only', () => {
    const settings: ReminderSettings = {
      ...DEFAULT_REMINDERS,
      weighIn: { enabled: true, weekday: 2, time: '07:30' },
    };

    const [weighIn] = activeReminders(settings);
    expect(weighIn.id).toBe('weigh-in');
    expect(weighIn.weekday).toBe(2);
  });

  it('skips an enabled reminder whose time is unparseable', () => {
    const settings: ReminderSettings = {
      ...DEFAULT_REMINDERS,
      meals: [{ id: 'lunch', label: 'Lunch', time: 'noon', enabled: true }],
    };

    expect(activeReminders(settings)).toEqual([]);
  });
});

describe('normalizeReminders', () => {
  it('falls back to the defaults when nothing is stored', () => {
    expect(normalizeReminders(null)).toEqual(DEFAULT_REMINDERS);
  });

  it('fills in a meal an older build never wrote', () => {
    const normalized = normalizeReminders({
      meals: [{ id: 'lunch', label: 'Lunch', time: '12:30', enabled: true }],
    });

    expect(normalized.meals).toHaveLength(3);
    expect(normalized.meals.find((m) => m.id === 'lunch')?.time).toBe('12:30');
    expect(normalized.meals.find((m) => m.id === 'dinner')?.enabled).toBe(false);
  });

  it('keeps the default weigh-in fields that are missing', () => {
    const normalized = normalizeReminders({ weighIn: { enabled: true } as never });

    expect(normalized.weighIn.enabled).toBe(true);
    expect(normalized.weighIn.time).toBe('07:30');
  });
});

describe('weekdayLabel', () => {
  it('maps the 1-indexed weekday used by the scheduler', () => {
    expect(weekdayLabel(1)).toBe('Sunday');
    expect(weekdayLabel(2)).toBe('Monday');
    expect(weekdayLabel(7)).toBe('Saturday');
  });

  it('is empty for an out-of-range weekday rather than undefined', () => {
    expect(weekdayLabel(0)).toBe('');
    expect(weekdayLabel(8)).toBe('');
  });
});
