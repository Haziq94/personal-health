import { describe, expect, it } from 'vitest';

import { defaultMealFor } from '@/domain/meals';

function at(hour: number, minute = 30): number {
  return new Date(2026, 3, 12, hour, minute).getTime();
}

describe('defaultMealFor', () => {
  it('picks the meal matching the time of day', () => {
    expect(defaultMealFor(at(7))).toBe('breakfast');
    expect(defaultMealFor(at(12))).toBe('lunch');
    expect(defaultMealFor(at(19))).toBe('dinner');
    expect(defaultMealFor(at(23))).toBe('snack');
  });

  it('switches at the boundaries', () => {
    expect(defaultMealFor(at(10, 59))).toBe('breakfast');
    expect(defaultMealFor(at(11, 0))).toBe('lunch');
    expect(defaultMealFor(at(14, 59))).toBe('lunch');
    expect(defaultMealFor(at(15, 0))).toBe('dinner');
    expect(defaultMealFor(at(21, 0))).toBe('snack');
  });

  it('treats the small hours as a snack, not an early breakfast', () => {
    expect(defaultMealFor(at(1))).toBe('snack');
    expect(defaultMealFor(at(3, 59))).toBe('snack');
    expect(defaultMealFor(at(4, 0))).toBe('breakfast');
  });
});
