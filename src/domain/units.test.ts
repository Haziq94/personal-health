import { describe, expect, it } from 'vitest';

import {
  KG_PER_LB,
  cmToUnit,
  formatVolume,
  formatWeight,
  kgToUnit,
  mlToUnit,
  unitToCm,
  unitToKg,
  unitToMl,
} from '@/domain/units';

describe('weight conversion', () => {
  it('leaves metric values untouched', () => {
    expect(kgToUnit(72.5, 'kg')).toBe(72.5);
    expect(unitToKg(72.5, 'kg')).toBe(72.5);
  });

  it('converts pounds using the international definition', () => {
    expect(unitToKg(1, 'lb')).toBeCloseTo(KG_PER_LB, 10);
    expect(kgToUnit(1, 'lb')).toBeCloseTo(2.2046226, 6);
  });

  it('round-trips without drift', () => {
    expect(kgToUnit(unitToKg(180.4, 'lb'), 'lb')).toBeCloseTo(180.4, 10);
  });

  it('formats with the unit suffix', () => {
    expect(formatWeight(72.46, 'kg')).toBe('72.5 kg');
    expect(formatWeight(100, 'lb', 0)).toBe('220 lb');
  });
});

describe('volume conversion', () => {
  it('converts US fluid ounces', () => {
    expect(unitToMl(1, 'floz')).toBeCloseTo(29.5735295625, 10);
    expect(mlToUnit(500, 'floz')).toBeCloseTo(16.907, 3);
  });

  it('formats millilitres as whole numbers', () => {
    expect(formatVolume(499.6, 'ml')).toBe('500 ml');
    expect(formatVolume(500, 'floz')).toBe('16.9 fl oz');
  });
});

describe('height conversion', () => {
  it('converts inches', () => {
    expect(unitToCm(70, 'in')).toBeCloseTo(177.8, 10);
    expect(cmToUnit(177.8, 'in')).toBeCloseTo(70, 10);
  });
});
