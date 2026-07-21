import { type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii } from "../../constants/theme";
import { usePressScale } from "./Motion";

interface ActionIconProps extends Omit<PressableProps, "style"> {
  children: ReactNode;
  tone?: "default" | "brand" | "dark";
  style?: StyleProp<ViewStyle>;
}

export function ActionIcon({ children, tone = "default", style, disabled, onPressIn, onPressOut, ...props }: ActionIconProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.92);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
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
        tone === "brand" && styles.brand,
        tone === "dark" && styles.dark,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
      {...props}
    >
      <Animated.View style={scaleStyle}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  brand: {
    backgroundColor: colors.accentSoft,
    borderWidth: 0
  },
  dark: {
    backgroundColor: colors.text,
    borderWidth: 0
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.48
  }
});
