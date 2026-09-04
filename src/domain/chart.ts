/**
 * Chart geometry.
 *
 * Kept separate from the SVG component so the maths — which is where an
 * off-by-one flips a line upside down — can be tested without rendering.
 */

export interface Range {
  min: number;
  max: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Maps a value from `domain` onto `range`.
 *
 * A zero-width domain (every reading identical, or a single reading) maps to
 * the middle of the range rather than dividing by zero, so a flat series draws
 * as a centred horizontal line.
 */
export function scale(value: number, domain: Range, range: Range): number {
  const span = domain.max - domain.min;
  if (span === 0) return (range.min + range.max) / 2;

  const ratio = (value - domain.min) / span;
  return range.min + ratio * (range.max - range.min);
}

/**
 * Vertical bounds for a weight series, padded so the line does not touch the
 * edges. `include` forces extra values (such as a goal line) into view.
 */
export function verticalBounds(
  values: readonly number[],
  include: readonly number[] = [],
  paddingRatio = 0.1,
): Range {
  const all = [...values, ...include];
  if (all.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...all);
  const max = Math.max(...all);

  // A perfectly flat series would otherwise have no height to pad.
  const span = max - min || 1;
  const padding = span * paddingRatio;

  return { min: min - padding, max: max + padding };
}

/** An SVG polyline path. Returns an empty string for fewer than two points. */
export function linePath(points: readonly Point[]): string {
  if (points.length < 2) return '';

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Projects a series onto pixel coordinates.
 *
 * The y range is inverted on purpose: SVG measures downward, so the largest
 * value must map to the smallest y.
 */
export function projectSeries(
  series: readonly { x: number; y: number }[],
  xDomain: Range,
  yDomain: Range,
  width: number,
  height: number,
): Point[] {
  return series.map((item) => ({
    x: scale(item.x, xDomain, { min: 0, max: width }),
    y: scale(item.y, yDomain, { min: height, max: 0 }),
  }));
}
