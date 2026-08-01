import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react-native";
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
import { readPendingInviteToken } from "../../lib/pendingInvite";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  isValidSignupEmail,
  normalizeSignupEmail,
  resolvePostAuthPath,
  validateSignupPassword
} from "../../services/domain/authSignup";
import { captureMiseError } from "../../services/telemetry";

export default function SignupScreen() {
  const { t } = useLocale();
  const {
    passwordRecoveryPending,
    ready,
    restaurant,
    signUp,
    user
  } = useMiseSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [confirmEmailNotice, setConfirmEmailNotice] = useState(false);
  const [pendingInvitePath, setPendingInvitePath] = useState<string | null>(null);

  useEffect(() => {
    void readPendingInviteToken().then((token) => {
      setPendingInvitePath(token ? resolvePostAuthPath({ pendingInviteToken: token }) : null);
    });
  }, []);

  useEffect(() => {
    if (!ready || loading || confirmEmailNotice) return;
    if (passwordRecoveryPending) {
      router.replace("/reset-password");
      return;
    }
    if (!user) return;

    void (async () => {
      const pendingInviteToken = await readPendingInviteToken();
      router.replace(
        resolvePostAuthPath({
          pendingInviteToken,
          hasRestaurant: Boolean(restaurant)
        })
      );
    })();
  }, [confirmEmailNotice, loading, passwordRecoveryPending, ready, restaurant, user]);

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  async function handleSignUp() {
    const normalizedEmail = normalizeSignupEmail(email);
    if (!normalizedEmail) {
      setErrorKey("signup.error.emailRequired");
      return;
    }
    if (!isValidSignupEmail(normalizedEmail)) {
      setErrorKey("signup.error.emailInvalid");
      return;
    }
    const passwordError = validateSignupPassword(password);
    if (passwordError) {
      setErrorKey(password.length < 8 ? "signup.error.tooShort" : "signup.error.invalidPassword");
      return;
    }
    if (password !== confirmPassword) {
      setErrorKey("signup.error.mismatch");
      return;
    }

    setLoading(true);
    setErrorKey(null);
    setConfirmEmailNotice(false);
    try {
      const outcome = await signUp(normalizedEmail, password);
      if (outcome.status === "confirm_email") {
        setConfirmEmailNotice(true);
        return;
      }
      const pendingInviteToken = await readPendingInviteToken();
      router.replace(
        resolvePostAuthPath({
          pendingInviteToken,
          hasRestaurant: Boolean(restaurant)
        })
      );
    } catch (signUpError) {
      captureMiseError(signUpError, { flow: "signup", operation: "sign_up" });
      const message = signUpError instanceof Error ? signUpError.message : "";
      if (/already exists|already registered|User already registered/i.test(message)) {
        setErrorKey("signup.error.alreadyExists");
      } else {
        setErrorKey("signup.error.createFailed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll title={t("signup.title")} subtitle={t("signup.subtitle")}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          {!isSupabaseConfigured ? (
            <StatusNotice title={t("signup.cloudRequired")} tone="caution" />
          ) : null}

          {pendingInvitePath ? (
            <StatusNotice title={t("signup.inviteHint")} tone="neutral" />
          ) : null}

          {confirmEmailNotice ? (
            <Card>
              <StatusNotice title={t("signup.confirmEmail.title")} tone="success" />
              <Text style={styles.copy}>{t("signup.confirmEmail.body")}</Text>
              <Button
                title={t("signup.action.signIn")}
                onPress={() => router.replace("/login")}
                fullWidth
              />
            </Card>
          ) : (
            <Card>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                {t("signup.form.title")}
              </Text>
              <Text style={styles.copy}>{t("signup.form.body")}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{t("signup.form.email")}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel={t("signup.form.email")}
                  accessibilityHint={t("signup.form.emailHint")}
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!loading && isSupabaseConfigured}
                  keyboardType="email-address"
                  returnKeyType="next"
                  style={styles.input}
                  placeholder="teammate@restaurant.com"
                  placeholderTextColor={colors.faint}
                  textContentType="username"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("signup.form.password")}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel={t("signup.form.password")}
                  accessibilityHint={t("signup.form.passwordHint")}
                  autoComplete="new-password"
                  editable={!loading && isSupabaseConfigured}
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("signup.form.passwordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t("signup.form.confirmPassword")}</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  accessibilityLabel={t("signup.form.confirmPassword")}
                  autoComplete="new-password"
                  editable={!loading && isSupabaseConfigured}
                  onSubmitEditing={() => void handleSignUp()}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("signup.form.confirmPasswordPlaceholder")}
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
                title={
                  !isSupabaseConfigured
                    ? t("signup.action.cloudUnavailable")
                    : loading
                      ? t("signup.action.creating")
                      : t("signup.action.create")
                }
                icon={<UserPlus size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={() => void handleSignUp()}
                disabled={loading || !isSupabaseConfigured}
                fullWidth
              />
              <Button
                title={t("signup.action.signIn")}
                variant="ghost"
                onPress={() => router.replace("/login")}
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
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6
  },
  field: {
    marginTop: 16
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 12
  }
});
