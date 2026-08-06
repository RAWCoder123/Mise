import { type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";

import { colors, radii, typography } from "../../constants/theme";

export type StatusNoticeTone = "neutral" | "success" | "caution" | "warning" | "danger";
export type StatusNoticeActionVariant = "text" | "solid";

export interface StatusNoticeProps extends Omit<ViewProps, "children"> {
  title: string;
  message?: string;
  tone?: StatusNoticeTone;
  icon?: ReactNode;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  /** `solid` renders a compact filled accent button (mockup alert CTAs). */
  actionVariant?: StatusNoticeActionVariant;
  onAction?: () => void;
}

export function StatusNotice({
  title,
  message,
  tone = "neutral",
  icon,
  actionLabel,
  actionAccessibilityLabel,
  actionVariant = "text",
  onAction,
  style,
  ...props
}: StatusNoticeProps) {
  const actionIsAvailable = Boolean(actionLabel && onAction);
  const solidAction = actionVariant === "solid";

  return (
    <View
      accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
      style={[styles.notice, noticeToneStyles[tone], style]}
      {...props}
    >
      <View style={[styles.icon, iconToneStyles[tone]]}>{icon ?? defaultIcon(tone)}</View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {message ? <Text style={styles.message} numberOfLines={2}>{message}</Text> : null}
      </View>
      {actionIsAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={4}
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
    </View>
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
  if (tone === "success") return <CircleCheck size={18} color={colors.success} strokeWidth={2.25} />;
  if (tone === "caution") return <TriangleAlert size={18} color={colors.caution} strokeWidth={2.25} />;
  if (tone === "warning") return <TriangleAlert size={18} color={colors.warning} strokeWidth={2.25} />;
  if (tone === "danger") return <CircleAlert size={18} color={colors.danger} strokeWidth={2.25} />;
  return <Info size={18} color={colors.muted} strokeWidth={2.25} />;
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    ...typography.cardTitle,
    fontSize: 15,
    lineHeight: 20
  },
  message: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  action: {
    minHeight: 44,
    minWidth: 44,
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
    ...typography.button,
    fontSize: 14
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
