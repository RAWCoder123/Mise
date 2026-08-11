import { useMemo } from "react";
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

const RING_SIZE = 104;
const RING_STROKE = 9;
const RING_RADIUS = 40;
/** Visual gap between colored arcs along the circumference (px). */
const SEGMENT_GAP = 3.5;

/** A compact, accessible health distribution that stays legible at mobile width. */
export function InventoryHealth({
  counts,
  labels: labelOverrides,
  legendValueMode = "count",
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
  const goodCount = normalizedCounts.good;

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
            <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.scoreValue}>
              {formatPercent(wellStockedPercentage)}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.scoreLabel}>
          {total === 0
            ? labels.empty
            : `${formatNumber(goodCount)} ${labels.good.toLocaleLowerCase()}`}
        </Text>
      </View>
      <View style={styles.distribution}>
        <View style={styles.legend}>
          {healthSegments.map(({ key, color }) => (
            <LegendItem
              color={color}
              key={key}
              label={labels[key]}
              primary={legendValueMode === "percentage"
                ? formatPercent(percentages[key])
                : formatNumber(normalizedCounts[key])}
              secondary={legendValueMode === "count"
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
  const center = RING_SIZE / 2;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const activeSegments = healthSegments.filter(({ key }) => counts[key] > 0);
  const gapBudget = activeSegments.length > 1 ? SEGMENT_GAP * activeSegments.length : 0;
  const drawable = Math.max(0, circumference - gapBudget);
  let consumed = 0;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <Circle
        cx={center}
        cy={center}
        r={RING_RADIUS}
        fill="none"
        stroke={colors.panelStrong}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
      />
      {total > 0
        ? activeSegments.map(({ key, color }) => {
            const value = counts[key];
            const length = (value / total) * drawable;
            const offset = consumed;
            consumed += length + (activeSegments.length > 1 ? SEGMENT_GAP : 0);
            return (
              <Circle
                key={key}
                cx={center}
                cy={center}
                r={RING_RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0.01, length)} ${Math.max(0, circumference - length)}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })
        : null}
    </Svg>
  );
}

/**
 * Proportional health bar: one flat block per status, widths set by the real
 * counts, in fixed Good → Watch → Low → Critical order.
 *
 * This used to be a smoothly blended gradient that always ran green → tomato
 * regardless of the data, so a healthy kitchen and a failing one produced a
 * near-identical bar. The concept draws discrete bands, and discrete bands are
 * also the only honest option: the boundary between two colours is where one
 * status actually ends.
 */
export function InventoryHealthBar({
  counts,
  height = BAR_HEIGHT
}: {
  counts: InventoryHealthCounts;
  /** Thinner inline on Home, thicker inside the Inventory card. */
  height?: number;
}) {
  const normalizedCounts = useMemo(() => normalizeInventoryHealthCounts(counts), [counts]);
  const total = getInventoryHealthTotal(normalizedCounts);
  const segments = useMemo(
    () =>
      inventoryHealthStatusOrder
        .map((status) => ({ status, value: normalizedCounts[status] ?? 0 }))
        .filter((segment) => segment.value > 0),
    [normalizedCounts]
  );
  // Same status -> colour map the ring and legend already use, so a bar can
  // never disagree with the legend sitting beside it.

  return (
    <View style={[styles.bar, { height, borderRadius: height / 2 }]}>
      {total === 0 || segments.length === 0 ? (
        <View style={styles.emptyBar} />
      ) : (
        segments.map((segment) => (
          <View
            key={segment.status}
            style={{
              flexGrow: segment.value,
              flexBasis: 0,
              backgroundColor: healthSegmentColors[segment.status]
            }}
          />
        ))
      )}
    </View>
  );
}

const BAR_HEIGHT = 12;

function LegendItem({
  color,
  label,
  primary,
  secondary
}: {
  color: string;
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={styles.legendLabel}>{label}</Text>
      <View style={styles.legendValues}>
        <Text numberOfLines={1} style={styles.legendValue}>{primary}</Text>
        <Text numberOfLines={1} style={styles.legendSecondary}>{secondary}</Text>
      </View>
    </View>
  );
}

/** The one status -> colour map for the ring, the bar, and the legend. */
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
    gap: 18
  },
  scoreBlock: {
    width: RING_SIZE,
    alignItems: "center",
    gap: 8
  },
  score: {
    width: RING_SIZE,
    height: RING_SIZE,
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
    paddingHorizontal: 22
  },
  scoreValue: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
    textAlign: "center"
  },
  scoreLabel: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    maxWidth: RING_SIZE
  },
  distribution: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 2
  },
  bar: {
    height: BAR_HEIGHT,
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
    gap: 8
  },
  legendItem: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: typography.families.medium,
    fontSize: 13,
    lineHeight: 17
  },
  legendValues: {
    alignItems: "flex-end",
    gap: 1,
    minWidth: 44
  },
  legendValue: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 16,
    textAlign: "right"
  },
  legendSecondary: {
    color: colors.faint,
    fontFamily: typography.families.medium,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "right"
  }
});
