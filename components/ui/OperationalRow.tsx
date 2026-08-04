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

import { colors, fontFamilies, typography } from "../../constants/theme";
import { usePressScale } from "./Motion";
import { Badge } from "./Badge";
import { IconBadge, type IconBadgeTone } from "./IconBadge";

type RowSemanticTone = "neutral" | "brand" | "success" | "caution" | "warning" | "danger";
type RowBadgeTone = Exclude<RowSemanticTone, "brand">;

interface OperationalRowProps {
  title: string;
  subtitle: string;
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
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
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
  disabled = false,
  style
}: OperationalRowProps) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const isActionable = typeof onPress === "function" && !disabled;

  return (
    <Pressable
      accessibilityRole={isActionable ? "button" : undefined}
      accessibilityState={typeof onPress === "function" ? { disabled: !isActionable } : undefined}
      disabled={!isActionable}
      onPress={isActionable ? onPress : undefined}
      onPressIn={isActionable ? pressIn : undefined}
      onPressOut={isActionable ? pressOut : undefined}
      style={({ pressed }) => [pressed && isActionable && styles.pressed, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.row, style, isActionable && scaleStyle]}>
        <IconBadge tone={iconTone}>{icon}</IconBadge>
        <View style={styles.copy}>
          <View style={styles.titleLine}>
            <Text style={styles.title} numberOfLines={titleLines}>
              {title}
            </Text>
            {badgeLabel && <Badge label={badgeLabel} tone={badgeTone} />}
          </View>
          <Text style={styles.subtitle} numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        </View>
        {(value || meta || trailing || isActionable || (typeof onPress === "function" && disabled)) && (
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
            {(isActionable || (typeof onPress === "function" && disabled)) && (
              <ChevronRight
                size={19}
                color={disabled ? colors.faint : colors.text}
                strokeWidth={2.45}
              />
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    ...typography.cardTitle
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  trail: {
    minWidth: 42,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3
  },
  value: {
    maxWidth: 76,
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 17,
    lineHeight: 21,
    textAlign: "right"
  },
  meta: {
    maxWidth: 84,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fontFamilies.semibold,
    textAlign: "right"
  },
  pressed: {
    opacity: 0.76
  },
  disabled: {
    opacity: 0.55
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
