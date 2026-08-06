import { useId, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

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

/** Soft spectrum health bar — always flows green → gold → orange → tomato. */
export function InventoryHealthBar({
  counts,
  height = BAR_HEIGHT
}: {
  counts: InventoryHealthCounts;
  /** Thinner inline on Home, thicker inside the Inventory card. */
  height?: number;
}) {
  const gradientId = `health-flow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const normalizedCounts = normalizeInventoryHealthCounts(counts);
  const total = getInventoryHealthTotal(normalizedCounts);
  const stops = useMemo(() => buildSpectrumHealthStops(normalizedCounts, total), [normalizedCounts, total]);
  const [barWidth, setBarWidth] = useState(0);

  if (total === 0) {
    return (
      <View style={styles.bar}>
        <View style={styles.emptyBar} />
      </View>
    );
  }

  return (
    <View
      style={[styles.bar, { height }]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== barWidth) setBarWidth(next);
      }}
    >
      {barWidth > 0 ? (
        <Svg width={barWidth} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2={barWidth} y2="0" gradientUnits="userSpaceOnUse">
              {stops.map((stop, index) => (
                <Stop key={`${index}-${stop.offset}`} offset={stop.offset} stopColor={stop.color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={barWidth} height={height} rx={height / 2} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
    </View>
  );
}

type HealthStop = { offset: string; color: string };

const BAR_HEIGHT = 12;

/**
 * Paint only present statuses with a bright warm spectrum.
 * Never ghost in missing green — RGB green+red midpoints read as muddy brown.
 */
function buildSpectrumHealthStops(counts: InventoryHealthCounts, total: number): HealthStop[] {
  if (total <= 0) {
    return [
      { offset: "0%", color: colors.panelStrong },
      { offset: "100%", color: colors.panelStrong }
    ];
  }

  const active = inventoryHealthStatusOrder
    .map((key) => ({ key, value: counts[key], color: healthFlowColors[key] }))
    .filter((segment) => segment.value > 0);

  if (active.length === 1) {
    const color = active[0]!.color;
    const soft = mixHexColors(color, "#FFFFFF", 0.18);
    return [
      { offset: "0%", color: soft },
      { offset: "45%", color },
      { offset: "100%", color }
    ];
  }

  const stops: HealthStop[] = [];
  let cursor = 0;

  active.forEach((segment, index) => {
    const share = segment.value / total;
    const start = cursor;
    const end = cursor + share;
    const mid = start + share / 2;
    cursor = end;

    if (index === 0) {
      stops.push({ offset: "0%", color: segment.color });
      stops.push({ offset: toPercent(Math.min(mid, start + share * 0.35)), color: segment.color });
    } else {
      const prev = active[index - 1]!;
      const bridge = spectrumBridge(prev.key, segment.key);
      const blendPad = Math.min(0.14, share * 0.55, (prev.value / total) * 0.55);
      stops.push({ offset: toPercent(Math.max(0, start - blendPad)), color: prev.color });
      stops.push({ offset: toPercent(Math.max(0, start - blendPad * 0.35)), color: bridge });
      stops.push({ offset: toPercent(start), color: bridge });
      stops.push({ offset: toPercent(Math.min(1, start + blendPad * 0.35)), color: bridge });
      stops.push({ offset: toPercent(Math.min(1, start + blendPad)), color: segment.color });
    }

    stops.push({ offset: toPercent(mid), color: segment.color });

    if (index === active.length - 1) {
      stops.push({ offset: "100%", color: segment.color });
    }
  });

  return dedupeStops(stops);
}

function spectrumBridge(
  from: keyof InventoryHealthCounts,
  to: keyof InventoryHealthCounts
): string {
  const key = `${from}:${to}`;
  return spectrumBridges[key] ?? mixHexColors(healthFlowColors[from], healthFlowColors[to], 0.5);
}

/** Hand-picked bridges — stay warm between status tokens, never olive-brown mud. */
const spectrumBridges: Record<string, string> = {
  "good:watch": "#7A9A3A",
  "good:low": "#C49A2E",
  "good:critical": "#C97A3A",
  "watch:low": "#B36B1A",
  "watch:critical": "#C45A28",
  "low:critical": "#C93A24"
};

function toPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10}%`;
}

function dedupeStops(stops: HealthStop[]): HealthStop[] {
  const seen = new Set<string>();
  return stops.filter((stop) => {
    const key = `${stop.offset}:${stop.color}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mixHexColors(a: string, b: string, amount: number) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  if (!left || !right) return amount < 0.5 ? a : b;
  const t = Math.max(0, Math.min(1, amount));
  const mix = (channel: "r" | "g" | "b") => Math.round(left[channel] + (right[channel] - left[channel]) * t);
  return `#${[mix("r"), mix("g"), mix("b")].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

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

/** Brand-aligned flow colors — same meanings as inventoryStatusColors. */
const healthFlowColors: Record<keyof InventoryHealthCounts, string> = {
  good: inventoryStatusColors.Good,
  watch: inventoryStatusColors.Watch,
  low: inventoryStatusColors.Low,
  critical: inventoryStatusColors.Critical
};

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
