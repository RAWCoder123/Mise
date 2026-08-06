import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, radii, typography } from "../../constants/theme";
import { useReducedMotion } from "../ui/Motion";
import { MiseMark } from "../ui/BrandLockup";

const supportsNativeDriver = Platform.OS !== "web";

interface ThinkingBubbleProps {
  label: string;
  steps: readonly string[];
  /** How many thinking steps are currently revealed. */
  revealedCount: number;
}

export function ThinkingBubble({ label, steps, revealedCount }: ThinkingBubbleProps) {
  const visibleSteps = useMemo(() => steps.slice(0, Math.max(0, revealedCount)), [revealedCount, steps]);

  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <MiseMark size={22} />
      <View style={styles.copy}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <ThinkingDots />
        </View>
        {visibleSteps.length > 0 ? (
          <View style={styles.steps}>
            {visibleSteps.map((step, index) => {
              const isLatest = index === visibleSteps.length - 1;
              return (
                <View key={`${index}-${step}`} style={styles.stepRow}>
                  <View style={[styles.stepDot, isLatest && styles.stepDotActive]} />
                  <Text style={[styles.stepText, isLatest && styles.stepTextActive]}>{step}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ThinkingDots() {
  const isReducedMotionEnabled = useReducedMotion();
  const a = useRef(new Animated.Value(0.35)).current;
  const b = useRef(new Animated.Value(0.35)).current;
  const c = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (isReducedMotionEnabled) {
      a.setValue(0.7);
      b.setValue(0.7);
      c.setValue(0.7);
      return;
    }

    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: supportsNativeDriver
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: supportsNativeDriver
          })
        ])
      );

    const loops = [pulse(a, 0), pulse(b, 140), pulse(c, 280)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [a, b, c, isReducedMotionEnabled]);

  return (
    <View style={styles.dots} accessibilityElementsHidden>
      {[a, b, c].map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    maxWidth: "94%"
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  label: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent
  },
  steps: {
    gap: 6
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: colors.borderStrong
  },
  stepDotActive: {
    backgroundColor: colors.accent
  },
  stepText: {
    flex: 1,
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 18
  },
  stepTextActive: {
    color: colors.text
  }
});
