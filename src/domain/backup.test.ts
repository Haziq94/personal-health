import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupCounts,
  backupFilename,
  buildBackup,
  parseBackup,
  type BackupData,
} from '@/domain/backup';
import type { Macros } from '@/domain/types';

const macros: Macros = { kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 };
const NOW = new Date(2026, 8, 4, 12).getTime();

function sampleData(): BackupData {
  return {
    foods: [
      {
        id: 'f1',
        name: 'Rice',
        brand: null,
        servingLabel: '1 bowl',
        servingGrams: 150,
        perServing: macros,
        isFavorite: false,
        createdAt: NOW,
      },
    ],
    foodEntries: [
      {
        id: 'e1',
        foodId: 'f1',
        name: 'Rice',
        loggedAt: NOW,
        meal: 'lunch',
        servings: 1,
        perServing: macros,
      },
    ],
    weightEntries: [{ id: 'w1', loggedAt: NOW, weightKg: 80, note: null }],
    waterEntries: [{ id: 'h1', loggedAt: NOW, volumeMl: 250 }],
    goals: [
      {
        id: 'g1',
        effectiveFrom: NOW,
        daily: { kcal: 2200, proteinG: 165, carbsG: 220, fatG: 73 },
        dailyWaterMl: 2000,
        targetWeightKg: 75,
        targetDate: null,
      },
    ],
    settings: { profile: null, units: null, reminders: null },
  };
}

function serialize(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...buildBackup(sampleData(), 1, NOW), ...overrides });
}

describe('buildBackup', () => {
  it('stamps the envelope', () => {
    const backup = buildBackup(sampleData(), 3, NOW);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.schemaVersion).toBe(3);
    expect(backup.exportedAt).toBe(NOW);
  });
});

describe('backupCounts', () => {
  it('counts each collection', () => {
    expect(backupCounts(buildBackup(sampleData(), 1, NOW))).toEqual({
      foods: 1,
      entries: 1,
      weighIns: 1,
      water: 1,
      goals: 1,
    });
  });
});

describe('parseBackup', () => {
  it('round-trips a backup it produced', () => {
    const result = parseBackup(serialize());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data.foods[0].name).toBe('Rice');
    expect(result.backup.data.foodEntries[0].meal).toBe('lunch');
    expect(result.backup.data.goals[0].targetWeightKg).toBe(75);
  });

  it('rejects text that is not JSON', () => {
    const result = parseBackup('not json at all');
    expect(result).toEqual({ ok: false, error: 'That file is not valid JSON.' });
  });

  it('rejects JSON that is not an object', () => {
    expect(parseBackup('[1,2,3]').ok).toBe(false);
    expect(parseBackup('"hello"').ok).toBe(false);
  });

  it('rejects a file from a different app', () => {
    const result = parseBackup(JSON.stringify({ format: 'something-else', data: {} }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not a Personal Health backup/);
  });

  it('refuses a backup from a newer app version', () => {
    const result = parseBackup(serialize({ version: BACKUP_VERSION + 1 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/newer version/);
  });

  it('reports which record is malformed', () => {
    const backup = buildBackup(sampleData(), 1, NOW);
    const broken = JSON.parse(JSON.stringify(backup));
    broken.data.foods[0].kcal = 'lots';
    delete broken.data.foods[0].perServing;

    const result = parseBackup(JSON.stringify(broken));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('foods[0] is not a valid record.');
  });

  it('rejects an entry with a meal the app does not know', () => {
    const broken = JSON.parse(serialize());
    broken.data.foodEntries[0].meal = 'brunch';

    const result = parseBackup(JSON.stringify(broken));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('foodEntries[0] is not a valid record.');
  });

  it('rejects a weight that is not a finite number', () => {
    const broken = JSON.parse(serialize());
    broken.data.weightEntries[0].weightKg = null;

    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it('rejects a missing collection rather than importing nothing silently', () => {
    const broken = JSON.parse(serialize());
    delete broken.data.weightEntries;

    const result = parseBackup(JSON.stringify(broken));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/weightEntries/);
  });

  it('accepts a backup with empty collections', () => {
    const empty = buildBackup(
      {
        foods: [],
        foodEntries: [],
        weightEntries: [],
        waterEntries: [],
        goals: [],
        settings: { profile: null, units: null, reminders: null },
      },
      1,
      NOW,
    );

    expect(parseBackup(JSON.stringify(empty)).ok).toBe(true);
  });

  it('tolerates a missing settings section', () => {
    const withoutSettings = JSON.parse(serialize());
    delete withoutSettings.data.settings;

    const result = parseBackup(JSON.stringify(withoutSettings));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data.settings.profile).toBeNull();
  });
});

describe('backupFilename', () => {
  it('is dated and sortable', () => {
    expect(backupFilename(new Date(2026, 0, 5).getTime())).toBe(
      'personal-health-2026-01-05.json',
    );
  });
});
