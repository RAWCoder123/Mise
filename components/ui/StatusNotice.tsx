import { type ReactNode } from "react";
import { ChevronRight, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";

import { colors, conceptTypography, density, icon, iconStroke, radii } from "../../constants/theme";

export type StatusNoticeTone = "neutral" | "success" | "caution" | "warning" | "danger";
export type StatusNoticeActionVariant = "text" | "solid";
/** `row` is the concept's compact inline alert; `card` is the padded block. */
export type StatusNoticeVariant = "card" | "row";

export interface StatusNoticeProps extends Omit<ViewProps, "children"> {
  title: string;
  message?: string;
  /** Third line for provenance — confidence, freshness, source. */
  meta?: string;
  tone?: StatusNoticeTone;
  icon?: ReactNode;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  /** `solid` renders a compact filled accent button (mockup alert CTAs). */
  actionVariant?: StatusNoticeActionVariant;
  onAction?: () => void;
  variant?: StatusNoticeVariant;
  /** Makes the whole notice tappable and shows a trailing chevron. */
  onPress?: () => void;
}

export function StatusNotice({
  title,
  message,
  meta,
  tone = "neutral",
  icon,
  actionLabel,
  actionAccessibilityLabel,
  actionVariant = "text",
  onAction,
  variant = "card",
  onPress,
  style,
  ...props
}: StatusNoticeProps) {
  const actionIsAvailable = Boolean(actionLabel && onAction);
  const solidAction = actionVariant === "solid";
  const isRow = variant === "row";
  const Container = onPress ? Pressable : View;

  return (
    <Container
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      {...(onPress
        ? { accessibilityRole: "button" as const, accessibilityLabel: title, onPress }
        : null)}
      style={[styles.notice, isRow && styles.noticeRow, noticeToneStyles[tone], style]}
      {...props}
    >
      {/* The row variant drops the filled circle: the concept shows a bare tone icon. */}
      {isRow ? (
        <View style={styles.rowIcon}>{icon ?? defaultIcon(tone)}</View>
      ) : (
        <View style={[styles.icon, iconToneStyles[tone]]}>{icon ?? defaultIcon(tone)}</View>
      )}
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={isRow ? 1 : 2}>{title}</Text>
        {/* The concept's inline alert is a headline plus one qualifying line.
            Letting the message run to two lines is what made Home's alert twice
            the reference height. Card notices keep the extra line. */}
        {message ? <Text style={styles.message} numberOfLines={isRow ? 1 : 2}>{message}</Text> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {actionIsAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={6}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            solidAction && styles.solidAction,
            pressed && styles.pressed
          ]}
        >
          <Text
            style={[
              styles.actionLabel,
              solidAction && styles.solidActionLabel,
              !solidAction && tone === "danger" && styles.dangerActionLabel
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {onPress && !actionIsAvailable ? (
        <ChevronRight size={density.chevron} color={colors.faint} strokeWidth={iconStroke} />
      ) : null}
    </Container>
  );
}

export function RetryNotice({
  message,
  onRetry,
  title = "Could not refresh",
  retryLabel = "Retry",
  accessibilityLabel,
  ...props
}: Omit<StatusNoticeProps, "actionLabel" | "onAction" | "tone" | "title"> & {
  message: string;
  onRetry: () => void;
  title?: string;
  retryLabel?: string;
  accessibilityLabel?: string;
}) {
  return (
    <StatusNotice
      {...props}
      title={title}
      message={message}
      tone="danger"
      actionLabel={retryLabel}
      actionAccessibilityLabel={accessibilityLabel ?? retryLabel}
      onAction={onRetry}
    />
  );
}

function defaultIcon(tone: StatusNoticeTone) {
  if (tone === "success") return <CircleCheck size={icon.row} color={colors.success} strokeWidth={iconStroke} />;
  if (tone === "caution") return <TriangleAlert size={icon.row} color={colors.caution} strokeWidth={iconStroke} />;
  if (tone === "warning") return <TriangleAlert size={icon.row} color={colors.warning} strokeWidth={iconStroke} />;
  if (tone === "danger") return <CircleAlert size={icon.row} color={colors.danger} strokeWidth={iconStroke} />;
  return <Info size={icon.row} color={colors.muted} strokeWidth={iconStroke} />;
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  noticeRow: {
    paddingVertical: 10
  },
  rowIcon: {
    alignItems: "center",
    justifyContent: "center"
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  title: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  message: {
    color: colors.muted,
    ...conceptTypography.subtitle,
    marginTop: 1
  },
  meta: {
    color: colors.faint,
    ...conceptTypography.micro,
    marginTop: 2
  },
  action: {
    minHeight: density.compactButton,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  solidAction: {
    minHeight: 36,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.accent
  },
  actionLabel: {
    color: colors.accentDark,
    ...conceptTypography.button
  },
  solidActionLabel: {
    color: colors.surface
  },
  dangerActionLabel: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.62
  }
});

const noticeToneStyles = StyleSheet.create<Record<StatusNoticeTone, { backgroundColor: string; borderColor: string }>>({
  neutral: { backgroundColor: colors.surface, borderColor: colors.border },
  success: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  caution: { backgroundColor: colors.cautionSoft, borderColor: colors.cautionSoft },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }
});

const iconToneStyles = StyleSheet.create<Record<StatusNoticeTone, { backgroundColor: string }>>({
  neutral: { backgroundColor: colors.panel },
  success: { backgroundColor: colors.successSoft },
  caution: { backgroundColor: colors.cautionSoft },
  warning: { backgroundColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft }
});
