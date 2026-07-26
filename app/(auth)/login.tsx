import { useEffect, useState } from "react";
import { BookOpen, ChefHat, ClipboardCheck, LogIn, MailCheck, PackageCheck, PlugZap, UserPlus } from "lucide-react-native";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OperationsFlow } from "../../components/ui/OperationsFlow";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { getInitialLoginCredentials } from "../../lib/appConfig";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  isUserAlreadyRegisteredError,
  validateSignUpInput,
  type SignUpValidationError
} from "../../services/domain/accountAuth";
import { DEMO_DATASET } from "../../services/demoData";
import { captureMiseError } from "../../services/telemetry";

type AuthMode = "signIn" | "signUp";

const signUpValidationKeys: Record<SignUpValidationError, MessageKey> = {
  email_required: "login.error.emailRequired",
  email_invalid: "login.error.emailInvalid",
  password_too_short: "login.error.passwordTooShort",
  password_mismatch: "login.error.passwordMismatch"
};

export default function LoginScreen() {
  const { formatNumber, t } = useLocale();
  const { canUseDemoMode, continueWithDemo, ready, restaurant, signIn, signUp, user, usingLocalDemo } = useMiseSession();
  const initialCredentials = getInitialLoginCredentials();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState(initialCredentials.email);
  const [password, setPassword] = useState(initialCredentials.password);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (restaurant) {
      router.replace("/home");
    } else if (user) {
      router.replace("/setup");
    }
  }, [ready, restaurant, user]);

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  async function handleSignIn() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorKey("login.error.emailRequired");
      return;
    }
    if (!password) {
      setErrorKey("login.error.passwordRequired");
      return;
    }

    setLoading(true);
    setErrorKey(null);
    try {
      await signIn(normalizedEmail, password);
      router.replace("/");
    } catch (signInError) {
      captureMiseError(signInError, { flow: "login", operation: "sign_in" });
      setErrorKey("login.error.signIn");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    const normalizedEmail = email.trim();
    const validationError = validateSignUpInput(normalizedEmail, password, confirmPassword);
    if (validationError) {
      setErrorKey(signUpValidationKeys[validationError]);
      return;
    }

    setLoading(true);
    setErrorKey(null);
    try {
      const outcome = await signUp(normalizedEmail, password);
      if (outcome === "already_registered") {
        setErrorKey("login.error.alreadyRegistered");
        return;
      }
      if (outcome === "confirmation_required") {
        setConfirmationEmail(normalizedEmail);
        setConfirmPassword("");
        return;
      }
      router.replace("/");
    } catch (signUpError) {
      if (isUserAlreadyRegisteredError(signUpError)) {
        setErrorKey("login.error.alreadyRegistered");
        return;
      }
      captureMiseError(signUpError, { flow: "login", operation: "sign_up" });
      setErrorKey("login.error.signUp");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    if (loading) return;
    setMode(nextMode);
    setErrorKey(null);
    setConfirmPassword("");
  }

  function backToSignIn() {
    setConfirmationEmail(null);
    setMode("signIn");
    setPassword("");
    setConfirmPassword("");
    setErrorKey(null);
  }

  async function handleDemo() {
    setLoading(true);
    setErrorKey(null);
    try {
      await continueWithDemo({
        preset: DEMO_DATASET.id,
        name: DEMO_DATASET.restaurant.name,
        cuisine_type: DEMO_DATASET.restaurant.cuisineType,
        posProvider: DEMO_DATASET.defaultPosProvider
      });
      router.replace("/home");
    } catch (demoError) {
      captureMiseError(demoError, { flow: "login", operation: "open_demo" });
      setErrorKey("login.error.demo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <OperationalHero
            eyebrow={t("login.hero.eyebrow")}
            title={t("login.hero.title")}
            body={t("login.hero.body")}
            meta={usingLocalDemo || !isSupabaseConfigured ? t("login.hero.metaDemo") : t("login.hero.metaCloud")}
            icon={<ChefHat size={21} color={colors.accent} strokeWidth={2.6} />}
            stats={[
              { label: t("login.stat.recipes"), value: t("login.stat.recipesValue"), tone: "brand" },
              { label: t("login.stat.pos"), value: t("login.stat.posValue"), tone: "neutral" },
              { label: t("login.stat.orders"), value: t("login.stat.ordersValue"), tone: "neutral" }
            ]}
          />

          <Card>
            {confirmationEmail ? (
              <View>
                <View style={styles.confirmHeader}>
                  <MailCheck size={22} color={colors.success} strokeWidth={2.4} />
                  <Text accessibilityRole="header" style={styles.cardTitle}>{t("login.confirm.title")}</Text>
                </View>
                <Text accessibilityLiveRegion="polite" style={styles.cardCopy}>
                  {t("login.confirm.body", { email: confirmationEmail })}
                </Text>
                <Button
                  title={t("login.confirm.back")}
                  variant="secondary"
                  onPress={backToSignIn}
                  fullWidth
                  style={styles.confirmBack}
                />
              </View>
            ) : (
              <View>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {mode === "signIn" ? t("login.form.title") : t("login.signUp.title")}
            </Text>
            <Text style={styles.cardCopy}>
              {mode === "signIn" ? t("login.form.body") : t("login.signUp.body")}
            </Text>
            <SegmentedControl
              accessibilityLabel={t("login.mode.toggleAccessibility")}
              options={[
                { value: "signIn", label: t("login.mode.signIn") },
                { value: "signUp", label: t("login.mode.signUp") }
              ]}
              value={mode}
              onValueChange={switchMode}
              style={styles.modeToggle}
            />
            <View style={styles.field}>
              <Text style={styles.label}>{t("login.form.email")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                accessibilityLabel={t("login.form.email")}
                accessibilityHint={t("login.form.emailHint")}
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
                keyboardType="email-address"
                returnKeyType="next"
                style={styles.input}
                placeholder="owner@restaurant.com"
                placeholderTextColor={colors.faint}
                textContentType="username"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t("login.form.password")}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                accessibilityLabel={t("login.form.password")}
                accessibilityHint={mode === "signIn" ? t("login.form.passwordHint") : t("login.form.newPasswordHint")}
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                editable={!loading}
                onSubmitEditing={mode === "signIn" ? () => void handleSignIn() : undefined}
                returnKeyType={mode === "signIn" ? "go" : "next"}
                secureTextEntry
                style={styles.input}
                placeholder={t("login.form.passwordPlaceholder")}
                placeholderTextColor={colors.faint}
                textContentType={mode === "signIn" ? "password" : "newPassword"}
              />
            </View>
            {mode === "signUp" ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("login.form.confirmPassword")}</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  accessibilityLabel={t("login.form.confirmPassword")}
                  accessibilityHint={t("login.form.confirmPasswordHint")}
                  autoComplete="new-password"
                  editable={!loading}
                  onSubmitEditing={() => void handleSignUp()}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  placeholder={t("login.form.passwordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="newPassword"
                />
              </View>
            ) : null}
            {errorKey ? (
              <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                {t(errorKey)}
              </Text>
            ) : null}
            {mode === "signIn" ? (
              <Button
                title={!isSupabaseConfigured ? t("login.action.cloudUnavailable") : loading ? t("login.action.opening") : t("login.action.signIn")}
                icon={<LogIn size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={handleSignIn}
                disabled={loading || !isSupabaseConfigured}
                fullWidth
              />
            ) : (
              <Button
                title={!isSupabaseConfigured ? t("login.action.cloudUnavailable") : loading ? t("login.action.creating") : t("login.action.signUp")}
                icon={<UserPlus size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={handleSignUp}
                disabled={loading || !isSupabaseConfigured}
                fullWidth
              />
            )}
            {canUseDemoMode && (
              <View style={styles.demoPanel}>
                <Text style={styles.demoKicker}>{t("login.demo.eyebrow")}</Text>
                <Text accessibilityRole="header" style={styles.demoTitle}>{t("login.demo.title")}</Text>
                <Text style={styles.demoCopy}>{t("login.demo.body")}</Text>
                <Button
                  title={loading ? t("login.demo.opening") : t("login.demo.open")}
                  variant="secondary"
                  onPress={handleDemo}
                  disabled={loading}
                  fullWidth
                  style={styles.demoButton}
                />
                <Button
                  title={t("login.demo.customize")}
                  variant="ghost"
                  onPress={() => router.replace("/setup")}
                  disabled={loading}
                  fullWidth
                />
              </View>
            )}
              </View>
            )}
          </Card>

          <OperationsFlow
            title={t("login.flow.title")}
            subtitle={t("login.flow.subtitle")}
            steps={[
              {
                label: t("login.flow.recipe.label"),
                value: formatNumber(1),
                detail: t("login.flow.recipe.detail"),
                icon: <BookOpen size={18} color={colors.accentDark} strokeWidth={2.4} />,
                tone: "brand"
              },
              {
                label: t("login.flow.pos.label"),
                value: formatNumber(2),
                detail: t("login.flow.pos.detail"),
                icon: <PlugZap size={18} color={colors.text} strokeWidth={2.4} />,
                tone: "neutral"
              },
              {
                label: t("login.flow.inventory.label"),
                value: formatNumber(3),
                detail: t("login.flow.inventory.detail"),
                icon: <PackageCheck size={18} color={colors.text} strokeWidth={2.4} />
              },
              {
                label: t("login.flow.orders.label"),
                value: formatNumber(4),
                detail: t("login.flow.orders.detail"),
                icon: <ClipboardCheck size={18} color={colors.accentDark} strokeWidth={2.4} />,
                tone: "brand"
              }
            ]}
          />

          <Text style={styles.modeNote}>
            {usingLocalDemo || !isSupabaseConfigured
              ? t("login.mode.demo")
              : t("login.mode.cloud")}
          </Text>
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
  cardCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6
  },
  field: {
    marginTop: 16
  },
  modeToggle: {
    marginTop: 14
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  confirmBack: {
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
  demoButton: {
    marginTop: 10
  },
  demoPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    marginTop: 14,
    padding: 12
  },
  demoKicker: {
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  demoTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 4
  },
  demoCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 12
  },
  modeNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 12
  }
});
