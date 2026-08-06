import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fontFamilies } from "../../constants/theme";

const WORDMARK = require("../../assets/brand/mise-script-wordmark.png");
const WORDMARK_ASPECT = 665 / 201;

/** Red handwritten/script “m” — used alone in chat avatars and compact chrome. */
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
          d="M2.6 19.4c.25-4.55.85-8.85 1.9-10.85.65-1.2 1.7-1.75 2.7-1.35.85.35 1.3 1.15 1.65 2.35 1.0 3.4 1.8 6.95 2.4 9.55.1.6.38.88.82.78.48-.1.78-.48 1.05-1.2 1.25-3.5 2.55-7.15 3.7-8.9.58-.9 1.4-1.3 2.35-1.0 1.05.3 1.5 1.25 1.55 2.85.12 3.2-.05 6.8-.3 9.75-.05.5.12.9.55 1.05.22.06.42.05.6-.05"
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.55}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Official lockup from brand asset: red script m + black ise with red i-dot. */
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
  const isSmall = size === "small";
  const height = isSmall ? 20 : 30;
  const width = Math.round(height * WORDMARK_ASPECT);
  const shouldShowTagline = showTagline ?? false;

  if (compact) {
    return (
      <View style={[styles.wrap, styles.compactWrap, style]} accessibilityLabel="Mise">
        <MiseMark size={isSmall ? 26 : 32} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Mise">
      <Image
        source={WORDMARK}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        style={{ width, height }}
      />
      {shouldShowTagline ? (
        <View style={styles.taglineBlock}>
          <Text style={styles.tagline}>restaurant ops</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0
  },
  compactWrap: {
    gap: 0
  },
  markBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  taglineBlock: {
    marginLeft: 8,
    justifyContent: "center"
  },
  tagline: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 11,
    lineHeight: 14
  }
});
