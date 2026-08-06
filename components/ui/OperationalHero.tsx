import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { colors, fontFamilies, radii, typography } from "../../constants/theme";
import { StateChangeView, useReducedMotion } from "./Motion";

export type OperationalHeroTone = "brand" | "leaf" | "caution" | "warning" | "danger" | "neutral";

const supportsNativeDriver = Platform.OS !== "web";

interface HeroStat {
  label: string;
  value: string;
  tone?: OperationalHeroTone;
}

interface OperationalHeroProps {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  tone?: OperationalHeroTone;
  meta?: string;
  stats?: HeroStat[];
  actions?: ReactNode;
}

export function OperationalHero({
  eyebrow,
  title,
  body,
  icon,
  tone = "brand",
  meta,
  stats,
  actions
}: OperationalHeroProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const isReducedMotionEnabled = useReducedMotion();

  useEffect(() => {
    if (isReducedMotionEnabled) {
      pulse.stopAnimation();
      pulse.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: supportsNativeDriver
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: supportsNativeDriver
        })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isReducedMotionEnabled, pulse]);

  const signalScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] });
  const signalOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.52, 1, 0.52] });

  const palette = heroToneColors[tone];

  return (
    <StateChangeView stateKey={tone} style={styles.hero}>
      <View style={[styles.accentRail, { backgroundColor: palette.strong }]} />
      <View style={styles.signalTrack}>
        <Animated.View
          style={[
            styles.signalFill,
            { backgroundColor: palette.strong, opacity: signalOpacity, transform: [{ scaleX: signalScale }] }
          ]}
        />
      </View>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <View style={[styles.iconSlot, { backgroundColor: palette.soft }]}>{icon}</View>
          <View style={styles.titleWrap}>
            <Text style={[styles.eyebrow, { color: palette.strong }]}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        {meta && (
          <View style={[styles.metaPill, { backgroundColor: palette.soft, borderColor: palette.strong }]}>
            <Text style={[styles.metaText, { color: palette.strong }]}>{meta}</Text>
          </View>
        )}
      </View>
      <Text style={styles.body}>{body}</Text>
      {stats && stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={`${stat.label}-${stat.value}`} style={styles.stat}>
              <Text
                style={[styles.statValue, stat.tone ? { color: heroToneColors[stat.tone].strong } : undefined]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {stat.value}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
      {actions && <View style={styles.actions}>{actions}</View>}
    </StateChangeView>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    minHeight: 154
  },
  accentRail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.accent
  },
  signalTrack: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 116,
    height: 4,
    backgroundColor: colors.panel
  },
  signalFill: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.accent,
    transformOrigin: "left"
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  identity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    flex: 1
  },
  iconSlot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  titleWrap: {
    flex: 1
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.semibold,
    textTransform: "uppercase"
  },
  metaPill: {
    minHeight: 36,
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 0,
    borderColor: "transparent"
  },
  metaText: {
    color: colors.accentDark,
    fontSize: 13,
    fontFamily: fontFamilies.semibold
  },
  title: {
    color: colors.text,
    ...typography.sectionTitle,
    fontSize: 18,
    lineHeight: 24,
    maxWidth: 430,
    marginTop: 6
  },
  body: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 430,
    marginTop: 8
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  stat: {
    flex: 1,
    minHeight: 68,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "space-between"
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fontFamilies.semibold
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 14,
    fontFamily: fontFamilies.medium
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  }
});

const heroToneColors: Record<OperationalHeroTone, { strong: string; soft: string }> = {
  brand: { strong: colors.accentDark, soft: colors.accentSoft },
  leaf: { strong: colors.success, soft: colors.successSoft },
  caution: { strong: colors.caution, soft: colors.cautionSoft },
  warning: { strong: colors.warning, soft: colors.warningSoft },
  danger: { strong: colors.danger, soft: colors.dangerSoft },
  neutral: { strong: colors.muted, soft: colors.surfaceWarm }
};
