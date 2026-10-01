import { useState } from "react";
import { router, useNavigation } from "expo-router";
import { ArrowLeft, Check, Languages } from "lucide-react-native";
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
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { LANGUAGE_OPTIONS, translate, type AppLocale, type MessageKey } from "../../i18n/catalog";
import {
  presentLanguageSettingsNoticeCopy,
  presentLanguageSettingsSelection,
  presentPreferenceSettingsNote,
  resolvePreferenceSettingsLoadState,
  type LanguageSettingsNoticeReason
} from "../../services/presentation/preferenceSettingsPresentation";
import { captureMiseError } from "../../services/telemetry";

type LanguageNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const NOTICE_COPY_KEYS: Record<
  LanguageSettingsNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  saveFailed: {
    title: "settings.language.notice.saveFailedTitle",
    message: "settings.language.saveError"
  },
  saved: {
    title: "settings.language.notice.savedTitle",
    message: "settings.language.savedAnnouncement"
  }
};

export default function LanguageSettingsScreen() {
  const navigation = useNavigation();
  const { ready: sessionReady } = useMiseSession();
  const {
    locale,
    ready,
    saving,
    loadError,
    persistenceMode,
    setLocale,
    reload,
    clearError,
    t
  } = useLocale();
  const [busyLocale, setBusyLocale] = useState<AppLocale | null>(null);
  const [notice, setNotice] = useState<LanguageNotice | null>(null);

  const hubLoadState = resolvePreferenceSettingsLoadState({
    sessionReady,
    ready,
    loadError
  });
  const selection = presentLanguageSettingsSelection(hubLoadState, locale);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function noticeFor(
    reason: LanguageSettingsNoticeReason,
    options?: { messageParams?: Record<string, string>; locale?: AppLocale }
  ): LanguageNotice {
    const localize = (key: MessageKey, params?: Record<string, string>) =>
      options?.locale ? translate(options.locale, key, params) : t(key, params);
    const localized = (Object.keys(NOTICE_COPY_KEYS) as LanguageSettingsNoticeReason[]).reduce(
      (acc, key) => {
        const messageKey = NOTICE_COPY_KEYS[key].message;
        acc[key] = {
          title: localize(NOTICE_COPY_KEYS[key].title),
          message:
            key === "saved" && options?.messageParams
              ? localize(messageKey, options.messageParams)
              : localize(messageKey)
        };
        return acc;
      },
      {} as Record<LanguageSettingsNoticeReason, { title: string; message: string }>
    );
    return presentLanguageSettingsNoticeCopy(reason, localized);
  }

  async function chooseLocale(nextLocale: AppLocale) {
    if (!selection.interactive || saving || nextLocale === locale) return;
    setBusyLocale(nextLocale);
    clearNotice();
    clearError();

    try {
      await setLocale(nextLocale);
      const language =
        LANGUAGE_OPTIONS.find((option) => option.locale === nextLocale)?.nativeName ?? nextLocale;
      const translatedLanguage = translate(
        nextLocale,
        LANGUAGE_OPTIONS.find((option) => option.locale === nextLocale)?.translatedNameKey ??
          "settings.language.english"
      );
      setNotice(
        noticeFor("saved", {
          locale: nextLocale,
          messageParams: { language }
        })
      );
      AccessibilityInfo.announceForAccessibility(
        translate(nextLocale, "settings.language.savedAnnouncement", {
          language: translatedLanguage
        })
      );
    } catch (error) {
      captureMiseError(error, { flow: "settings_language", operation: "save" });
      setNotice(noticeFor("saveFailed"));
    } finally {
      setBusyLocale(null);
    }
  }

  const persistenceMessageKey: MessageKey =
    persistenceMode === "demo"
      ? "settings.language.demoPersistence"
      : persistenceMode === "hosted"
        ? "settings.language.hostedPersistence"
        : "settings.language.sessionPersistence";

  const persistenceNote = presentPreferenceSettingsNote(hubLoadState, {
    loading: t("settings.language.status.loading"),
    unavailable: t("settings.language.status.unavailable"),
    ready: t(persistenceMessageKey)
  });

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  return (
    <Screen
      title={t("settings.language.title")}
      subtitle={t("settings.language.subtitle")}
      loading={hubLoadState === "loading"}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t("settings.language.sectionTitle")}</Text>
          <Text style={styles.sectionBody}>{t("settings.language.sectionBody")}</Text>
        </View>

        {loadError ? (
          <RetryNotice
            title={t("settings.language.retry.title")}
            message={t("settings.language.retry.body")}
            onRetry={() => reload(true)}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("settings.language.retry.accessibility")}
          />
        ) : null}

        <Card style={styles.languageCard} accessibilityLabel={t("settings.language.sectionTitle")}>
          {LANGUAGE_OPTIONS.map((option, index) => (
            <LanguageOption
              key={option.locale}
              nativeName={option.nativeName}
              translatedName={t(option.translatedNameKey)}
              selected={selection.selectedLocale === option.locale}
              loading={saving && busyLocale === option.locale}
              disabled={!selection.interactive || saving}
              last={index === LANGUAGE_OPTIONS.length - 1}
              accessibilityLabel={t("settings.language.selectAccessibility", { language: option.nativeName })}
              onPress={() => chooseLocale(option.locale)}
            />
          ))}
        </Card>

        {!loadError && notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        <View style={styles.persistenceNote}>
          <IconBadge tone="neutral">
            <Languages size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
          </IconBadge>
          <Text style={styles.persistenceText}>{persistenceNote}</Text>
        </View>
      </View>
    </Screen>
  );
}

function LanguageOption({
  nativeName,
  translatedName,
  selected,
  loading,
  disabled,
  last,
  accessibilityLabel,
  onPress
}: {
  nativeName: string;
  translatedName: string;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  last: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      <Animated.View style={[styles.option, !last && styles.optionDivider, selected && styles.optionSelected, scaleStyle]}>
        <View style={styles.optionCopy}>
          <Text style={styles.optionName}>{nativeName}</Text>
          <Text style={styles.optionDescription}>{translatedName}</Text>
        </View>
        <View style={[styles.selection, selected && styles.selectionSelected]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : selected ? (
            <Check size={icon.row} color={colors.surface} strokeWidth={iconStroke} />
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
  languageCard: {
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
  optionSelected: {
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
  selectionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  persistenceNote: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
