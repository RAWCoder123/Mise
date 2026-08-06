import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, conceptTypography, density, radii } from "../../constants/theme";

export interface ActionTileProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * Outlined quick-action tile: icon + label.
 * Pair with `ActionTileGrid` — use `columns={4}` for a compact More shortcut row.
 */
export function ActionTile({
  label,
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  style,
  compact
}: ActionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={Math.max(0, Math.ceil((density.hitTarget - (compact ? density.shortcutTile : 88)) / 2))}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        compact && styles.compactTile,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <View style={[styles.iconWrap, compact && styles.compactIconWrap]}>{icon}</View>
      <Text numberOfLines={2} style={[styles.label, compact && styles.compactLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface ActionTileGridProps {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  columns?: 2 | 4;
}

/** Wrapping grid for ActionTiles. */
export function ActionTileGrid({ children, accessibilityLabel, style, columns = 2 }: ActionTileGridProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.grid, columns === 4 && styles.gridFour, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  gridFour: {
    gap: 8,
    flexWrap: "nowrap"
  },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 0,
    minHeight: 88,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10
  },
  compactTile: {
    flexBasis: 0,
    flexGrow: 1,
    minHeight: density.shortcutTile,
    height: density.shortcutTile,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 6
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  compactIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0,
    backgroundColor: colors.accentSoft
  },
  label: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  compactLabel: {
    textAlign: "center",
    ...conceptTypography.caption,
    fontFamily: conceptTypography.caption.fontFamily
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.46
  }
});
