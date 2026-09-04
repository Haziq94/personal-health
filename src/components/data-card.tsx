import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { pickTextFile, writeAndShare } from '@/backup/files';
import { exportBackup, importBackup, type ImportMode } from '@/db/backup';
import { useDatabase, useDataVersion } from '@/db/provider';
import { useDbQuery } from '@/db/query';
import * as foodEntriesRepo from '@/db/repositories/food-entries';
import * as weightRepo from '@/db/repositories/weight';
import { backupCounts, backupFilename, parseBackup, type BackupFile } from '@/domain/backup';
import { foodEntriesCsv, weightEntriesCsv } from '@/domain/exports';
import { useUnits } from '@/hooks/use-units';

const JSON_MIME = 'application/json';
const CSV_MIME = 'text/csv';

export function DataCard() {
  const db = useDatabase();
  const { invalidate } = useDataVersion();
  const units = useUnits();

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useDbQuery(async (driver) => {
    const backup = await exportBackup(driver);
    return backupCounts(backup);
  }, []);

  async function run(task: () => Promise<string>) {
    setBusy(true);
    try {
      setStatus(await task());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    void run(async () => {
      const backup = await exportBackup(db);
      const filename = backupFilename();
      const outcome = await writeAndShare(filename, JSON.stringify(backup), JSON_MIME);

      return outcome === 'shared'
        ? `Exported ${filename}.`
        : 'Sharing is not available on this device.';
    });
  }

  function exportFoodCsv() {
    void run(async () => {
      // Everything, not a window: an export that silently truncates is worse
      // than no export.
      const entries = await foodEntriesRepo.listEntriesBetween(db, 0, Date.now() + 1);
      const outcome = await writeAndShare(
        'personal-health-food-log.csv',
        foodEntriesCsv(entries),
        CSV_MIME,
      );

      return outcome === 'shared'
        ? `Exported ${entries.length} entries.`
        : 'Sharing is not available on this device.';
    });
  }

  function exportWeightCsv() {
    void run(async () => {
      const entries = await weightRepo.listWeights(db);
      const outcome = await writeAndShare(
        'personal-health-weight.csv',
        weightEntriesCsv(entries, units.weight),
        CSV_MIME,
      );

      return outcome === 'shared'
        ? `Exported ${entries.length} weigh-ins.`
        : 'Sharing is not available on this device.';
    });
  }

  function startImport() {
    void run(async () => {
      const picked = await pickTextFile(JSON_MIME);
      if (!picked) return 'Import cancelled.';

      const parsed = parseBackup(picked.contents);
      if (!parsed.ok) return parsed.error;

      confirmImport(parsed.backup);
      return `Read ${picked.name}.`;
    });
  }

  function confirmImport(backup: BackupFile) {
    const summary = backupCounts(backup);
    const detail =
      `${summary.foods} foods, ${summary.entries} entries, ` +
      `${summary.weighIns} weigh-ins, ${summary.water} water, ${summary.goals} goals.`;

    Alert.alert('Import this backup?', detail, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () => void apply(backup, 'merge'),
      },
      {
        text: 'Replace all',
        style: 'destructive',
        onPress: () => confirmReplace(backup),
      },
    ]);
  }

  /**
   * Replace wipes existing data, so it is confirmed twice. The second prompt
   * says what is lost rather than repeating the question.
   */
  function confirmReplace(backup: BackupFile) {
    Alert.alert(
      'Delete everything first?',
      'Every food, entry, weigh-in and goal currently on this device will be removed and replaced by the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => void apply(backup, 'replace'),
        },
      ],
    );
  }

  async function apply(backup: BackupFile, mode: ImportMode) {
    await run(async () => {
      const result = await importBackup(db, backup, mode);
      invalidate();

      return mode === 'merge'
        ? `Imported ${result.inserted} new records, skipped ${result.skipped} already present.`
        : `Replaced everything with ${result.inserted} records.`;
    });
  }

  return (
    <Card title="Your data">
      <ThemedText type="small" themeColor="textSecondary">
        {counts.data
          ? `${counts.data.foods} foods · ${counts.data.entries} entries · ${counts.data.weighIns} weigh-ins`
          : ' '}
      </ThemedText>

      <View style={styles.actions}>
        <Button label="Export backup (JSON)" onPress={exportJson} disabled={busy} />
        <Button
          label="Export food log (CSV)"
          variant="secondary"
          onPress={exportFoodCsv}
          disabled={busy}
        />
        <Button
          label="Export weigh-ins (CSV)"
          variant="secondary"
          onPress={exportWeightCsv}
          disabled={busy}
        />
        <Button
          label="Import backup"
          variant="secondary"
          onPress={startImport}
          disabled={busy}
        />
      </View>

      {status ? (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        The JSON backup is the complete copy — keep one somewhere off this phone. The CSV
        files are for reading in a spreadsheet and cannot be imported back.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two, marginTop: Spacing.one },
});
