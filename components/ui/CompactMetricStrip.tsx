import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, shadows, typography } from "../../constants/theme";

export type CompactMetricTone = "default" | "accent" | "success" | "caution" | "warning" | "danger";

export interface CompactMetric {
  id: string;
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: CompactMetricTone;
  accessibilityLabel?: string;
}

export interface CompactMetricStripProps {
  metrics: readonly CompactMetric[];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** A scan-first row for two to four small operational KPIs. */
export function CompactMetricStrip({ metrics, style, accessibilityLabel }: CompactMetricStripProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.strip, style]}>
      {metrics.map((metric, index) => (
        <View
          accessible
          accessibilityLabel={metric.accessibilityLabel ?? `${metric.label}: ${metric.value}`}
          key={metric.id}
          style={[styles.metric, index > 0 && styles.dividedMetric]}
        >
          {metric.icon ? <View style={styles.labelRow}>{metric.icon}<Text style={styles.label} numberOfLines={2}>{metric.label}</Text></View> : (
            <Text style={styles.label} numberOfLines={2}>{metric.label}</Text>
          )}
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.value, metric.tone ? toneStyles[metric.tone] : undefined]}
          >
            {metric.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Short alias for screens that already describe the strip as compact. */
export const MetricStrip = CompactMetricStrip;

const styles = StyleSheet.create({
  strip: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    ...shadows.card
  },
  metric: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    justifyContent: "space-between",
    gap: 6
  },
  dividedMetric: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    ...typography.caption
  },
  value: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 17,
    lineHeight: 21
  }
});

const toneStyles = StyleSheet.create<Record<CompactMetricTone, { color: string }>>({
  default: { color: colors.text },
  accent: { color: colors.accentDark },
  success: { color: colors.success },
  caution: { color: colors.caution },
  warning: { color: colors.warning },
  danger: { color: colors.danger }
});
