import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDbMutation, useDbQuery } from '@/db/query';
import * as settingsRepo from '@/db/repositories/settings';
import {
  DEFAULT_REMINDERS,
  formatTimeOfDay,
  normalizeReminders,
  parseTimeOfDay,
  shiftTime,
  weekdayLabel,
  type ReminderSettings,
} from '@/domain/reminders';
import { useTheme } from '@/hooks/use-theme';
import {
  remindersAvailability,
  requestPermission,
  syncReminders,
} from '@/notifications/schedule';

const STEP_MINUTES = 15;

export function RemindersCard() {
  const theme = useTheme();
  const mutate = useDbMutation();

  const stored = useDbQuery(
    (db) =>
      settingsRepo.getSetting<Partial<ReminderSettings> | null>(
        db,
        settingsRepo.SETTING_KEYS.reminders,
        null,
      ),
    [],
  );

  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [denied, setDenied] = useState(false);
  const unavailable = remindersAvailability() !== 'available';

  useEffect(() => {
    if (!settings && !stored.loading) setSettings(normalizeReminders(stored.data));
  }, [settings, stored.loading, stored.data]);

  const current = settings ?? DEFAULT_REMINDERS;
  const anyEnabled =
    current.meals.some((meal) => meal.enabled) || current.weighIn.enabled;

  /**
   * Persist and reschedule together. Permission is only requested when
   * something is actually being turned on — asking on a screen the user is
   * merely browsing is how people end up denying it outright.
   */
  async function apply(next: ReminderSettings) {
    setSettings(next);

    const wants =
      next.meals.some((meal) => meal.enabled) || next.weighIn.enabled;

    if (wants) {
      const outcome = await requestPermission();
      if (outcome === 'denied' || outcome === 'unavailable') {
        setDenied(outcome === 'denied');
        await mutate((db) =>
          settingsRepo.setSetting(db, settingsRepo.SETTING_KEYS.reminders, next),
        );
        return;
      }
      setDenied(false);
    }

    await mutate((db) =>
      settingsRepo.setSetting(db, settingsRepo.SETTING_KEYS.reminders, next),
    );
    await syncReminders(next);
  }

  function setMeal(id: string, patch: { enabled?: boolean; time?: string }) {
    void apply({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === id ? { ...meal, ...patch } : meal,
      ),
    });
  }

  function nudge(time: string, minutes: number): string {
    const parsed = parseTimeOfDay(time);
    return parsed ? formatTimeOfDay(shiftTime(parsed, minutes)) : time;
  }

  return (
    <Card title="Reminders">
      {current.meals.map((meal) => (
        <View key={meal.id} style={styles.row}>
          <View style={styles.label}>
            <ThemedText type="small">{meal.label}</ThemedText>
            {meal.enabled ? (
              <TimeStepper
                value={meal.time}
                onChange={(time) => setMeal(meal.id, { time })}
                nudge={nudge}
              />
            ) : null}
          </View>
          <Switch
            value={meal.enabled}
            onValueChange={(enabled) => setMeal(meal.id, { enabled })}
            trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
          />
        </View>
      ))}

      <View style={[styles.row, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.label}>
          <ThemedText type="small">
            Weigh-in ({weekdayLabel(current.weighIn.weekday)})
          </ThemedText>
          {current.weighIn.enabled ? (
            <TimeStepper
              value={current.weighIn.time}
              onChange={(time) =>
                void apply({ ...current, weighIn: { ...current.weighIn, time } })
              }
              nudge={nudge}
            />
          ) : null}
        </View>
        <Switch
          value={current.weighIn.enabled}
          onValueChange={(enabled) =>
            void apply({ ...current, weighIn: { ...current.weighIn, enabled } })
          }
          trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
        />
      </View>

      {unavailable ? (
        <ThemedText type="small" themeColor="textSecondary">
          Reminders need a development build — Expo Go cannot deliver them. Your choices
          here are saved and will start working once you build the app.
        </ThemedText>
      ) : denied ? (
        <ThemedText type="small" themeColor="danger">
          Notifications are turned off for this app. The settings are saved, but nothing
          will be delivered until you allow notifications in your device settings.
        </ThemedText>
      ) : anyEnabled ? (
        <ThemedText type="small" themeColor="textSecondary">
          Reminders are local to this device — no account, no server.
        </ThemedText>
      ) : null}
    </Card>
  );
}

function TimeStepper({
  value,
  onChange,
  nudge,
}: {
  value: string;
  onChange: (time: string) => void;
  nudge: (time: string, minutes: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <StepButton label="−" onPress={() => onChange(nudge(value, -STEP_MINUTES))} />
      <ThemedText type="smallBold" style={styles.time}>
        {value}
      </ThemedText>
      <StepButton label="+" onPress={() => onChange(nudge(value, STEP_MINUTES))} />
    </View>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Later' : 'Earlier'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: theme.border,
          backgroundColor: theme.background,
          opacity: pressed ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  label: { flex: 1, gap: Spacing.one },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  time: { minWidth: 44, textAlign: 'center' },
});
