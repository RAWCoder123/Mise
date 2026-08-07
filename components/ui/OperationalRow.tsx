import { type ReactNode } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { ChevronRight } from "lucide-react-native";

import { colors, conceptTypography, density, fontFamilies } from "../../constants/theme";
import { usePressScale } from "./Motion";
import { Badge } from "./Badge";
import { IconBadge, type IconBadgeTone } from "./IconBadge";

type RowSemanticTone = "neutral" | "brand" | "success" | "caution" | "warning" | "danger";
type RowBadgeTone = Exclude<RowSemanticTone, "brand">;
type RowDensity = "default" | "menu" | "operational";

interface OperationalRowProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconTone?: IconBadgeTone;
  /** Replaces the IconBadge wrapper entirely — used for item glyphs. */
  leading?: ReactNode;
  value?: string;
  meta?: string;
  valueTone?: RowSemanticTone;
  metaTone?: RowSemanticTone;
  badgeLabel?: string;
  badgeTone?: RowBadgeTone;
  titleLines?: number;
  subtitleLines?: number;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** `menu` = open list rows; `operational` = inventory/group rows; default keeps prior feel. */
  density?: RowDensity;
}

export function OperationalRow({
  title,
  subtitle,
  icon,
  iconTone = "neutral",
  leading,
  value,
  meta,
  valueTone = "neutral",
  metaTone = "neutral",
  badgeLabel,
  badgeTone = "neutral",
  titleLines = 1,
  subtitleLines = 2,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  density: rowDensity = "default"
}: OperationalRowProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const isActionable = typeof onPress === "function";
  const showSubtitle = Boolean(subtitle?.trim());
  const isMenu = rowDensity === "menu";
  const isOperational = rowDensity === "operational";
  // Menu stays icon-only; operational rows use soft status tiles (inventory concept).
  const iconSize = isMenu ? "plain" : isOperational ? "sm" : iconTone === "neutral" ? "plain" : "sm";

  return (
    <Pressable
      accessibilityRole={isActionable ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={!isActionable}
      onPress={onPress}
      onPressIn={isActionable ? pressIn : undefined}
      onPressOut={isActionable ? pressOut : undefined}
      style={({ pressed }) => [pressed && isActionable && styles.pressed]}
    >
      <Animated.View
        style={[
          styles.row,
          isMenu && styles.rowMenu,
          isOperational && styles.rowOperational,
          style,
          isActionable && scaleStyle
        ]}
      >
        {leading ?? (
          <IconBadge tone={isMenu ? "neutral" : iconTone} size={iconSize}>
            {icon}
          </IconBadge>
        )}
        <View style={styles.copy}>
          <View style={styles.titleLine}>
            <Text style={styles.title} numberOfLines={titleLines}>
              {title}
            </Text>
            {badgeLabel && !isOperational ? <Badge label={badgeLabel} tone={badgeTone} /> : null}
          </View>
          {showSubtitle ? (
            <Text style={styles.subtitle} numberOfLines={subtitleLines}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {(value || meta || trailing || isActionable || (badgeLabel && isOperational)) && (
          <View style={styles.trail}>
            {badgeLabel && isOperational ? <Badge label={badgeLabel} tone={badgeTone} /> : null}
            {trailing}
            {value && (
              <Text style={[styles.value, rowToneStyles[valueTone]]} numberOfLines={1} adjustsFontSizeToFit>
                {value}
              </Text>
            )}
            {meta && (
              <Text style={[styles.meta, rowToneStyles[metaTone]]} numberOfLines={1}>
                {meta}
              </Text>
            )}
            {isActionable && <ChevronRight size={density.chevron} color={colors.faint} strokeWidth={2.25} />}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  rowMenu: {
    minHeight: density.menuRow,
    height: density.menuRow,
    paddingVertical: 0,
    gap: 9
  },
  rowOperational: {
    minHeight: density.operationalRow,
    paddingVertical: 7,
    gap: 9
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  subtitle: {
    color: colors.muted,
    ...conceptTypography.subtitle,
    marginTop: 1
  },
  trail: {
    minWidth: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6
  },
  value: {
    maxWidth: 96,
    color: colors.text,
    ...conceptTypography.rowTitle,
    textAlign: "right"
  },
  meta: {
    maxWidth: 96,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fontFamilies.semibold,
    textAlign: "right"
  },
  pressed: {
    opacity: 0.76
  }
});

const rowToneStyles: Record<RowSemanticTone, object | undefined> = {
  neutral: undefined,
  brand: { color: colors.accentDark },
  success: { color: colors.success },
  caution: { color: colors.caution },
  warning: { color: colors.warning },
  danger: { color: colors.danger }
};
