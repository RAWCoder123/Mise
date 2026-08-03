import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ArrowLeft, CircleUserRound } from "lucide-react-native";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, fontFamilies, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  OPERATOR_DISPLAY_NAME_MAX_LENGTH,
  normalizeOperatorDisplayName,
  resolveOperatorDisplayName
} from "../../services/domain/operatorDisplayName";
import { fetchMyDisplayName, updateMyProfile } from "../../services/miseService";
import {
  presentIdentitySettingsInteractive,
  presentIdentitySettingsNote,
  presentIdentitySettingsValuesVisible,
  resolveProfileIdentityLoadState
} from "../../services/presentation/identitySettingsPresentation";
import {
  presentProfileIdentityFormEditable,
  presentProfileIdentityNoticeCopy,
  resolveProfileIdentitySaveFailureReason,
  type ProfileIdentityNoticeReason
} from "../../services/presentation/profileIdentityFormPresentation";
import { captureMiseError } from "../../services/telemetry";

type ProfileNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const NOTICE_COPY_KEYS: Record<
  ProfileIdentityNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  invalidName: {
    title: "settings.profile.notice.invalidNameTitle",
    message: "settings.profile.error.invalidName"
  },
  missingRestaurant: {
    title: "settings.profile.notice.missingRestaurantTitle",
    message: "settings.profile.notice.missingRestaurantBody"
  },
  unknown: {
    title: "settings.profile.notice.saveFailedTitle",
    message: "settings.profile.saveError"
  },
  saved: {
    title: "settings.profile.notice.savedTitle",
    message: "settings.profile.savedAnnouncement"
  }
};

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const {
    applyOperatorDisplayName,
    isDemoMode,
    ready: sessionReady,
    restaurant,
    user,
    usingLocalDemo
  } = useMiseSession();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<ProfileNotice | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestIdRef = useRef(0);
  const loadedScopeRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const activeScopeRef = useRef<string | null>(null);
  const lastKnownNameRef = useRef(user?.name ?? "");

  const scopeKey = user?.id ?? null;
  activeScopeRef.current = scopeKey;
  lastKnownNameRef.current = name || user?.name || "";

  const hubLoadState = resolveProfileIdentityLoadState({
    sessionReady,
    loaded,
    loadError
  });
  const interactive = presentIdentitySettingsInteractive(hubLoadState);
  const valuesVisible =
    presentIdentitySettingsValuesVisible(hubLoadState) ||
    (hubLoadState === "loading" && Boolean(name || user?.name));
  const formEditable = presentProfileIdentityFormEditable(interactive, saving);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function noticeFor(
    reason: ProfileIdentityNoticeReason,
    messageParams?: Record<string, string>
  ): ProfileNotice {
    const localized = (Object.keys(NOTICE_COPY_KEYS) as ProfileIdentityNoticeReason[]).reduce(
      (acc, key) => {
        const messageKey = NOTICE_COPY_KEYS[key].message;
        acc[key] = {
          title: t(NOTICE_COPY_KEYS[key].title),
          message:
            key === "saved" && messageParams
              ? t(messageKey, messageParams)
              : t(messageKey)
        };
        return acc;
      },
      {} as Record<ProfileIdentityNoticeReason, { title: string; message: string }>
    );
    return presentProfileIdentityNoticeCopy(reason, localized);
  }

  useEffect(() => {
    if (!scopeKey) {
      loadedScopeRef.current = null;
      dirtyRef.current = false;
      setLoaded(false);
      setLoadError(false);
      setName("");
      return;
    }
    if (loadedScopeRef.current !== scopeKey) {
      dirtyRef.current = false;
      setLoaded(false);
      setLoadError(false);
      setName(user?.name ?? "");
    }
  }, [scopeKey, user?.name]);

  const load = useCallback(
    async (showLoading = false) => {
      if (!sessionReady) {
        setLoadError(false);
        setLoaded(false);
        return;
      }

      if (!scopeKey) {
        setLoadError(false);
        setLoaded(true);
        return;
      }

      const requestId = ++requestIdRef.current;
      const soft = !showLoading && loadedScopeRef.current === scopeKey;
      if (showLoading || !soft) {
        setLoaded(false);
      }
      setLoadError(false);

      try {
        const storedDisplayName = await fetchMyDisplayName();
        if (requestId !== requestIdRef.current || activeScopeRef.current !== scopeKey) return;
        const resolved = resolveOperatorDisplayName(storedDisplayName, user?.email ?? null);
        loadedScopeRef.current = scopeKey;
        if (!dirtyRef.current || showLoading) {
          setName(resolved);
        }
        await applyOperatorDisplayName(resolved);
        if (requestId !== requestIdRef.current || activeScopeRef.current !== scopeKey) return;
        dirtyRef.current = false;
        setLoaded(true);
        setLoadError(false);
      } catch (error) {
        if (requestId !== requestIdRef.current || activeScopeRef.current !== scopeKey) return;
        captureMiseError(error, {
          flow: "settings_profile",
          operation: "load_display_name",
          restaurant_id: restaurant?.id
        });
        if (soft && Boolean(lastKnownNameRef.current)) {
          setLoaded(true);
        }
        setLoadError(true);
      }
    },
    [applyOperatorDisplayName, restaurant?.id, scopeKey, sessionReady, user?.email]
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const persistenceMessageKey: MessageKey = usingLocalDemo || isDemoMode
    ? "settings.profile.demoPersistence"
    : restaurant
      ? "settings.profile.hostedPersistence"
      : "settings.profile.sessionPersistence";

  const persistenceNote = presentIdentitySettingsNote(hubLoadState, {
    loading: t("settings.profile.status.loading"),
    unavailable: t("settings.profile.status.unavailable"),
    missing: t("settings.profile.noRestaurant"),
    ready: t(persistenceMessageKey)
  });

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function handleSave() {
    if (saving || !interactive) return;
    clearNotice();

    let normalizedName: string;
    try {
      normalizedName = normalizeOperatorDisplayName(name);
    } catch {
      setNotice(noticeFor("invalidName"));
      return;
    }

    if (!restaurant?.id) {
      setNotice(noticeFor("missingRestaurant"));
      return;
    }

    if (normalizedName === (user?.name ?? "").trim()) {
      dirtyRef.current = false;
      setNotice(noticeFor("saved", { name: normalizedName }));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile(restaurant.id, normalizedName);
      await applyOperatorDisplayName(updated.name);
      setName(updated.name);
      dirtyRef.current = false;
      setNotice(noticeFor("saved", { name: updated.name }));
      AccessibilityInfo.announceForAccessibility(
        t("settings.profile.savedAnnouncement", { name: updated.name })
      );
    } catch (error) {
      captureMiseError(error, {
        flow: "settings_profile",
        operation: "update_display_name",
        restaurant_id: restaurant.id
      });
      setNotice(noticeFor(resolveProfileIdentitySaveFailureReason(error)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={t("settings.profile.title")}
      subtitle={t("settings.profile.subtitle")}
      loading={hubLoadState === "loading" && !valuesVisible}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t("settings.profile.sectionTitle")}</Text>
            <Text style={styles.sectionBody}>{t("settings.profile.sectionBody")}</Text>
          </View>

          {loadError ? (
            <RetryNotice
              title={t("settings.profile.retry.title")}
              message={t("settings.profile.retry.body")}
              onRetry={() => void load(true)}
              retryLabel={t("common.retry")}
              accessibilityLabel={t("settings.profile.retry.accessibility")}
            />
          ) : null}

          {valuesVisible ? (
            <Card style={styles.formCard}>
              <View style={styles.field}>
                <Text style={styles.label}>{t("settings.profile.displayName")}</Text>
                <TextInput
                  value={name}
                  onChangeText={(value) => {
                    dirtyRef.current = true;
                    setName(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("settings.profile.displayName")}
                  autoCapitalize="words"
                  autoCorrect
                  editable={formEditable}
                  maxLength={OPERATOR_DISPLAY_NAME_MAX_LENGTH}
                  placeholder={t("settings.profile.displayNamePlaceholder")}
                  placeholderTextColor={colors.faint}
                  style={[styles.input, !formEditable && styles.inputDisabled]}
                  textContentType="name"
                  onSubmitEditing={() => void handleSave()}
                />
                <Text style={styles.hint}>
                  {t("settings.profile.displayNameHint", {
                    max: String(OPERATOR_DISPLAY_NAME_MAX_LENGTH)
                  })}
                </Text>
              </View>

              {user?.email ? (
                <View style={styles.emailRow}>
                  <Text style={styles.emailLabel}>{t("settings.profile.email")}</Text>
                  <Text style={styles.emailValue}>{user.email}</Text>
                </View>
              ) : null}

              <Button
                title={saving ? t("settings.profile.saving") : t("settings.profile.save")}
                onPress={() => void handleSave()}
                disabled={!interactive || saving || !restaurant}
                fullWidth
              />
            </Card>
          ) : null}

          {saving ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
          ) : null}

          {!loadError && notice ? (
            <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
          ) : null}

          <View style={styles.persistenceNote}>
            <IconBadge tone="neutral">
              <CircleUserRound size={19} color={colors.text} strokeWidth={2.2} />
            </IconBadge>
            <Text style={styles.persistenceText}>{persistenceNote}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
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
  formCard: {
    gap: spacing.md
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 18
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 22
  },
  inputDisabled: {
    backgroundColor: colors.surfaceWarm,
    color: colors.muted
  },
  hint: {
    color: colors.muted,
    ...typography.caption
  },
  emailRow: {
    gap: 2
  },
  emailLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 18
  },
  emailValue: {
    color: colors.text,
    ...typography.body
  },
  loading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  loadingText: {
    color: colors.muted,
    ...typography.body
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
  }
});
