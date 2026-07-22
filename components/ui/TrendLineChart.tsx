import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Line as SvgLine, Stop } from "react-native-svg";

import { colors, typography } from "../../constants/theme";

export interface TrendLineSeries {
  /** Values aligned index-for-index with `labels`. Non-finite entries are skipped. */
  values: readonly number[];
  color?: string;
  /** Dashed rendering for comparison series (e.g. "last week"). */
  dashed?: boolean;
}

export interface TrendLineChartProps {
  /** First series is the primary one: it gets the endpoint dot and area fill. */
  series: readonly TrendLineSeries[];
  /** Shared x-axis labels, oldest to newest. */
  labels: readonly string[];
  /** Index whose label is emphasized (defaults to the last point). */
  highlightIndex?: number;
  height?: number;
  /** Soft gradient fill under the primary series. */
  showArea?: boolean;
  /** Formats y-axis gridline values (e.g. compact currency). */
  formatValue?: (value: number) => string;
  /** Spoken summary of the chart; the drawing itself is hidden from a11y. */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

const PLOT_TOP = 6;
const LABEL_GAP = 6;

/**
 * Dependency-free SVG line chart for short operational trends (~4–14 points).
 * Supports a dashed comparison series and a gradient area under the primary
 * series. Not a general charting tool: no axes ticks beyond 3 gridlines, no
 * panning, no tooltips — keep it scannable.
 */
export function TrendLineChart({
  series,
  labels,
  highlightIndex,
  height = 132,
  showArea = false,
  formatValue,
  accessibilityLabel,
  style
}: TrendLineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) setWidth(nextWidth);
  };

  const pointCount = labels.length;
  const primary = series[0];
  const emphasizedIndex = highlightIndex ?? pointCount - 1;

  const allValues = series.flatMap((entry) => entry.values.filter((value) => Number.isFinite(value)));
  const maxValue = Math.max(1, ...allValues);
  // 8% headroom keeps the peak (and its endpoint dot) off the plot ceiling.
  const scaleMax = maxValue * 1.08;
  const plotHeight = height - PLOT_TOP;

  // Inset the endpoint so the highlight dot is not clipped by the svg bounds.
  const drawWidth = Math.max(1, width - 8);
  const xAt = (index: number) =>
    pointCount <= 1 ? width / 2 : (index / (pointCount - 1)) * drawWidth;
  const yAt = (value: number) =>
    PLOT_TOP + plotHeight - (Math.max(0, value) / scaleMax) * plotHeight;

  const gridValues = [maxValue, maxValue / 2];

  const canDraw = width > 0 && pointCount > 0 && allValues.length > 0;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={style}>
      <View importantForAccessibility="no-hide-descendants" onLayout={onLayout} style={{ height }}>
        {canDraw ? (
          <Svg width={width} height={height}>
            {showArea && primary ? (
              <Defs>
                <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={primary.color ?? colors.accent} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={primary.color ?? colors.accent} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
            ) : null}

            {gridValues.map((value) => (
              <SvgLine
                key={`grid-${value}`}
                x1={0}
                y1={yAt(value)}
                x2={width}
                y2={yAt(value)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            <SvgLine x1={0} y1={yAt(0)} x2={width} y2={yAt(0)} stroke={colors.borderStrong} strokeWidth={1} />

            {showArea && primary ? (
              <Path d={areaPath(primary.values, xAt, yAt)} fill="url(#trendArea)" />
            ) : null}

            {[...series].reverse().map((entry, reversedIndex) => {
              const isPrimary = reversedIndex === series.length - 1;
              return (
                <Path
                  key={`series-${series.length - 1 - reversedIndex}`}
                  d={linePath(entry.values, xAt, yAt)}
                  fill="none"
                  stroke={entry.color ?? (isPrimary ? colors.accent : colors.borderStrong)}
                  strokeWidth={isPrimary ? 2.2 : 1.8}
                  strokeDasharray={entry.dashed ? "5 5" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {primary && Number.isFinite(primary.values[emphasizedIndex] ?? NaN) ? (
              <>
                <Circle
                  cx={xAt(emphasizedIndex)}
                  cy={yAt(primary.values[emphasizedIndex]!)}
                  r={5.5}
                  fill={colors.surface}
                  stroke={primary.color ?? colors.accent}
                  strokeWidth={2.2}
                />
                <Circle
                  cx={xAt(emphasizedIndex)}
                  cy={yAt(primary.values[emphasizedIndex]!)}
                  r={2.4}
                  fill={primary.color ?? colors.accent}
                />
              </>
            ) : null}
          </Svg>
        ) : null}

        {canDraw && formatValue ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {gridValues.map((value) => (
              <Text
                key={`gridlabel-${value}`}
                style={[styles.gridLabel, { top: Math.max(0, yAt(value) - 15) }]}
              >
                {formatValue(value)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View importantForAccessibility="no-hide-descendants" style={[styles.labelRow, { marginTop: LABEL_GAP }]}>
        {labels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            numberOfLines={1}
            style={[styles.label, index === emphasizedIndex && styles.labelEmphasized]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type Scale = (input: number) => number;

function linePath(values: readonly number[], xAt: Scale, yAt: Scale) {
  let path = "";
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const command = path === "" ? "M" : "L";
    path += `${command}${round(xAt(index))} ${round(yAt(value))} `;
  });
  return path.trim();
}

function areaPath(values: readonly number[], xAt: Scale, yAt: Scale) {
  const finiteIndexes = values
    .map((value, index) => (Number.isFinite(value) ? index : -1))
    .filter((index) => index >= 0);
  const first = finiteIndexes[0];
  const last = finiteIndexes.at(-1);
  if (first === undefined || last === undefined) return "";
  const top = linePath(values, xAt, yAt);
  return `${top} L${round(xAt(last))} ${round(yAt(0))} L${round(xAt(first))} ${round(yAt(0))} Z`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

const styles = StyleSheet.create({
  gridLabel: {
    position: "absolute",
    right: 0,
    color: colors.faint,
    fontFamily: typography.families.semibold,
    fontSize: 10,
    lineHeight: 14
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    ...typography.caption
  },
  labelEmphasized: {
    color: colors.text,
    fontFamily: typography.families.bold
  }
});
