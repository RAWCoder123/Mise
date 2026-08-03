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
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { LANGUAGE_OPTIONS, translate, type AppLocale, type MessageKey } from "../../i18n/catalog";
import {
  presentLanguageSettingsSelection,
  presentPreferenceSettingsNote,
  resolvePreferenceSettingsLoadState
} from "../../services/presentation/preferenceSettingsPresentation";

type SaveStatus = { kind: "saved" | "error"; locale: AppLocale } | null;

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
  const [status, setStatus] = useState<SaveStatus>(null);

  const hubLoadState = resolvePreferenceSettingsLoadState({
    sessionReady,
    ready,
    loadError
  });
  const selection = presentLanguageSettingsSelection(hubLoadState, locale);

  async function chooseLocale(nextLocale: AppLocale) {
    if (!selection.interactive || saving || nextLocale === locale) return;
    setBusyLocale(nextLocale);
    setStatus(null);
    clearError();

    try {
      await setLocale(nextLocale);
      setStatus({ kind: "saved", locale: nextLocale });
      const language = translate(
        nextLocale,
        LANGUAGE_OPTIONS.find((option) => option.locale === nextLocale)?.translatedNameKey ?? "settings.language.english"
      );
      AccessibilityInfo.announceForAccessibility(
        translate(nextLocale, "settings.language.savedAnnouncement", { language })
      );
    } catch {
      setStatus({ kind: "error", locale: nextLocale });
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
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
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

        {!loadError && status ? (
          <View
            style={[styles.status, status.kind === "error" ? styles.statusError : styles.statusSuccess]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.statusText, status.kind === "error" ? styles.statusErrorText : styles.statusSuccessText]}>
              {status.kind === "error"
                ? t("settings.language.saveError")
                : t("settings.language.savedAnnouncement", {
                    language: LANGUAGE_OPTIONS.find((option) => option.locale === status.locale)?.nativeName ?? status.locale
                  })}
            </Text>
          </View>
        ) : null}

        <View style={styles.persistenceNote}>
          <IconBadge tone="neutral">
            <Languages size={19} color={colors.text} strokeWidth={2.2} />
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
