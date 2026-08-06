import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, conceptTypography, fontFamilies, radii } from "../../constants/theme";

export type CompactMetricTone = "default" | "accent" | "success" | "caution" | "warning" | "danger";

export interface CompactMetric {
  id: string;
  label: string;
  value: string | number;
  /** Optional trend/caption under the value (e.g. "+12%"). */
  caption?: string;
  captionTone?: CompactMetricTone;
  tone?: CompactMetricTone;
  accessibilityLabel?: string;
}

export interface CompactMetricStripProps {
  metrics: readonly CompactMetric[];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Four-up glance strip for fast mobile scanning. */
export function CompactMetricStrip({ metrics, style, accessibilityLabel }: CompactMetricStripProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.grid, style]}>
      {metrics.map((metric) => (
        <View
          accessible
          accessibilityLabel={
            metric.accessibilityLabel ??
            [metric.label, String(metric.value), metric.caption].filter(Boolean).join(", ")
          }
          key={metric.id}
          style={styles.card}
        >
          <Text style={styles.label} numberOfLines={1}>
            {metric.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.value, metric.tone ? toneStyles[metric.tone] : undefined]}
          >
            {metric.value}
          </Text>
          {metric.caption ? (
            <Text
              numberOfLines={1}
              style={[styles.caption, metric.captionTone ? toneStyles[metric.captionTone] : styles.captionMuted]}
            >
              {metric.caption}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Short alias for screens that already describe the strip as compact. */
export const MetricStrip = CompactMetricStrip;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6
  },
  card: {
    width: "auto",
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
    justifyContent: "center"
  },
  label: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: fontFamilies.body,
    fontSize: 9,
    lineHeight: 12
  },
  value: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.35
  },
  caption: {
    fontFamily: fontFamilies.semibold,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1
  },
  captionMuted: {
    color: colors.muted
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
