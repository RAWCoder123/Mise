import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, conceptTypography, fontFamilies, inventoryStatusColors, radii } from "../../constants/theme";
import {
  InventoryHealthBar,
  type InventoryHealthCounts
} from "./InventoryHealth";

type ChipTone = "success" | "warning" | "neutral";

interface InventoryHealthSummaryCardProps {
  counts: InventoryHealthCounts;
  percentLabel: string;
  title?: string;
  statusLabel?: string;
  chipLabel?: string;
  chipTone?: ChipTone;
  body?: string;
  legend?: {
    good: string;
    watch: string;
    low: string;
  };
  accessibilityLabel?: string;
  /** `inline` is the concept's single-row Home strip; `card` is the block. */
  layout?: "card" | "inline";
  style?: StyleProp<ViewStyle>;
}

/** Soft white health card shared by Home and Inventory. */
export function InventoryHealthSummaryCard({
  counts,
  percentLabel,
  title,
  statusLabel,
  chipLabel,
  chipTone = "neutral",
  body,
  legend,
  accessibilityLabel,
  layout = "card",
  style
}: InventoryHealthSummaryCardProps) {
  // The numeral carries the same tone as the chip beside it. It used to be
  // hardcoded green, so a kitchen at 57% rendered a green "57%" next to an
  // amber "Needs attention" chip and a mostly-amber bar — three elements
  // describing the same state, disagreeing.
  const percentToneStyle = percentToneStyles[chipTone];

  if (layout === "inline") {
    // One row: big percent, status chip, and the bar taking the rest.
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={[styles.inlineRow, style]}>
        <Text style={[styles.inlinePercent, percentToneStyle]}>{percentLabel}</Text>
        {chipLabel ? (
          <View style={[styles.chip, chipToneStyles[chipTone]]}>
            <Text style={[styles.chipText, chipTextToneStyles[chipTone]]}>{chipLabel}</Text>
          </View>
        ) : null}
        <View style={styles.inlineBar}>
          <InventoryHealthBar counts={counts} height={6} />
        </View>
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.head}>
        <Text style={[styles.percent, percentToneStyle]}>{percentLabel}</Text>
        {statusLabel ? <Text style={styles.statusLabel}>{statusLabel}</Text> : null}
        {chipLabel ? (
          <View style={[styles.chip, chipToneStyles[chipTone]]}>
            <Text style={[styles.chipText, chipTextToneStyles[chipTone]]}>{chipLabel}</Text>
          </View>
        ) : null}
      </View>
      {body ? (
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
      ) : null}
      <InventoryHealthBar counts={counts} height={8} />
      {legend ? (
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            <Text style={{ color: inventoryStatusColors.Good }}>● </Text>
            {legend.good}
          </Text>
          <Text style={styles.legendText}>
            <Text style={{ color: inventoryStatusColors.Watch }}>● </Text>
            {legend.watch}
          </Text>
          <Text style={styles.legendText}>
            <Text style={{ color: inventoryStatusColors.Low }}>● </Text>
            {legend.low}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6
  },
  inlineRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inlinePercent: {
    color: colors.success,
    ...conceptTypography.screenTitle
  },
  inlineBar: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6
  },
  percent: {
    color: colors.success,
    ...conceptTypography.screenTitle
  },
  statusLabel: {
    color: colors.muted,
    ...conceptTypography.subtitle
  },
  chip: {
    borderRadius: radii.xl,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  chipText: {
    ...conceptTypography.micro
  },
  body: {
    color: colors.muted,
    ...conceptTypography.subtitle
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  legendText: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: fontFamilies.medium
  }
});

const chipToneStyles = StyleSheet.create({
  success: { backgroundColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft },
  neutral: { backgroundColor: colors.surfaceWarm }
});

const chipTextToneStyles = StyleSheet.create({
  success: { color: colors.success },
  warning: { color: colors.warning },
  neutral: { color: colors.muted }
});

/** The big percentage agrees with the chip: green only when actually healthy. */
const percentToneStyles = StyleSheet.create({
  success: { color: colors.success },
  warning: { color: colors.warning },
  neutral: { color: colors.text }
});
