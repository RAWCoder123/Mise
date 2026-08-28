import { useEffect, useState } from "react";
import { router, useNavigation } from "expo-router";
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
import {
  colors,
  fontFamilies,
  icon,
  iconStroke,
  radii,
  spacing,
  typography
} from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  OPERATOR_DISPLAY_NAME_MAX_LENGTH,
  normalizeOperatorDisplayName
} from "../../services/domain/operatorDisplayName";
import { updateMyProfile } from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";

type SaveStatus = "saved" | "error" | null;

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const {
    applyOperatorDisplayName,
    isDemoMode,
    user,
    usingLocalDemo
  } = useMiseSession();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [validationKey, setValidationKey] = useState<MessageKey | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const persistenceMessageKey: MessageKey =
    usingLocalDemo || isDemoMode
      ? "settings.profile.demoPersistence"
      : user
        ? "settings.profile.hostedPersistence"
        : "settings.profile.sessionPersistence";

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function handleSave() {
    if (saving) return;
    setStatus(null);

    let normalizedName: string;
    try {
      normalizedName = normalizeOperatorDisplayName(name);
      setValidationKey(null);
    } catch {
      setValidationKey("settings.profile.error.invalidName");
      return;
    }

    if (!user) {
      setStatus("error");
      return;
    }

    if (normalizedName === (user.name ?? "").trim()) {
      setStatus("saved");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile(normalizedName);
      await applyOperatorDisplayName(updated.name);
      setName(updated.name);
      setStatus("saved");
      AccessibilityInfo.announceForAccessibility(
        t("settings.profile.savedAnnouncement", { name: updated.name })
      );
    } catch (error) {
      captureMiseError(error, {
        flow: "settings_profile",
        operation: "update_display_name",
        restaurant_id: user.restaurant_id
      });
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={t("settings.profile.title")}
      subtitle={t("settings.profile.subtitle")}
      action={
        <ActionIcon accessibilityLabel={t("common.back")} onPress={goBackToSettings}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t("settings.profile.sectionTitle")}</Text>
            <Text style={styles.sectionBody}>{t("settings.profile.sectionBody")}</Text>
          </View>

          <Card style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>{t("settings.profile.displayName")}</Text>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setStatus(null);
                  setValidationKey(null);
                }}
                accessibilityLabel={t("settings.profile.displayName")}
                autoCapitalize="words"
                autoCorrect
                editable={!saving}
                maxLength={OPERATOR_DISPLAY_NAME_MAX_LENGTH}
                placeholder={t("settings.profile.displayNamePlaceholder")}
                placeholderTextColor={colors.faint}
                style={styles.input}
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

            {validationKey ? (
              <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                {t(validationKey)}
              </Text>
            ) : null}

            <Button
              title={saving ? t("settings.profile.saving") : t("settings.profile.save")}
              onPress={() => void handleSave()}
              disabled={saving || !user}
              fullWidth
            />
          </Card>

          {saving ? (
            <View style={styles.loading} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
          ) : null}

          {status ? (
            <View
              style={[styles.status, status === "error" ? styles.statusError : styles.statusSuccess]}
              accessibilityLiveRegion="polite"
            >
              <Text
                style={[
                  styles.statusText,
                  status === "error" ? styles.statusErrorText : styles.statusSuccessText
                ]}
              >
                {status === "error"
                  ? t("settings.profile.saveError")
                  : t("settings.profile.savedAnnouncement", { name: name.trim() })}
              </Text>
            </View>
          ) : null}

          <View style={styles.persistenceNote}>
            <IconBadge tone="neutral">
              <CircleUserRound size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
            </IconBadge>
            <Text style={styles.persistenceText}>{t(persistenceMessageKey)}</Text>
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
  error: {
    color: colors.danger,
    ...typography.caption
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
    gap: spacing.md
  },
  persistenceText: {
    flex: 1,
    color: colors.muted,
    ...typography.caption
  }
});
