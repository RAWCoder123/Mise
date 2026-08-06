import { useEffect, useState } from "react";
import { X } from "lucide-react-native";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { BrandLockup } from "../../components/ui/BrandLockup";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { getInitialLoginCredentials } from "../../lib/appConfig";
import { isSupabaseConfigured } from "../../lib/supabase";
import { DEMO_DATASET } from "../../services/demoData";
import { captureMiseError } from "../../services/telemetry";

type LoginStep = "identity" | "password";

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path
        fill={colors.text}
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <Path
        fill={colors.text}
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z"
      />
      <Path
        fill={colors.text}
        d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.17.28-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
      />
      <Path
        fill={colors.text}
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path
        fill={colors.text}
        d="M14.7 12.2c-.25.58-.37.84-.7 1.35-.45.72-.1.1-.1.1-.54.87-1.16 1.95-2.05 1.96-.78.02-1 .5-1.9.5s-1.15-.48-1.92-.5c-.86-.02-1.52-1.05-2.07-1.92-1.2-1.92-2.11-5.43-.88-7.4.6-.96 1.58-1.57 2.5-1.57.8 0 1.46.54 1.91.54s1.4-.67 2.43-.57c.41.02 1.57.17 2.31 1.26-.06.04-1.38.8-1.36 2.4.02 1.9 1.67 2.53 1.7 2.54-.02.05-.26.9-.47 1.41zM11.9 2.9c.42-.53.73-1.27.65-2.01-.63.03-1.4.43-1.85.96-.4.46-.76 1.2-.66 1.91.7.05 1.42-.35 1.86-.86z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { t } = useLocale();
  const { canUseDemoMode, continueWithDemo, ready, restaurant, signIn, signInWithProvider, user, usingLocalDemo } =
    useMiseSession();
  const initialCredentials = getInitialLoginCredentials();
  const [step, setStep] = useState<LoginStep>("identity");
  const [email, setEmail] = useState(initialCredentials.email);
  const [password, setPassword] = useState(initialCredentials.password);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

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

  async function handleContinue() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorKey("login.error.emailRequired");
      return;
    }
    setErrorKey(null);
    setStep("password");
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

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(true);
    setErrorKey(null);
    try {
      await signInWithProvider(provider);
      if (Platform.OS !== "web") {
        router.replace("/");
      }
    } catch (oauthError) {
      captureMiseError(oauthError, { flow: "login", operation: `oauth_${provider}` });
      setErrorKey("login.error.oauth");
    } finally {
      setLoading(false);
    }
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

  const cloudUnavailable = !isSupabaseConfigured;

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.stack}>
          <View style={styles.brand}>
            <BrandLockup size="default" />
          </View>

          <Text accessibilityRole="header" style={styles.title}>
            {t("login.form.title")}
          </Text>
          <Text style={styles.subtitle}>{t("login.form.body")}</Text>
          <Text style={styles.inviteNote}>{t("login.invite.supportHint")}</Text>

          {step === "identity" ? (
            <>
              <View style={styles.field}>
                <View style={styles.inputShell}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    accessibilityLabel={t("login.form.email")}
                    accessibilityHint={t("login.form.emailHint")}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!loading}
                    keyboardType="email-address"
                    onSubmitEditing={() => void handleContinue()}
                    returnKeyType="next"
                    style={styles.input}
                    placeholder={t("login.form.emailPlaceholder")}
                    placeholderTextColor={colors.faint}
                    textContentType="username"
                  />
                  {email.length > 0 ? (
                    <Pressable
                      accessibilityLabel={t("login.form.clearEmail")}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setEmail("")}
                      style={styles.clearButton}
                    >
                      <X size={16} color={colors.faint} strokeWidth={2.4} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {errorKey ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                  {t(errorKey)}
                </Text>
              ) : null}

              <Button
                title={
                  cloudUnavailable
                    ? t("login.action.cloudUnavailable")
                    : loading
                      ? t("login.action.opening")
                      : t("login.action.continue")
                }
                onPress={handleContinue}
                disabled={loading || cloudUnavailable}
                fullWidth
                style={styles.primaryButton}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>{t("login.divider.or")}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("login.action.google")}
                disabled={loading || cloudUnavailable}
                onPress={() => void handleOAuth("google")}
                style={({ pressed }) => [
                  styles.socialButton,
                  (loading || cloudUnavailable) && styles.socialDisabled,
                  pressed && !loading && styles.socialPressed
                ]}
              >
                <GoogleMark />
                <Text style={styles.socialLabel}>{t("login.action.google")}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("login.action.apple")}
                disabled={loading || cloudUnavailable}
                onPress={() => void handleOAuth("apple")}
                style={({ pressed }) => [
                  styles.socialButton,
                  (loading || cloudUnavailable) && styles.socialDisabled,
                  pressed && !loading && styles.socialPressed
                ]}
              >
                <AppleMark />
                <Text style={styles.socialLabel}>{t("login.action.apple")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>{t("login.form.email")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("login.action.editEmail")}
                  onPress={() => {
                    setStep("identity");
                    setPassword("");
                    setErrorKey(null);
                  }}
                  style={styles.emailChip}
                >
                  <Text style={styles.emailChipText}>{email.trim()}</Text>
                </Pressable>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t("login.form.password")}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel={t("login.form.password")}
                  accessibilityHint={t("login.form.passwordHint")}
                  autoComplete="current-password"
                  editable={!loading}
                  onSubmitEditing={() => void handleSignIn()}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.inputStandalone}
                  placeholder={t("login.form.passwordPlaceholder")}
                  placeholderTextColor={colors.faint}
                  textContentType="password"
                />
              </View>

              {errorKey ? (
                <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
                  {t(errorKey)}
                </Text>
              ) : null}

              <Button
                title={
                  cloudUnavailable
                    ? t("login.action.cloudUnavailable")
                    : loading
                      ? t("login.action.opening")
                      : t("login.action.signIn")
                }
                onPress={handleSignIn}
                disabled={loading || cloudUnavailable}
                fullWidth
                style={styles.primaryButton}
              />
            </>
          )}

          {canUseDemoMode ? (
            <View style={styles.demoPanel}>
              <Text style={styles.demoKicker}>{t("login.demo.eyebrow")}</Text>
              <Text accessibilityRole="header" style={styles.demoTitle}>
                {t("login.demo.title")}
              </Text>
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
          ) : null}

          <Text style={styles.modeNote}>
            {usingLocalDemo || cloudUnavailable ? t("login.mode.demo") : t("login.mode.cloud")}
          </Text>

          <View style={styles.legalRow}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("login.legal.privacyAccessibility")}
              accessibilityHint={t("login.legal.privacyHint")}
              onPress={() => router.push("/settings/privacy" as never)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
            >
              <Text style={styles.legalLinkText}>{t("login.legal.privacy")}</Text>
            </Pressable>
            <Text style={styles.legalSeparator} accessible={false}>
              ·
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("login.legal.supportAccessibility")}
              accessibilityHint={t("login.legal.supportHint")}
              onPress={() => router.push("/settings/support" as never)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.legalLinkPressed]}
            >
              <Text style={styles.legalLinkText}>{t("login.legal.support")}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 0,
    paddingTop: 12,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center"
  },
  brand: {
    alignItems: "center",
    marginBottom: 28
  },
  title: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center"
  },
  inviteNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 22,
    textAlign: "center"
  },
  field: {
    marginTop: 4
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center"
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12
  },
  inputStandalone: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  emailChip: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 14,
    justifyContent: "center"
  },
  emailChipText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.families.semibold
  },
  primaryButton: {
    marginTop: 14
  },
  dividerRow: {
    marginTop: 22,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong
  },
  dividerLabel: {
    color: colors.faint,
    fontSize: 13,
    fontWeight: "600"
  },
  socialButton: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10
  },
  socialPressed: {
    backgroundColor: colors.surfaceWarm
  },
  socialDisabled: {
    opacity: 0.45
  },
  socialLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: typography.families.semibold,
    fontWeight: "700"
  },
  demoButton: {
    marginTop: 10
  },
  demoPanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 18,
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
    marginTop: 12
  },
  modeNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 12
  },
  legalRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12
  },
  legalLink: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm
  },
  legalLinkPressed: {
    backgroundColor: colors.surfaceWarm
  },
  legalLinkText: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: "underline"
  },
  legalSeparator: {
    color: colors.faint,
    fontSize: 13,
    lineHeight: 18
  }
});
