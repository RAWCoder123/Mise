import { StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography } from "../../constants/theme";

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
    borderRadius: 6,
    borderWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  neutral: {
    backgroundColor: colors.surfaceWarm
  },
  success: {
    backgroundColor: colors.successSoft
  },
  caution: {
    backgroundColor: colors.cautionSoft
  },
  warning: {
    backgroundColor: colors.warningSoft
  },
  danger: {
    backgroundColor: colors.dangerSoft
  },
  label: {
    ...conceptTypography.micro
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
