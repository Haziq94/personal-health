import { describe, expect, it } from 'vitest';

import { linePath, projectSeries, scale, verticalBounds } from '@/domain/chart';

describe('scale', () => {
  it('maps the domain onto the range linearly', () => {
    expect(scale(5, { min: 0, max: 10 }, { min: 0, max: 100 })).toBe(50);
    expect(scale(0, { min: 0, max: 10 }, { min: 0, max: 100 })).toBe(0);
    expect(scale(10, { min: 0, max: 10 }, { min: 0, max: 100 })).toBe(100);
  });

  it('handles an inverted range, as SVG needs for the y axis', () => {
    expect(scale(10, { min: 0, max: 10 }, { min: 200, max: 0 })).toBe(0);
    expect(scale(0, { min: 0, max: 10 }, { min: 200, max: 0 })).toBe(200);
  });

  it('centres a zero-width domain instead of dividing by zero', () => {
    expect(scale(80, { min: 80, max: 80 }, { min: 0, max: 100 })).toBe(50);
  });
});

describe('verticalBounds', () => {
  it('pads above and below the data', () => {
    expect(verticalBounds([70, 80], [], 0.1)).toEqual({ min: 69, max: 81 });
  });

  it('pulls extra values such as a goal line into view', () => {
    const bounds = verticalBounds([79, 80], [72], 0);
    expect(bounds.min).toBe(72);
    expect(bounds.max).toBe(80);
  });

  it('gives a flat series a usable height', () => {
    const bounds = verticalBounds([80, 80, 80], [], 0.1);
    expect(bounds.min).toBeLessThan(80);
    expect(bounds.max).toBeGreaterThan(80);
  });

  it('falls back to a unit range with no data', () => {
    expect(verticalBounds([])).toEqual({ min: 0, max: 1 });
  });
});

describe('linePath', () => {
  it('needs at least two points', () => {
    expect(linePath([])).toBe('');
    expect(linePath([{ x: 1, y: 1 }])).toBe('');
  });

  it('moves to the first point and lines to the rest', () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5, y: 0 },
      ]),
    ).toBe('M0.00 10.00 L5.00 0.00');
  });
});

describe('projectSeries', () => {
  it('inverts y so larger values sit higher on screen', () => {
    const points = projectSeries(
      [
        { x: 0, y: 70 },
        { x: 10, y: 80 },
      ],
      { min: 0, max: 10 },
      { min: 70, max: 80 },
      100,
      200,
    );

    expect(points[0]).toEqual({ x: 0, y: 200 });
    expect(points[1]).toEqual({ x: 100, y: 0 });
  });
});
