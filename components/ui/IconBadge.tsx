import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, density, radii } from "../../constants/theme";

export type IconBadgeTone = "brand" | "leaf" | "neutral" | "caution" | "warning" | "danger" | "inverse";
export type IconBadgeSize = "md" | "sm" | "plain";

interface IconBadgeProps {
  children: ReactNode;
  tone?: IconBadgeTone;
  /** `plain` keeps outline icons without colored tiles; `sm` is ~28px. */
  size?: IconBadgeSize;
  style?: StyleProp<ViewStyle>;
}

export function IconBadge({ children, tone = "neutral", size = "md", style }: IconBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        size === "sm" && styles.badgeSm,
        size === "plain" && styles.badgePlain,
        size !== "plain" && toneStyles[tone],
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeSm: {
    width: density.iconPlain,
    height: density.iconPlain,
    borderRadius: radii.sm
  },
  badgePlain: {
    width: density.iconPlain,
    height: density.iconPlain,
    borderRadius: 0,
    backgroundColor: "transparent"
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
