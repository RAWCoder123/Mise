import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "../../constants/theme";

const fullLogo = require("../../assets/brand/mise-lockup.png");
const compactLogo = require("../../assets/brand/mise-lockup-compact.png");
const logoLeaf = "#1F4F2C";

export function MiseMark({
  size = 42,
  style
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.markBox, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 96 78">
        <Path d="M48 24C42 15 43 5 48 0C53 5 54 15 48 24Z" fill={logoLeaf} />
        <Path d="M39 25C28 23 19 15 16 6C28 7 37 15 43 27Z" fill={logoLeaf} />
        <Path d="M57 27C63 15 72 7 84 6C81 15 72 23 61 25Z" fill={logoLeaf} />
        <Path
          d="M5 72V45C5 28 17 18 33 18C43 18 50 24 54 33C59 24 67 18 79 18C91 18 96 29 96 45V72H80V46C80 38 75 34 68 34C60 34 55 39 52 48H44C41 39 36 34 28 34C21 34 16 39 16 47V72H5Z"
          fill={colors.accent}
        />
        <Path d="M25 46C27 43 31 44 32 48L40 72H15L25 46Z" fill={colors.surface} />
        <Path d="M71 46C69 43 65 44 64 48L56 72H81L71 46Z" fill={colors.surface} />
        <Path d="M48 50L40 72H56L48 50Z" fill={colors.surface} />
        <Circle cx="28" cy="55" r="3.2" fill={colors.accent} />
        <Circle cx="35" cy="62" r="3.2" fill={colors.accent} />
        <Circle cx="68" cy="55" r="3.2" fill={colors.accent} />
        <Circle cx="61" cy="62" r="3.2" fill={colors.accent} />
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
  const markSize = size === "small" ? 34 : 42;
  const shouldShowTagline = showTagline ?? !compact;
  const logoWidth = size === "small" ? 108 : compact ? 54 : 186;
  const logoHeight = size === "small" ? 34 : compact ? 42 : 78;

  if (!compact) {
    return (
      <View style={[styles.wrap, style]}>
        <Image
          source={shouldShowTagline ? fullLogo : compactLogo}
          resizeMode="contain"
          style={[styles.logoImage, { width: logoWidth, height: logoHeight }]}
          accessibilityLabel="Mise"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.compactWrap, style]}>
      <MiseMark size={markSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  compactWrap: {
    gap: 0
  },
  markBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  logoImage: {
    backgroundColor: colors.surface
  },
  wordBlock: {
    justifyContent: "center"
  }
});
