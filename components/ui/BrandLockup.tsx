import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fontFamilies } from "../../constants/theme";

/** Tiny red script-like “m” mark from the concept header. */
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
          d="M3.2 18.8V8.1c0-.9.5-1.5 1.2-1.5.5 0 .9.3 1.2.9l3.9 7.4c.2.4.5.6.9.6s.7-.2.9-.6l3.2-6.2c.3-.6.7-.9 1.2-.9.8 0 1.3.6 1.3 1.5v9.5"
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.35}
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
