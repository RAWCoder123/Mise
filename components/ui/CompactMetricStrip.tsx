import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, conceptTypography, radii } from "../../constants/theme";

export type CompactMetricTone = "default" | "accent" | "success" | "caution" | "warning" | "danger";

export interface CompactMetric {
  id: string;
  label: string;
  value: string | number;
  /** Movement against the comparison window, e.g. "+12%" or "4". */
  delta?: string;
  deltaTone?: CompactMetricTone;
  /** What the delta is measured against, e.g. "vs yesterday". */
  comparison?: string;
  /** Legacy alias for `delta`; kept so existing callers keep working. */
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

/**
 * Four-up glance strip: ONE bordered card divided by hairlines, not four
 * separate cards. Each cell stacks label / value / delta / comparison and has
 * no minimum height — the content sets the height.
 */
export function CompactMetricStrip({ metrics, style, accessibilityLabel }: CompactMetricStripProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.grid, style]}>
      {metrics.map((metric, index) => {
        const delta = metric.delta ?? metric.caption;
        const deltaTone = metric.deltaTone ?? metric.captionTone;
        return (
          <View
            accessible
            accessibilityLabel={
              metric.accessibilityLabel ??
              [metric.label, String(metric.value), delta, metric.comparison]
                .filter(Boolean)
                .join(", ")
            }
            key={metric.id}
            style={[styles.cell, index > 0 && styles.cellDivided]}
          >
            {/* Two lines so a long Spanish or Chinese label wraps instead of truncating. */}
            <Text style={styles.label} numberOfLines={2}>
              {metric.label}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.value, metric.tone ? toneStyles[metric.tone] : undefined]}
            >
              {metric.value}
            </Text>
            {delta ? (
              <Text
                numberOfLines={1}
                style={[styles.delta, deltaTone ? toneStyles[deltaTone] : styles.deltaMuted]}
              >
                {delta}
              </Text>
            ) : null}
            {metric.comparison ? (
              <Text numberOfLines={1} style={styles.comparison}>
                {metric.comparison}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Short alias for screens that already describe the strip as compact. */
export const MetricStrip = CompactMetricStrip;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 0,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  cell: {
    width: "auto",
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 1,
    justifyContent: "flex-start"
  },
  cellDivided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border
  },
  label: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  value: {
    color: colors.text,
    ...conceptTypography.metricValue
  },
  delta: {
    ...conceptTypography.caption
  },
  deltaMuted: {
    color: colors.muted
  },
  comparison: {
    color: colors.faint,
    ...conceptTypography.micro
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
