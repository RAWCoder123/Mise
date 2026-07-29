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
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
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
  if (tone === "success") return <CircleCheck size={20} color={colors.success} strokeWidth={2.25} />;
  if (tone === "caution") return <TriangleAlert size={20} color={colors.caution} strokeWidth={2.25} />;
  if (tone === "warning") return <TriangleAlert size={20} color={colors.warning} strokeWidth={2.25} />;
  if (tone === "danger") return <CircleAlert size={20} color={colors.danger} strokeWidth={2.25} />;
  return <Info size={20} color={colors.muted} strokeWidth={2.25} />;
}

const styles = StyleSheet.create({
  notice: {
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 14,
    lineHeight: 19
  },
  message: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
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
    minHeight: 32,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.accent
  },
  actionLabel: {
    color: colors.accentDark,
    ...typography.button
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
  success: { backgroundColor: colors.successSoft, borderColor: colors.success },
  caution: { backgroundColor: colors.cautionSoft, borderColor: colors.caution },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger }
});

const iconToneStyles = StyleSheet.create<Record<StatusNoticeTone, { backgroundColor: string }>>({
  neutral: { backgroundColor: colors.surfaceWarm },
  success: { backgroundColor: colors.successSoft },
  caution: { backgroundColor: colors.cautionSoft },
  warning: { backgroundColor: colors.warningSoft },
  danger: { backgroundColor: colors.dangerSoft }
});
