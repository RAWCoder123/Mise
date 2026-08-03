import { useEffect, useState } from "react";
import { KeyRound, LogIn } from "lucide-react-native";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { validateNewPassword } from "../../services/domain/authRecovery";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  presentResetFailureCopy,
  presentResetFormEditable,
  resolveResetFormFailureReason,
  type ResetFailureReason
} from "../../services/presentation/authResetPresentation";
import { captureMiseError } from "../../services/telemetry";

type ResetNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const FAILURE_COPY_KEYS: Record<ResetFailureReason, { title: MessageKey; message: MessageKey }> = {
  tooShort: {
    title: "login.reset.notice.tooShortTitle",
    message: "login.reset.error.tooShort"
  },
  invalidPassword: {
    title: "login.reset.notice.invalidPasswordTitle",
    message: "login.reset.error.invalidPassword"
  },
  mismatch: {
    title: "login.reset.notice.mismatchTitle",
    message: "login.reset.error.mismatch"
  },
  updateFailed: {
    title: "login.reset.notice.updateFailedTitle",
    message: "login.reset.error.updateFailed"
  }
};

export default function ResetPasswordScreen() {
  const { t } = useLocale();
  const {
    clearPasswordRecovery,
    completePasswordReset,
    passwordRecoveryPending,
    ready,
    restaurant,
    user
  } = useMiseSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ResetNotice | null>(null);
  const [completed, setCompleted] = useState(false);
  const formEditable = presentResetFormEditable(
    isSupabaseConfigured,
    loading,
    passwordRecoveryPending
  );

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function failureNotice(reason: ResetFailureReason): ResetNotice {
    const localized = (Object.keys(FAILURE_COPY_KEYS) as ResetFailureReason[]).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(FAILURE_COPY_KEYS[key].title),
          message: t(FAILURE_COPY_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<ResetFailureReason, { title: string; message: string }>
    );
    return presentResetFailureCopy(reason, localized);
  }

  useEffect(() => {
    if (!ready || loading || completed) return;
    if (!passwordRecoveryPending) {
      if (restaurant) router.replace("/today");
      else if (user) router.replace("/setup");
      else router.replace("/login");
    }
  }, [completed, loading, passwordRecoveryPending, ready, restaurant, user]);

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  async function handleSubmit() {
    const formFailure = resolveResetFormFailureReason({
      password,
      confirmPassword,
      validatePassword: validateNewPassword
    });
    if (formFailure) {
      setNotice(failureNotice(formFailure));
      return;
    }

    setLoading(true);
    clearNotice();
    try {
      await completePasswordReset(password);
      setCompleted(true);
    } catch (resetError) {
      captureMiseError(resetError, { flow: "password_recovery", operation: "complete" });
      setNotice(failureNotice("updateFailed"));
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    if (restaurant) router.replace("/today");
    else if (user) router.replace("/setup");
    else router.replace("/login");
  }

  function handleCancel() {
    clearPasswordRecovery();
    router.replace("/login");
  }

  return (
    <Screen scroll title={t("login.reset.title")} subtitle={t("login.reset.subtitle")}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          {!isSupabaseConfigured ? (
            <StatusNotice title={t("login.reset.cloudRequired")} tone="caution" />
          ) : null}

          {completed ? (
            <Card>
              <StatusNotice title={t("login.reset.success")} tone="success" />
              <Text style={styles.copy}>{t("login.reset.successBody")}</Text>
              <Button
                title={t("login.reset.continue")}
                icon={<LogIn size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={handleContinue}
                fullWidth
              />
            </Card>
          ) : (
            <Card>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                {t("login.reset.formTitle")}
              </Text>
              <Text style={styles.copy}>{t("login.reset.formBody")}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{t("login.reset.newPassword")}</Text>
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("login.reset.newPassword")}
                  autoComplete="new-password"
                  editable={formEditable}
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("login.reset.newPasswordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("login.reset.confirmPassword")}</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("login.reset.confirmPassword")}
                  autoComplete="new-password"
                  editable={formEditable}
                  onSubmitEditing={() => void handleSubmit()}
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("login.reset.confirmPasswordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>

              {notice ? (
                <StatusNotice
                  tone={notice.tone}
                  title={notice.title}
                  message={notice.message}
                  style={styles.statusNotice}
                />
              ) : null}

              <Button
                title={loading ? t("login.reset.saving") : t("login.reset.save")}
                icon={<KeyRound size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={() => void handleSubmit()}
                disabled={loading || !isSupabaseConfigured || !passwordRecoveryPending}
                fullWidth
              />
              <Button
                title={t("login.reset.cancel")}
                variant="ghost"
                onPress={handleCancel}
                disabled={loading}
                fullWidth
              />
            </Card>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8
  },
  field: {
    gap: 6,
    marginTop: 8
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  statusNotice: {
    marginTop: 8,
    marginBottom: 4
  }
});
