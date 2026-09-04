import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { linePath, projectSeries, scale, verticalBounds } from '@/domain/chart';
import type { TrendPoint } from '@/domain/weight';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 180;

type WeightChartProps = {
  points: readonly TrendPoint[];
  /** Drawn as a dashed line and forced into view when set. */
  targetKg?: number | null;
};

/**
 * Raw weigh-ins as faint dots, the smoothed trend as a solid line.
 *
 * The trend line is the one that reads as "your weight" — daily readings swing
 * on water alone — but the dots stay visible so a genuine jump is not hidden by
 * the smoothing.
 */
export function WeightChart({ points, targetKg }: WeightChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  if (points.length < 2) {
    return (
      <View style={styles.empty} onLayout={onLayout}>
        <ThemedText type="small" themeColor="textSecondary">
          Log at least two weigh-ins to see a trend.
        </ThemedText>
      </View>
    );
  }

  const xDomain = {
    min: points[0].loggedAt,
    max: points[points.length - 1].loggedAt,
  };
  const yDomain = verticalBounds(
    points.flatMap((point) => [point.weightKg, point.averageKg]),
    targetKg == null ? [] : [targetKg],
  );

  const raw = projectSeries(
    points.map((point) => ({ x: point.loggedAt, y: point.weightKg })),
    xDomain,
    yDomain,
    width,
    HEIGHT,
  );
  const trend = projectSeries(
    points.map((point) => ({ x: point.loggedAt, y: point.averageKg })),
    xDomain,
    yDomain,
    width,
    HEIGHT,
  );

  const targetY =
    targetKg == null
      ? null
      : scale(targetKg, yDomain, { min: HEIGHT, max: 0 });

  return (
    <View onLayout={onLayout} style={styles.chart}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {targetY !== null ? (
            <Line
              x1={0}
              y1={targetY}
              x2={width}
              y2={targetY}
              stroke={theme.tint}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}

          {raw.map((point, index) => (
            <Circle
              key={points[index].loggedAt}
              cx={point.x}
              cy={point.y}
              r={2.5}
              fill={theme.textSecondary}
              opacity={0.45}
            />
          ))}

          <Path
            d={linePath(trend)}
            stroke={theme.text}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: HEIGHT, width: '100%' },
  empty: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
});
