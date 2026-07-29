import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";

import { colors, fontFamilies } from "../../constants/theme";

/** Concept-style red produce mark used in headers and compact lockups. */
export function MiseMark({
  size = 28,
  style
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.markBox, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Ellipse cx="24" cy="27" rx="15" ry="16" fill={colors.accent} />
        <Path
          d="M24 8C22.2 11.4 21.6 14.8 22.4 17.2C23.1 15.2 24.6 13.6 26.8 12.4C25.8 10.6 24.9 9.1 24 8Z"
          fill={colors.success}
        />
        <Path
          d="M24 8C26.4 10.8 29.8 12.2 33.2 12.6C30.4 13.8 27.5 14.2 25.2 13.4C24.6 11.5 24.2 9.7 24 8Z"
          fill={colors.success}
        />
        <Ellipse cx="18" cy="24" rx="3.2" ry="4.2" fill={colors.accentDark} opacity={0.22} />
      </Svg>
    </View>
  );
}

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
  const markSize = size === "small" ? 26 : 34;
  const wordSize = size === "small" ? 20 : 26;
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
        <Text style={[styles.wordmark, { fontSize: wordSize, lineHeight: wordSize + 4 }]}>mise</Text>
        {shouldShowTagline ? <Text style={styles.tagline}>restaurant ops</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
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
    letterSpacing: -0.6,
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
