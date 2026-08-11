import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, density, radii } from "../../constants/theme";

export type IconBadgeTone = "brand" | "leaf" | "neutral" | "caution" | "warning" | "danger" | "inverse";
export type IconBadgeSize = "md" | "sm" | "plain";

interface IconBadgeProps {
  children: ReactNode;
  tone?: IconBadgeTone;
  /** `plain` keeps outline icons untiled; `sm` is the 28px reference tile. */
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

/**
 * The concept leads a row with a small rounded-square tile, not a large filled
 * circle. Circles at 44px read as decorative avatars and were what made the
 * previous build's lists feel like a consumer feed rather than an operating
 * surface. Touch size is carried by the row, not by this tile.
 */
const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeSm: {
    width: density.iconTile,
    height: density.iconTile,
    borderRadius: radii.xs
  },
  badgePlain: {
    width: density.iconPlain,
    height: density.iconPlain,
    borderRadius: radii.xs,
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
