import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamilies } from "../../constants/theme";

export type BadgeTone = "neutral" | "success" | "caution" | "warning" | "danger";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return (
    <View style={[styles.base, styles[tone]]}>
      <Text style={[styles.label, labelToneStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: 7,
    borderWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  neutral: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border
  },
  success: {
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
  label: {
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fontFamilies.semibold
  },
  neutralLabel: { color: colors.muted },
  successLabel: { color: colors.success },
  cautionLabel: { color: colors.caution },
  warningLabel: { color: colors.warning },
  dangerLabel: { color: colors.danger }
});

const labelToneStyles: Record<BadgeTone, object> = {
  neutral: styles.neutralLabel,
  success: styles.successLabel,
  caution: styles.cautionLabel,
  warning: styles.warningLabel,
  danger: styles.dangerLabel
};
