import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { colors, fontFamilies, typography } from "../../constants/theme";

export interface DonutChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: readonly DonutChartSlice[];
  /** Center label (e.g. "Mix"). */
  centerLabel?: string;
  /** Optional center value string already formatted. */
  centerValue?: string;
  size?: number;
  strokeWidth?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  showLegend?: boolean;
}

const DEFAULT_PALETTE = [
  colors.accent,
  colors.success,
  colors.caution,
  colors.warning,
  colors.text,
  colors.faint,
  colors.accentDark,
  colors.successSoft
] as const;

/**
 * Dependency-free SVG donut for short categorical mixes (≤8 slices).
 * Keep labels in the legend — the ring itself stays decoration for scanability.
 */
export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 148,
  strokeWidth = 22,
  accessibilityLabel,
  style,
  showLegend = true
}: DonutChartProps) {
  const positive = slices.filter((slice) => Number.isFinite(slice.value) && slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={style}>
      <View importantForAccessibility="no-hide-descendants" style={styles.row}>
        <View style={[styles.chartWrap, { width: size, height: size }]}>
          {total > 0 ? (
            <Svg width={size} height={size}>
              <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={colors.panelStrong}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                {positive.map((slice, index) => {
                  const length = (slice.value / total) * circumference;
                  const dashOffset = -offset;
                  offset += length;
                  return (
                    <Circle
                      key={`${slice.label}-${index}`}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke={slice.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="butt"
                      fill="none"
                    />
                  );
                })}
              </G>
            </Svg>
          ) : (
            <Svg width={size} height={size}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.panelStrong}
                strokeWidth={strokeWidth}
                fill="none"
              />
            </Svg>
          )}
          {(centerLabel || centerValue) && (
            <View style={styles.center} pointerEvents="none">
              {centerValue ? <Text style={styles.centerValue}>{centerValue}</Text> : null}
              {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
            </View>
          )}
        </View>

        {showLegend ? (
          <View style={styles.legend}>
            {positive.length === 0 ? (
              <Text style={styles.legendEmpty}>—</Text>
            ) : (
              positive.map((slice, index) => {
                const share = total > 0 ? slice.value / total : 0;
                return (
                  <View key={`${slice.label}-${index}`} style={styles.legendRow}>
                    <View style={[styles.swatch, { backgroundColor: slice.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {slice.label}
                    </Text>
                    <Text style={styles.legendShare}>{formatShare(share)}</Text>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function donutPaletteColor(index: number): string {
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]!;
}

function formatShare(share: number) {
  return `${Math.round(share * 100)}%`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  chartWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  centerValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
    textAlign: "center"
  },
  centerLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    textAlign: "center"
  },
  legend: {
    flex: 1,
    minWidth: 0,
    gap: 8
  },
  legendEmpty: {
    color: colors.faint,
    ...typography.caption
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3
  },
  legendLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 17
  },
  legendShare: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 16
  }
});
