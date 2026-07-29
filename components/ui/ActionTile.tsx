import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { colors, radii, shadows, typography } from "../../constants/theme";

export interface ActionTileProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Outlined square quick-action tile: icon, label, quiet chevron.
 * Pair with `ActionTileGrid` for a two-by-two scan-first row on Today.
 */
export function ActionTile({
  label,
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  style
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
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.faint} strokeWidth={2.2} style={styles.chevron} />
    </Pressable>
  );
}

export interface ActionTileGridProps {
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Two-column wrapping grid for ActionTiles. */
export function ActionTileGrid({ children, accessibilityLabel, style }: ActionTileGridProps) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.grid, style]}>
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
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 0,
    minHeight: 96,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    ...shadows.card
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    flexGrow: 1,
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 13.5,
    lineHeight: 18,
    paddingRight: 18
  },
  chevron: {
    position: "absolute",
    right: 12,
    bottom: 14
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.46
  }
});
