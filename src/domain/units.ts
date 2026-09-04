/**
 * Conversions between stored metric values and the user's display units.
 *
 * Storage is always metric. Nothing outside this module and the UI should deal
 * in pounds or fluid ounces.
 */

import type { HeightUnit, VolumeUnit, WeightUnit } from '@/domain/types';

export const KG_PER_LB = 0.45359237;
/** US fluid ounce. */
export const ML_PER_FLOZ = 29.5735295625;
export const CM_PER_IN = 2.54;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function mlToUnit(ml: number, unit: VolumeUnit): number {
  return unit === 'ml' ? ml : ml / ML_PER_FLOZ;
}

export function unitToMl(value: number, unit: VolumeUnit): number {
  return unit === 'ml' ? value : value * ML_PER_FLOZ;
}

export function cmToUnit(cm: number, unit: HeightUnit): number {
  return unit === 'cm' ? cm : cm / CM_PER_IN;
}

export function unitToCm(value: number, unit: HeightUnit): number {
  return unit === 'cm' ? value : value * CM_PER_IN;
}

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  return `${kgToUnit(kg, unit).toFixed(digits)} ${unit}`;
}

export function formatVolume(ml: number, unit: VolumeUnit): string {
  const value = mlToUnit(ml, unit);
  return unit === 'ml' ? `${Math.round(value)} ml` : `${value.toFixed(1)} fl oz`;
}
