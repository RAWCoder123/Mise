import { useEffect, useState } from "react";
import { BookOpen, ChefHat, ClipboardCheck, LogIn, PackageCheck, PlugZap } from "lucide-react-native";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OperationsFlow } from "../../components/ui/OperationsFlow";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import { getInitialLoginCredentials } from "../../lib/appConfig";
import { readPendingInviteToken } from "../../lib/pendingInvite";
import { isSupabaseConfigured } from "../../lib/supabase";
import { DEMO_DATASET } from "../../services/demoData";
import { resolvePostAuthPath } from "../../services/domain/authSignup";
import {
  presentLoginFormEditable,
  presentLoginNoticeCopy,
  resolveLoginResetRequestFailureReason,
  resolveLoginSignInFailureReason,
  type LoginNoticeReason
} from "../../services/presentation/authLoginPresentation";
import { captureMiseError } from "../../services/telemetry";

type LoginNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const NOTICE_COPY_KEYS: Record<LoginNoticeReason, { title: MessageKey; message: MessageKey }> = {
  emailRequired: {
    title: "login.notice.emailRequiredTitle",
    message: "login.error.emailRequired"
  },
  passwordRequired: {
    title: "login.notice.passwordRequiredTitle",
    message: "login.error.passwordRequired"
  },
  signInFailed: {
    title: "login.notice.signInFailedTitle",
    message: "login.error.signIn"
  },
  demoFailed: {
    title: "login.notice.demoFailedTitle",
    message: "login.error.demo"
  },
  resetRequestFailed: {
    title: "login.notice.resetRequestFailedTitle",
    message: "login.reset.error.requestFailed"
  },
  resetSent: {
    title: "login.notice.resetSentTitle",
    message: "login.reset.sent"
  }
};

export default function LoginScreen() {
  const { formatNumber, t } = useLocale();
  const {
    canUseDemoMode,
    continueWithDemo,
    passwordRecoveryPending,
    ready,
    requestPasswordReset,
    restaurant,
    signIn,
    user,
    usingLocalDemo
  } = useMiseSession();
  const initialCredentials = getInitialLoginCredentials();
  const [email, setEmail] = useState(initialCredentials.email);
  const [password, setPassword] = useState(initialCredentials.password);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notice, setNotice] = useState<LoginNotice | null>(null);
  const formEditable = presentLoginFormEditable(isSupabaseConfigured, loading);

  function clearNotice() {
    if (notice) setNotice(null);
  }

  function noticeFor(reason: LoginNoticeReason): LoginNotice {
    const localized = (Object.keys(NOTICE_COPY_KEYS) as LoginNoticeReason[]).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(NOTICE_COPY_KEYS[key].title),
          message: t(NOTICE_COPY_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<LoginNoticeReason, { title: string; message: string }>
    );
    return presentLoginNoticeCopy(reason, localized);
  }

  useEffect(() => {
    if (!ready || loading) return;
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
  }, [loading, passwordRecoveryPending, ready, restaurant, user]);

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  async function handleSignIn() {
    const formFailure = resolveLoginSignInFailureReason({ email, password });
    if (formFailure) {
      setNotice(noticeFor(formFailure));
      return;
    }

    const normalizedEmail = email.trim();
    setLoading(true);
    clearNotice();
    try {
      await signIn(normalizedEmail, password);
      const pendingInviteToken = await readPendingInviteToken();
      router.replace(
        resolvePostAuthPath({
          pendingInviteToken,
          hasRestaurant: Boolean(restaurant)
        })
      );
    } catch (signInError) {
      captureMiseError(signInError, { flow: "login", operation: "sign_in" });
      setNotice(noticeFor("signInFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setLoading(true);
    clearNotice();
    try {
      await continueWithDemo({
        preset: DEMO_DATASET.id,
        name: DEMO_DATASET.restaurant.name,
        cuisine_type: DEMO_DATASET.restaurant.cuisineType,
        posProvider: DEMO_DATASET.defaultPosProvider
      });
      router.replace("/today");
    } catch (demoError) {
      captureMiseError(demoError, { flow: "login", operation: "open_demo" });
      setNotice(noticeFor("demoFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const formFailure = resolveLoginResetRequestFailureReason({ email });
    if (formFailure) {
      setNotice(noticeFor(formFailure));
      return;
    }

    const normalizedEmail = email.trim();
    setLoading(true);
    clearNotice();
    setResetSent(false);
    try {
      await requestPasswordReset(normalizedEmail);
      setResetSent(true);
      setNotice(noticeFor("resetSent"));
    } catch (resetError) {
      captureMiseError(resetError, { flow: "login", operation: "password_reset" });
      setNotice(noticeFor("resetRequestFailed"));
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
            <Text accessibilityRole="header" style={styles.cardTitle}>{t("login.form.title")}</Text>
            <Text style={styles.cardCopy}>{t("login.form.body")}</Text>
            <View style={styles.field}>
              <Text style={styles.label}>{t("login.form.email")}</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearNotice();
                }}
                accessibilityLabel={t("login.form.email")}
                accessibilityHint={t("login.form.emailHint")}
                autoCapitalize="none"
                autoComplete="email"
                editable={formEditable}
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
                onChangeText={(value) => {
                  setPassword(value);
                  clearNotice();
                }}
                accessibilityLabel={t("login.form.password")}
                accessibilityHint={t("login.form.passwordHint")}
                autoComplete="current-password"
                editable={formEditable}
                onSubmitEditing={() => void handleSignIn()}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                placeholder={t("login.form.passwordPlaceholder")}
                placeholderTextColor={colors.faint}
                textContentType="password"
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
              title={!isSupabaseConfigured ? t("login.action.cloudUnavailable") : loading ? t("login.action.opening") : t("login.action.signIn")}
              icon={<LogIn size={17} color={colors.surface} strokeWidth={2.5} />}
              onPress={handleSignIn}
              disabled={loading || !isSupabaseConfigured}
              fullWidth
            />
            {isSupabaseConfigured ? (
              <>
                <Button
                  title={t("login.action.createAccount")}
                  variant="secondary"
                  onPress={() => router.replace("/signup")}
                  disabled={loading}
                  fullWidth
                />
                <Button
                  title={
                    loading
                      ? t("login.action.sendingReset")
                      : resetSent
                        ? t("login.action.resendReset")
                        : t("login.action.forgotPassword")
                  }
                  variant="ghost"
                  onPress={() => void handleForgotPassword()}
                  disabled={loading}
                  fullWidth
                />
              </>
            ) : null}
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
  statusNotice: {
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
