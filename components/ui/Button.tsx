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

import { colors, radii, typography } from "../../constants/theme";
import { usePressScale } from "./Motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  icon,
  variant = "primary",
  fullWidth,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const isActionable = typeof props.onPress === "function";

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
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
      hitSlop={6}
      {...props}
    >
      <Animated.View style={[styles.content, scaleStyle]}>
        {icon}
        <Text style={[styles.label, variant === "primary" || variant === "danger" ? styles.lightLabel : styles.darkLabel]}>
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
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border
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
  lightLabel: {
    color: colors.surface
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
