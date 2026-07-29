import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";

import { colors, radii, shadows, spacing, typography } from "../../constants/theme";

export type StatCardTone = "default" | "accent" | "success" | "caution" | "warning" | "danger";
export type StatDeltaTone = "success" | "danger" | "neutral";
export type StatDeltaTrend = "up" | "down" | "flat";

export interface StatCardDelta {
  /** Short chip label, e.g. "+12%". */
  label: string;
  trend: StatDeltaTrend;
  tone: StatDeltaTone;
  accessibilityLabel?: string;
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: StatCardTone;
  delta?: StatCardDelta;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single prominent KPI card: icon, muted label, large value, and an
 * optional trend chip. Use `StatCardRow` to lay several out in a grid.
 */
export function StatCard({ label, value, icon, tone = "default", delta, accessibilityLabel, style }: StatCardProps) {
  const deltaIconColor = deltaIconColors[delta?.tone ?? "neutral"];
  const DeltaIcon = delta?.trend === "up" ? TrendingUp : delta?.trend === "down" ? TrendingDown : Minus;

  return (
    <View
      accessible
      accessibilityLabel={
        accessibilityLabel ??
        [`${label}: ${value}`, delta?.accessibilityLabel ?? delta?.label].filter(Boolean).join(", ")
      }
      style={[styles.card, style]}
    >
      <View style={styles.headerRow}>
        {icon}
        <Text numberOfLines={2} style={styles.label}>{label}</Text>
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.value, toneStyles[tone]]}
      >
        {value}
      </Text>
      {delta ? (
        <View style={[styles.deltaChip, deltaChipStyles[delta.tone]]}>
          <DeltaIcon size={12} color={deltaIconColor} strokeWidth={2.4} />
          <Text numberOfLines={1} style={[styles.deltaLabel, { color: deltaIconColor }]}>
            {delta.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export interface StatCardRowProps {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Wrapping grid for StatCards; two per row on narrow screens. */
export function StatCardRow({ children, accessibilityLabel, style }: StatCardRowProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.row, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  card: {
    flexGrow: 1,
    flexBasis: "44%",
    minWidth: 0,
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    ...typography.caption
  },
  value: {
    color: colors.text,
    ...typography.metricValue
  },
  deltaChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.xl
  },
  deltaLabel: {
    ...typography.caption
  }
});

const toneStyles = StyleSheet.create<Record<StatCardTone, { color: string }>>({
  default: { color: colors.text },
  accent: { color: colors.accentDark },
  success: { color: colors.success },
  caution: { color: colors.caution },
  warning: { color: colors.warning },
  danger: { color: colors.danger }
});

const deltaChipStyles = StyleSheet.create<Record<StatDeltaTone, { backgroundColor: string }>>({
  success: { backgroundColor: colors.successSoft },
  danger: { backgroundColor: colors.dangerSoft },
  neutral: { backgroundColor: colors.panelStrong }
});

const deltaIconColors: Record<StatDeltaTone, string> = {
  success: colors.success,
  danger: colors.danger,
  neutral: colors.muted
};
