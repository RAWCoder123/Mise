import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors, inventoryStatusColors, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import {
  buildInventoryHealthAccessibilityLabel,
  getInventoryHealthPercentages,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  inventoryHealthStatusOrder,
  normalizeInventoryHealthCounts,
  type InventoryHealthCounts,
  type InventoryHealthLabels,
  type InventoryHealthLegendValueMode
} from "../../services/presentation/inventoryHealthPresentation";
import { MotionView, StateChangeView } from "./Motion";

export type { InventoryHealthCounts, InventoryHealthLabels, InventoryHealthLegendValueMode };
export {
  buildInventoryHealthAccessibilityLabel,
  getInventoryHealthPercentages,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  normalizeInventoryHealthCounts
};

export interface InventoryHealthProps {
  counts: InventoryHealthCounts;
  labels?: Partial<InventoryHealthLabels>;
  legendValueMode?: InventoryHealthLegendValueMode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const defaultLabels: InventoryHealthLabels = {
  good: "Good",
  watch: "Watch",
  low: "Low",
  critical: "Critical",
  wellStocked: "Well stocked",
  empty: "No items"
};

/** A compact, accessible health distribution that stays legible at mobile width. */
export function InventoryHealth({
  counts,
  labels: labelOverrides,
  legendValueMode = "percentage",
  accessibilityLabel,
  style
}: InventoryHealthProps) {
  const { formatNumber } = useLocale();
  const labels = { ...defaultLabels, ...labelOverrides };
  const normalizedCounts = normalizeInventoryHealthCounts(counts);
  const percentages = getInventoryHealthPercentages(normalizedCounts);
  const total = getInventoryHealthTotal(normalizedCounts);
  const wellStockedPercentage = getWellStockedPercentage(normalizedCounts);
  const formatPercent = (value: number) => formatNumber(value / 100, {
    style: "percent",
    maximumFractionDigits: 0
  });
  const resolvedAccessibilityLabel = accessibilityLabel ?? buildInventoryHealthAccessibilityLabel({
    counts: normalizedCounts,
    labels,
    formatCount: (value) => formatNumber(value),
    formatPercentage: formatPercent
  });
  const stateKey = `${normalizedCounts.good}-${normalizedCounts.watch}-${normalizedCounts.low}-${normalizedCounts.critical}`;

  return (
    <StateChangeView
      accessible
      accessibilityLabel={resolvedAccessibilityLabel}
      stateKey={stateKey}
      style={[styles.wrap, style]}
    >
      <View style={styles.scoreBlock}>
        <View style={styles.score}>
          <MotionView distance={0} duration={240} initialOpacity={0.62}>
            <HealthRing counts={normalizedCounts} />
          </MotionView>
          <View style={styles.scoreCopy} pointerEvents="none">
            <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.scoreValue}>
              {formatPercent(wellStockedPercentage)}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.scoreLabel}>
          {total === 0 ? labels.empty : labels.wellStocked}
        </Text>
      </View>
      <View style={styles.distribution}>
        <View style={styles.legend}>
          {healthSegments.map(({ key, color }) => (
            <LegendItem
              color={color}
              key={key}
              label={labels[key]}
              value={legendValueMode === "percentage"
                ? formatPercent(percentages[key])
                : formatNumber(normalizedCounts[key])}
            />
          ))}
        </View>
      </View>
    </StateChangeView>
  );
}

function HealthRing({ counts }: { counts: InventoryHealthCounts }) {
  const total = getInventoryHealthTotal(counts);
  // Keep the ring thin enough that the hole stays clear for the center % value.
  const size = 92;
  const center = size / 2;
  const strokeWidth = 7;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.panelStrong} strokeWidth={strokeWidth} />
      {total > 0
        ? healthSegments.map(({ key, color }) => {
            const value = counts[key];
            if (value === 0) return null;
            const length = (value / total) * circumference;
            const offset = consumed;
            consumed += length;
            return (
              <Circle
                key={key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })
        : null}
    </Svg>
  );
}

/** Compatibility export for secondary health visualizations. */
export function InventoryHealthBar({ counts }: { counts: InventoryHealthCounts }) {
  const normalizedCounts = normalizeInventoryHealthCounts(counts);
  const total = getInventoryHealthTotal(normalizedCounts);

  return (
    <View style={styles.bar}>
      {total === 0 ? <View style={styles.emptyBar} /> : null}
      {healthSegments.map(({ key, color }) => {
        const value = normalizedCounts[key];
        return value > 0 ? <View key={key} style={{ backgroundColor: color, flexGrow: value, flexBasis: 0 }} /> : null;
      })}
    </View>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={styles.legendLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const healthSegmentColors: Record<keyof InventoryHealthCounts, string> = {
  good: inventoryStatusColors.Good,
  watch: inventoryStatusColors.Watch,
  low: inventoryStatusColors.Low,
  critical: inventoryStatusColors.Critical
};

const healthSegments = inventoryHealthStatusOrder.map((key) => ({ key, color: healthSegmentColors[key] }));

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  scoreBlock: {
    width: 92,
    alignItems: "center",
    gap: 6
  },
  score: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center"
  },
  scoreCopy: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    // Stay inside the ring hole (radius 36, stroke 7 → inner ≈ 32.5).
    paddingHorizontal: 18
  },
  scoreValue: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.35,
    textAlign: "center"
  },
  scoreLabel: {
    color: colors.muted,
    fontFamily: typography.families.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    maxWidth: 92
  },
  distribution: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center"
  },
  bar: {
    height: 8,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.panelStrong
  },
  emptyBar: {
    flex: 1,
    backgroundColor: colors.panelStrong
  },
  legend: {
    gap: 3
  },
  legendItem: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  legendLabel: {
    flex: 1,
    color: colors.muted,
    fontFamily: typography.families.medium,
    fontSize: 11.5,
    lineHeight: 16
  },
  legendValue: {
    minWidth: 34,
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "right"
  }
});
