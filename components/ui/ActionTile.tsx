import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, typography } from "../../constants/theme";

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
      hitSlop={2}
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
    gap: 8
  },
  gridFour: {
    gap: 6,
    flexWrap: "nowrap"
  },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 0,
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8
  },
  compactTile: {
    flexBasis: 0,
    flexGrow: 1,
    minHeight: 64,
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 6
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  compactIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: colors.accentSoft
  },
  label: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 12.5,
    lineHeight: 16
  },
  compactLabel: {
    textAlign: "center",
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: typography.families.semibold
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.46
  }
});
