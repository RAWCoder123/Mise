import { type ReactNode } from "react";
import { StyleSheet, type ViewProps } from "react-native";

import { colors, radii } from "../../constants/theme";
import { MotionView } from "./Motion";

interface CardProps extends ViewProps {
  children: ReactNode;
  tone?: "default" | "warm";
}

export function Card({ children, tone = "default", style, ...props }: CardProps) {
  return (
    <MotionView style={[styles.card, tone === "warm" && styles.warm, style]} distance={6} duration={300} {...props}>
      {children}
    </MotionView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16
  },
  warm: {
    backgroundColor: colors.surfaceWarm
  }
});
