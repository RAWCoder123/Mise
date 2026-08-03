import { useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, Bell, Check } from "lucide-react-native";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { usePressScale } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { useNotificationPreferences } from "../../contexts/NotificationPreferencesContext";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory
} from "../../services/domain/notificationPreferences";
import {
  presentNotificationSettingsSummary,
  presentPreferenceSettingsInteractive,
  presentPreferenceSettingsValuesVisible,
  resolvePreferenceSettingsLoadState
} from "../../services/presentation/preferenceSettingsPresentation";
import type { MessageKey } from "../../i18n/catalog";

const CATEGORY_COPY: Record<
  NotificationCategory,
  { titleKey: MessageKey; bodyKey: MessageKey }
> = {
  inventory: {
    titleKey: "settings.notifications.category.inventory.title",
    bodyKey: "settings.notifications.category.inventory.body"
  },
  orders: {
    titleKey: "settings.notifications.category.orders.title",
    bodyKey: "settings.notifications.category.orders.body"
  },
  waste: {
    titleKey: "settings.notifications.category.waste.title",
    bodyKey: "settings.notifications.category.waste.body"
  },
  recipes_pos: {
    titleKey: "settings.notifications.category.recipesPos.title",
    bodyKey: "settings.notifications.category.recipesPos.body"
  },
  insights: {
    titleKey: "settings.notifications.category.insights.title",
    bodyKey: "settings.notifications.category.insights.body"
  },
  setup: {
    titleKey: "settings.notifications.category.setup.title",
    bodyKey: "settings.notifications.category.setup.body"
  }
};

type SaveStatus = { kind: "saved" | "error"; category: NotificationCategory } | null;

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { ready: sessionReady } = useMiseSession();
  const {
    preferences,
    ready,
    saving,
    loadError,
    persistenceMode,
    setCategoryEnabled,
    reload,
    clearError
  } = useNotificationPreferences();
  const [busyCategory, setBusyCategory] = useState<NotificationCategory | null>(null);
  const [status, setStatus] = useState<SaveStatus>(null);

  const hubLoadState = resolvePreferenceSettingsLoadState({
    sessionReady,
    ready,
    loadError
  });
  const valuesVisible = presentPreferenceSettingsValuesVisible(hubLoadState);
  const interactive = presentPreferenceSettingsInteractive(hubLoadState);

  async function chooseCategory(category: NotificationCategory, enabled: boolean) {
    if (!interactive || saving || preferences[category] === enabled) return;
    setBusyCategory(category);
    setStatus(null);
    clearError();

    try {
      await setCategoryEnabled(category, enabled);
      setStatus({ kind: "saved", category });
      AccessibilityInfo.announceForAccessibility(
        t("settings.notifications.savedAnnouncement", {
          category: t(CATEGORY_COPY[category].titleKey),
          state: enabled ? t("common.on") : t("common.off")
        })
      );
    } catch {
      setStatus({ kind: "error", category });
    } finally {
      setBusyCategory(null);
    }
  }

  const persistenceMessageKey: MessageKey =
    persistenceMode === "demo"
      ? "settings.notifications.demoPersistence"
      : persistenceMode === "hosted"
        ? "settings.notifications.hostedPersistence"
        : "settings.notifications.sessionPersistence";

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  const mutedCount = valuesVisible
    ? NOTIFICATION_CATEGORIES.filter((category) => !preferences[category]).length
    : 0;
  const persistenceNote = presentNotificationSettingsSummary(hubLoadState, mutedCount, {
    loading: t("settings.notifications.status.loading"),
    unavailable: t("settings.notifications.status.unavailable"),
    muted: t("settings.notifications.mutedSummary", { count: String(mutedCount) }),
    persistence: t(persistenceMessageKey)
  });

  return (
    <Screen
      title={t("settings.notifications.title")}
      subtitle={t("settings.notifications.subtitle")}
      loading={hubLoadState === "loading"}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t("settings.notifications.sectionTitle")}</Text>
          <Text style={styles.sectionBody}>{t("settings.notifications.sectionBody")}</Text>
        </View>

        {loadError ? (
          <RetryNotice
            title={t("settings.notifications.retry.title")}
            message={t("settings.notifications.retry.body")}
            onRetry={() => reload(true)}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("settings.notifications.retry.accessibility")}
          />
        ) : null}

        <Card style={styles.categoryCard} accessibilityLabel={t("settings.notifications.sectionTitle")}>
          {NOTIFICATION_CATEGORIES.map((category, index) => {
            const enabled = valuesVisible ? preferences[category] : false;
            return (
              <CategoryOption
                key={category}
                title={t(CATEGORY_COPY[category].titleKey)}
                description={t(CATEGORY_COPY[category].bodyKey)}
                enabled={enabled}
                loading={saving && busyCategory === category}
                disabled={!interactive || saving}
                last={index === NOTIFICATION_CATEGORIES.length - 1}
                accessibilityLabel={t("settings.notifications.toggleAccessibility", {
                  category: t(CATEGORY_COPY[category].titleKey),
                  state: enabled ? t("common.on") : t("common.off")
                })}
                onPress={() => chooseCategory(category, !enabled)}
              />
            );
          })}
        </Card>

        {!loadError && status ? (
          <View
            style={[styles.status, status.kind === "error" ? styles.statusError : styles.statusSuccess]}
            accessibilityLiveRegion="polite"
          >
            <Text
              style={[
                styles.statusText,
                status.kind === "error" ? styles.statusErrorText : styles.statusSuccessText
              ]}
            >
              {status.kind === "error"
                ? t("settings.notifications.saveError")
                : t("settings.notifications.savedAnnouncement", {
                    category: t(CATEGORY_COPY[status.category].titleKey),
                    state: preferences[status.category] ? t("common.on") : t("common.off")
                  })}
            </Text>
          </View>
        ) : null}

        <View style={styles.persistenceNote}>
          <IconBadge tone="neutral">
            <Bell size={19} color={colors.text} strokeWidth={2.2} />
          </IconBadge>
          <Text style={styles.persistenceText}>{persistenceNote}</Text>
        </View>
      </View>
    </Screen>
  );
}

