import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, conceptTypography, density } from "../../constants/theme";

interface SectionHeaderProps {
  title: string;
  action?: string;
  eyebrow?: string;
  subtitle?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  actionTone?: "brand" | "neutral" | "caution" | "success" | "warning" | "danger";
  size?: "section" | "compact";
}

export function SectionHeader({
  title,
  action,
  eyebrow,
  subtitle,
  onAction,
  actionAccessibilityLabel,
  actionTone = "brand",
  size = "section"
}: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.title, size === "compact" && styles.compactTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel ?? action}
            hitSlop={6}
            onPress={onAction}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Text style={[styles.action, actionToneStyles[actionTone]]}>{action}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.meta, actionToneStyles[actionTone]]}>{action}</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  textWrap: {
    flex: 1
  },
  eyebrow: {
    color: colors.accent,
    ...conceptTypography.caption,
    textTransform: "uppercase",
    marginBottom: 2
  },
  title: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  compactTitle: {
    ...conceptTypography.rowTitle
  },
  subtitle: {
    color: colors.muted,
    ...conceptTypography.body,
    marginTop: 2
  },
  actionButton: {
    minHeight: density.hitTarget,
    minWidth: density.hitTarget,
    paddingHorizontal: 6,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  action: {
    color: colors.accentDark,
    ...conceptTypography.caption
  },
  meta: {
    color: colors.accentDark,
    ...conceptTypography.caption,
    textAlign: "right"
  },
  pressed: {
    opacity: 0.62
  }
});

const actionToneStyles = StyleSheet.create({
  brand: { color: colors.accentDark },
  neutral: { color: colors.muted },
  caution: { color: colors.caution },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger }
});
