import { useEffect, useState } from "react";
import { KeyRound, LogIn } from "lucide-react-native";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { validateNewPassword } from "../../services/domain/authRecovery";
import { isSupabaseConfigured } from "../../lib/supabase";
import { captureMiseError } from "../../services/telemetry";

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
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [completed, setCompleted] = useState(false);

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
    const validationError = validateNewPassword(password);
    if (validationError) {
      setErrorKey(
        password.length < 8 ? "login.reset.error.tooShort" : "login.reset.error.invalidPassword"
      );
      return;
    }
    if (password !== confirmPassword) {
      setErrorKey("login.reset.error.mismatch");
      return;
    }

    setLoading(true);
    setErrorKey(null);
    try {
      await completePasswordReset(password);
      setCompleted(true);
    } catch (resetError) {
      captureMiseError(resetError, { flow: "password_recovery", operation: "complete" });
      setErrorKey("login.reset.error.updateFailed");
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
                  onChangeText={setPassword}
                  accessibilityLabel={t("login.reset.newPassword")}
                  autoComplete="new-password"
                  editable={!loading}
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
                  onChangeText={setConfirmPassword}
                  accessibilityLabel={t("login.reset.confirmPassword")}
                  autoComplete="new-password"
                  editable={!loading}
                  onSubmitEditing={() => void handleSubmit()}
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("login.reset.confirmPasswordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>

              {errorKey ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                  {t(errorKey)}
                </Text>
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8
  }
});