function CategoryOption({
  title,
  description,
  enabled,
  loading,
  disabled,
  last,
  accessibilityLabel,
  onPress
}: {
  title: string;
  description: string;
  enabled: boolean;
  loading: boolean;
  disabled: boolean;
  last: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      <Animated.View
        style={[styles.option, !last && styles.optionDivider, enabled && styles.optionEnabled, scaleStyle]}
      >
        <View style={styles.optionCopy}>
          <Text style={styles.optionName}>{title}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
        <View style={[styles.selection, enabled && styles.selectionEnabled]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : enabled ? (
            <Check size={18} color={colors.surface} strokeWidth={2.8} />
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg
  },
  sectionHeading: {
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle
  },
  sectionBody: {
    maxWidth: 390,
    color: colors.muted,
    ...typography.body
  },
  categoryCard: {
    overflow: "hidden",
    padding: 0
  },
  option: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface
  },
  optionEnabled: {
    backgroundColor: colors.accentSoft
  },
  optionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  optionCopy: {
    flex: 1,
    minWidth: 0
  },
  optionName: {
    color: colors.text,
    ...typography.cardTitle
  },
  optionDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  selection: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  selectionEnabled: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  status: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statusSuccess: {
    backgroundColor: colors.successSoft
  },
  statusError: {
    backgroundColor: colors.dangerSoft
  },
  statusText: {
    ...typography.caption
  },
  statusSuccessText: {
    color: colors.success
  },
  statusErrorText: {
    color: colors.danger
  },
  persistenceNote: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  persistenceText: {
    flex: 1,
    color: colors.muted,
    ...typography.body
  },
  pressed: {
    opacity: 0.72
  }
});
