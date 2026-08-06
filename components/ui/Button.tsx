import { type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { colors, conceptTypography, density, radii, typography } from "../../constants/theme";
import { usePressScale } from "./Motion";

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "default" | "compact";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  icon,
  variant = "primary",
  size = "default",
  fullWidth,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const isActionable = typeof props.onPress === "function";
  const lightLabel = variant === "primary" || variant === "danger";
  const softLabel = variant === "soft";
  const isCompact = size === "compact";
  const hitSlop = isCompact
    ? Math.max(0, Math.ceil((density.hitTarget - density.compactButton) / 2))
    : 6;

  return (
    <Pressable
      accessibilityRole={isActionable ? "button" : undefined}
      disabled={disabled || !isActionable}
      onPressIn={(event) => {
        pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressOut();
        onPressOut?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isCompact && styles.compact,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
      hitSlop={hitSlop}
      {...props}
    >
      <Animated.View style={[styles.content, isCompact && styles.compactContent, scaleStyle]}>
        {icon}
        <Text
          style={[
            styles.label,
            isCompact && styles.compactLabel,
            lightLabel ? styles.lightLabel : softLabel ? styles.softLabel : styles.darkLabel
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth
  },
  compact: {
    minHeight: density.compactButton,
    height: density.compactButton,
    paddingHorizontal: 10,
    borderRadius: radii.sm
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  compactContent: {
    gap: 4
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border
  },
  soft: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  },
  label: {
    ...typography.button
  },
  compactLabel: {
    ...conceptTypography.button
  },
  lightLabel: {
    color: colors.surface
  },
  softLabel: {
    color: colors.accentDark
  },
  darkLabel: {
    color: colors.text
  },
  fullWidth: {
    width: "100%"
  },
  pressed: {
    opacity: 0.78
  },
  disabled: {
    opacity: 0.46
  }
});
