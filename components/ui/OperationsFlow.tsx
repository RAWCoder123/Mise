import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamilies, radii, typography } from "../../constants/theme";

type FlowTone = "brand" | "leaf" | "caution" | "warning" | "danger" | "neutral";

interface OperationsFlowStep {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: FlowTone;
}

interface OperationsFlowProps {
  title: string;
  subtitle: string;
  steps: OperationsFlowStep[];
}

export function OperationsFlow({ title, subtitle, steps }: OperationsFlowProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={`${step.label}-${step.value}`} style={styles.stepRow}>
            <View style={styles.stepMarker}>
              <View style={[styles.iconSlot, toneStyles[step.tone ?? "neutral"]]}>{step.icon}</View>
              {index < steps.length - 1 && <View style={styles.connector} />}
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
            <Text
              style={[styles.stepValue, step.tone ? valueToneStyles[step.tone] : undefined]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {step.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 2
  },
  title: {
    color: colors.text,
    ...typography.cardTitle
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  steps: {
    marginTop: 4
  },
  stepRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  stepMarker: {
    alignSelf: "stretch",
    alignItems: "center",
    width: 44
  },
  iconSlot: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    marginTop: 11
  },
  connector: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4
  },
  stepText: {
    flex: 1
  },
  stepLabel: {
    color: colors.text,
    ...typography.caption,
    fontSize: 14,
    lineHeight: 19
  },
  stepDetail: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  stepValue: {
    minWidth: 46,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fontFamilies.semibold,
    textAlign: "right"
  },
});

const toneStyles = StyleSheet.create<Record<FlowTone, { backgroundColor: string; borderColor: string }>>({
  brand: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.redBorder
  },
  leaf: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  caution: {
    backgroundColor: colors.cautionSoft,
    borderColor: colors.caution
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger
  },
  neutral: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border
  }
});

const valueToneStyles: Record<FlowTone, { color: string }> = {
  brand: { color: colors.accentDark },
  leaf: { color: colors.success },
  caution: { color: colors.caution },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.text }
};
