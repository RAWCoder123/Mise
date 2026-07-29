import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fontFamilies } from "../../constants/theme";

/** Tiny red handwritten/script “m” mark from the concept header. */
export function MiseMark({
  size = 20,
  style
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.markBox, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M3.1 18.6c.15-4.2.55-8.4 1.55-10.35.55-1.05 1.45-1.55 2.35-1.25.75.25 1.2.95 1.55 2.05 1.05 3.25 1.85 6.7 2.45 9.35.15.7.5 1.05 1.05.95.55-.1.9-.55 1.2-1.35 1.15-3.35 2.35-6.85 3.45-8.55.55-.85 1.3-1.25 2.15-1.05.95.2 1.4 1.05 1.45 2.55.15 3.05 0 6.55-.25 9.45-.05.55.15 1 .65 1.15.2.05.4.05.6-.05"
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Small red script m + black lowercase “mise”. */
export function BrandLockup({
  compact,
  showTagline,
  size = "default",
  style
}: {
  compact?: boolean;
  showTagline?: boolean;
  size?: "default" | "small";
  style?: StyleProp<ViewStyle>;
}) {
  const markSize = size === "small" ? 18 : 22;
  const wordSize = size === "small" ? 17 : 21;
  const shouldShowTagline = showTagline ?? false;

  if (compact) {
    return (
      <View style={[styles.wrap, styles.compactWrap, style]}>
        <MiseMark size={markSize} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Mise">
      <MiseMark size={markSize} />
      <View style={styles.wordBlock}>
        <Text style={[styles.wordmark, { fontSize: wordSize, lineHeight: wordSize + 2 }]}>mise</Text>
        {shouldShowTagline ? <Text style={styles.tagline}>restaurant ops</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  compactWrap: {
    gap: 0
  },
  markBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  wordBlock: {
    justifyContent: "center"
  },
  wordmark: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    letterSpacing: -0.45,
    textTransform: "lowercase"
  },
  tagline: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    lineHeight: 12,
    marginTop: 1
  }
});
