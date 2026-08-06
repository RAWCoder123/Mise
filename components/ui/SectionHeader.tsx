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
            hitSlop={SECTION_ACTION_HIT_SLOP}
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

/** 20px label + 12px slop each side clears the 44px target. */
const SECTION_ACTION_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

const styles = StyleSheet.create({
  wrap: {
    minHeight: density.sectionHeader,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: density.headerGap
  },
  textWrap: {
    flex: 1
  },
  eyebrow: {
    color: colors.accent,
    ...conceptTypography.micro,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1
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
    ...conceptTypography.subtitle,
    marginTop: 1
  },
  actionButton: {
    alignItems: "flex-end",
    justifyContent: "center"
  },
  action: {
    color: colors.accentDark,
    ...conceptTypography.button
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
