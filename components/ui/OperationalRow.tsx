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
  style?: StyleProp<ViewStyle>;
  /** `menu` = open list rows; `operational` = inventory/group rows; default keeps prior feel. */
  density?: RowDensity;
}

export function OperationalRow({
  title,
  subtitle,
  icon,
  iconTone = "neutral",
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
  style,
  density: rowDensity = "default"
}: OperationalRowProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const isActionable = typeof onPress === "function";
  const showSubtitle = Boolean(subtitle?.trim());
  const isMenu = rowDensity === "menu";
  const isOperational = rowDensity === "operational";
  const iconSize = isMenu || isOperational ? "plain" : iconTone === "neutral" ? "plain" : "sm";

  return (
    <Pressable
      accessibilityRole={isActionable ? "button" : undefined}
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
        <IconBadge tone={isMenu ? "neutral" : iconTone} size={iconSize}>
          {icon}
        </IconBadge>
        <View style={styles.copy}>
          <View style={styles.titleLine}>
            <Text style={[styles.title, (isMenu || isOperational) && styles.titleCompact]} numberOfLines={titleLines}>
              {title}
            </Text>
            {badgeLabel && <Badge label={badgeLabel} tone={badgeTone} />}
          </View>
          {showSubtitle ? (
            <Text style={[styles.subtitle, (isMenu || isOperational) && styles.subtitleCompact]} numberOfLines={subtitleLines}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {(value || meta || trailing || isActionable) && (
          <View style={styles.trail}>
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
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowMenu: {
    minHeight: density.menuRow,
    height: density.menuRow,
    paddingVertical: 0,
    gap: 10
  },
  rowOperational: {
    minHeight: density.operationalRow,
    height: density.operationalRow,
    paddingVertical: 0,
    gap: 8
  },
  copy: {
    flex: 1,
    minWidth: 0
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
  titleCompact: {
    ...conceptTypography.rowTitle
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1
  },
  subtitleCompact: {
    ...conceptTypography.caption,
    fontFamily: fontFamilies.body,
    marginTop: 0
  },
  trail: {
    minWidth: 36,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2
  },
  value: {
    maxWidth: 76,
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 16,
    textAlign: "right"
  },
  meta: {
    maxWidth: 84,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
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
