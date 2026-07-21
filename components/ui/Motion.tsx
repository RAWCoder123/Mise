import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  type StyleProp,
  type ViewProps,
  type ViewStyle
} from "react-native";

interface MotionViewProps extends ViewProps {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  initialOpacity?: number;
  style?: StyleProp<ViewStyle>;
}

const supportsNativeDriver = Platform.OS !== "web";
const webMotionInitialOpacity = Platform.OS === "web" ? 0.9 : 0;
const webMotionDistanceScale = Platform.OS === "web" ? 0.45 : 1;

/**
 * Tracks the platform reduce-motion preference and updates while the app is
 * running. Components should still provide a non-motion pressed state (for
 * example opacity) so feedback is never removed with animation.
 */
export function useReducedMotion() {
  const [isReducedMotionEnabled, setIsReducedMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setIsReducedMotionEnabled);

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isMounted) setIsReducedMotionEnabled(isEnabled);
      })
      .catch(() => {
        // Fail static when a platform cannot reliably report the preference.
        if (isMounted) setIsReducedMotionEnabled(true);
      });

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  return isReducedMotionEnabled;
}

export function MotionView({
  children,
  delay = 0,
  distance = 10,
  duration = 360,
  initialOpacity = webMotionInitialOpacity,
  style,
  ...props
}: MotionViewProps) {
  const isReducedMotionEnabled = useReducedMotion();
  const opacity = useRef(new Animated.Value(initialOpacity)).current;
  const translateY = useRef(new Animated.Value(distance * webMotionDistanceScale)).current;

  useEffect(() => {
    if (isReducedMotionEnabled) {
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(initialOpacity);
    translateY.setValue(distance * webMotionDistanceScale);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: supportsNativeDriver
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: supportsNativeDriver
      })
    ]);

    animation.start();
    return () => animation.stop();
  }, [delay, distance, duration, initialOpacity, isReducedMotionEnabled, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]} {...props}>
      {children}
    </Animated.View>
  );
}

/** Subtle, reduced-motion-aware crossfade for refreshed operational values. */
export function StateChangeView({
  stateKey,
  ...props
}: MotionViewProps & { stateKey: string }) {
  return <MotionView key={stateKey} distance={0} duration={220} initialOpacity={0.76} {...props} />;
}

export function usePressScale(activeScale = 0.975) {
  const isReducedMotionEnabled = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => activeAnimation.current?.stop(), []);

  const animate = useCallback((toValue: number) => {
    activeAnimation.current?.stop();

    if (isReducedMotionEnabled) {
      // Callers retain their Pressable opacity feedback without movement.
      scale.setValue(1);
      return;
    }

    activeAnimation.current = Animated.spring(scale, {
      toValue,
      speed: 34,
      bounciness: 4,
      useNativeDriver: supportsNativeDriver
    });
    activeAnimation.current.start();
  }, [isReducedMotionEnabled, scale]);

  const scaleStyle = useMemo(() => ({ transform: [{ scale }] }), [scale]);

  return {
    pressIn: useCallback(() => animate(activeScale), [activeScale, animate]),
    pressOut: useCallback(() => animate(1), [animate]),
    scaleStyle,
    isReducedMotionEnabled
  };
}
