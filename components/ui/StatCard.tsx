import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";

import { colors, iconStroke, radii, spacing, typography } from "../../constants/theme";

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
 * Compact KPI card: muted label, optional top-right delta, large value.
 * Use `StatCardRow` for a 2×2 grid.
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
        <View style={styles.labelRow}>
          {icon}
          <Text numberOfLines={1} style={styles.label}>{label}</Text>
        </View>
        {delta ? (
          <View style={[styles.deltaChip, deltaChipStyles[delta.tone]]}>
            <DeltaIcon size={10} color={deltaIconColor} strokeWidth={iconStroke} />
            <Text numberOfLines={1} style={[styles.deltaLabel, { color: deltaIconColor }]}>
              {delta.label}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.value, toneStyles[tone]]}
      >
        {value}
      </Text>
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
    flexBasis: "47%",
    minWidth: 0,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  labelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16
  },
  value: {
    color: colors.text,
    ...typography.metricValue,
    fontSize: 22,
    lineHeight: 28
  },
  deltaChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xl
  },
  deltaLabel: {
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 15
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
