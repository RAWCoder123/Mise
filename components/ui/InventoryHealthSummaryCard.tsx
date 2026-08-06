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
  style
}: InventoryHealthSummaryCardProps) {
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.head}>
        <Text style={styles.percent}>{percentLabel}</Text>
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
      <InventoryHealthBar counts={counts} />
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
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 7
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
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.5
  },
  statusLabel: {
    color: colors.muted,
    ...conceptTypography.rowTitle
  },
  chip: {
    borderRadius: radii.xl,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  chipText: {
    ...conceptTypography.caption
  },
  body: {
    color: colors.muted,
    ...conceptTypography.body
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
