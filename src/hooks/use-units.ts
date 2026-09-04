import { useDbQuery } from '@/db/query';
import * as settingsRepo from '@/db/repositories/settings';
import { DEFAULT_UNITS, type UnitPreferences } from '@/domain/types';

/**
 * The user's display units, falling back to metric while the setting loads so
 * no screen has to render a "units unknown" state.
 */
export function useUnits(): UnitPreferences {
  const query = useDbQuery((db) => settingsRepo.getUnits(db), []);
  return query.data ?? DEFAULT_UNITS;
}
