import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react-native";
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
import { readPendingInviteToken } from "../../lib/pendingInvite";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  isValidSignupEmail,
  normalizeSignupEmail,
  resolvePostAuthPath,
  validateSignupPassword
} from "../../services/domain/authSignup";
import {
  presentSignupFailureCopy,
  presentSignupFormEditable,
  resolveSignupCreateFailureReason,
  resolveSignupFormFailureReason,
  type SignupFailureReason
} from "../../services/presentation/authSignupPresentation";
import { captureMiseError } from "../../services/telemetry";

type SignupNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const FAILURE_COPY_KEYS: Record<
  SignupFailureReason,
  { title: MessageKey; message: MessageKey }
> = {
  emailRequired: {
    title: "signup.notice.emailRequiredTitle",
    message: "signup.error.emailRequired"
  },
  emailInvalid: {
    title: "signup.notice.emailInvalidTitle",
    message: "signup.error.emailInvalid"
  },
  tooShort: {
    title: "signup.notice.tooShortTitle",
    message: "signup.error.tooShort"
  },
  invalidPassword: {
    title: "signup.notice.invalidPasswordTitle",
    message: "signup.error.invalidPassword"
  },
  mismatch: {
    title: "signup.notice.mismatchTitle",
    message: "signup.error.mismatch"
  },
  alreadyExists: {
    title: "signup.notice.alreadyExistsTitle",
    message: "signup.error.alreadyExists"
  },
  createFailed: {
    title: "signup.notice.createFailedTitle",
    message: "signup.error.createFailed"
  }
};

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
  const [notice, setNotice] = useState<SignupNotice | null>(null);
  const [confirmEmailNotice, setConfirmEmailNotice] = useState(false);
  const [pendingInvitePath, setPendingInvitePath] = useState<string | null>(null);
  const formEditable = presentSignupFormEditable(isSupabaseConfigured, loading);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function failureNotice(reason: SignupFailureReason): SignupNotice {
    const localized = (Object.keys(FAILURE_COPY_KEYS) as SignupFailureReason[]).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(FAILURE_COPY_KEYS[key].title),
          message: t(FAILURE_COPY_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<SignupFailureReason, { title: string; message: string }>
    );
    return presentSignupFailureCopy(reason, localized);
  }

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
    const formFailure = resolveSignupFormFailureReason({
      email,
      password,
      confirmPassword,
      isValidEmail: isValidSignupEmail,
      normalizeEmail: normalizeSignupEmail,
      validatePassword: validateSignupPassword
    });
    if (formFailure) {
      setNotice(failureNotice(formFailure));
      return;
    }

    const normalizedEmail = normalizeSignupEmail(email);
    setLoading(true);
    clearNotice();
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
      setNotice(failureNotice(resolveSignupCreateFailureReason(signUpError)));
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
                  onChangeText={(value) => {
                    setEmail(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("signup.form.email")}
                  accessibilityHint={t("signup.form.emailHint")}
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={formEditable}
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
                  onChangeText={(value) => {
                    setPassword(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("signup.form.password")}
                  accessibilityHint={t("signup.form.passwordHint")}
                  autoComplete="new-password"
                  editable={formEditable}
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
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    clearNotice();
                  }}
                  accessibilityLabel={t("signup.form.confirmPassword")}
                  autoComplete="new-password"
                  editable={formEditable}
                  onSubmitEditing={() => void handleSignUp()}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("signup.form.confirmPasswordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>

              {notice ? (
                <StatusNotice
                  tone={notice.tone}
                  title={notice.title}
                  message={notice.message}
                  style={styles.notice}
                />
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
  notice: {
    marginVertical: 12
  }
});
