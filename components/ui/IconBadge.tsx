import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii } from "../../constants/theme";

export type IconBadgeTone = "brand" | "leaf" | "neutral" | "caution" | "warning" | "danger" | "inverse";

interface IconBadgeProps {
  children: ReactNode;
  tone?: IconBadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function IconBadge({ children, tone = "neutral", style }: IconBadgeProps) {
  return <View style={[styles.badge, toneStyles[tone], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  }
});

const toneStyles = StyleSheet.create<Record<IconBadgeTone, ViewStyle>>({
  brand: {
    backgroundColor: colors.accentSoft,
    borderColor: "transparent"
  },
  leaf: {
    backgroundColor: colors.successSoft,
    borderColor: "transparent"
  },
  neutral: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  caution: {
    backgroundColor: colors.cautionSoft,
    borderColor: "transparent"
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: "transparent"
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "transparent"
  },
  inverse: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "transparent"
  }
});
