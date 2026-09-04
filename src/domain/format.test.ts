import { describe, expect, it } from 'vitest';

import {
  formatGrams,
  formatKcal,
  formatServings,
  mealLabel,
  parseNumber,
} from '@/domain/format';

describe('formatKcal', () => {
  it('rounds to whole calories', () => {
    expect(formatKcal(204.6)).toBe('205');
    expect(formatKcal(0)).toBe('0');
  });
});

describe('formatGrams', () => {
  it('keeps one decimal for small amounts', () => {
    expect(formatGrams(4.25)).toBe('4.3');
    expect(formatGrams(0)).toBe('0.0');
  });

  it('rounds to whole grams above ten', () => {
    expect(formatGrams(44.4)).toBe('44');
    expect(formatGrams(10)).toBe('10');
  });
});

describe('formatServings', () => {
  it('shows a whole serving without a decimal', () => {
    expect(formatServings(1)).toBe('1');
    expect(formatServings(3)).toBe('3');
  });

  it('trims a trailing zero from fractional servings', () => {
    expect(formatServings(1.5)).toBe('1.5');
    expect(formatServings(0.5)).toBe('0.5');
  });

  it('keeps two decimals when both are significant', () => {
    expect(formatServings(1.25)).toBe('1.25');
  });
});

describe('parseNumber', () => {
  it('parses plain numbers', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber(' 3.5 ')).toBe(3.5);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseNumber('3,5')).toBe(3.5);
  });

  it('distinguishes zero from empty', () => {
    expect(parseNumber('0')).toBe(0);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
  });

  it('rejects text', () => {
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12kg')).toBeNull();
  });
});

describe('mealLabel', () => {
  it('labels snacks in the plural, as the section heading', () => {
    expect(mealLabel('snack')).toBe('Snacks');
    expect(mealLabel('breakfast')).toBe('Breakfast');
  });
});
