import { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { KeyRound } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  acceptOwnerInvitation,
  InviteAcceptanceError,
  type InviteAcceptanceErrorCode
} from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";

const inviteErrorKeys: Record<InviteAcceptanceErrorCode, MessageKey> = {
  invite_callback_required: "invite.error.callbackRequired",
  invite_callback_invalid: "invite.error.callbackInvalid",
  invite_callback_wrong_destination: "invite.error.callbackWrongDestination",
  invite_callback_wrong_type: "invite.error.callbackWrongType",
  invite_callback_incomplete: "invite.error.callbackIncomplete",
  invite_callback_mixed_credentials: "invite.error.callbackMixedCredentials",
  invite_callback_rejected: "invite.error.callbackRejected",
  invite_service_unavailable: "invite.error.serviceUnavailable",
  password_too_short: "invite.error.passwordTooShort",
  password_too_long: "invite.error.passwordTooLong",
  password_mismatch: "invite.error.passwordMismatch",
  invite_session_failed: "invite.error.sessionFailed",
  invite_password_update_failed: "invite.error.passwordUpdateFailed"
};

/** Destination check only — never inspect fragment/query credential values. */
function isMiseInviteCallbackUrl(url: string) {
  return (
    url === "mise://accept-invite" ||
    url.startsWith("mise://accept-invite#") ||
    url.startsWith("mise://accept-invite?")
  );
}

export default function AcceptInviteScreen() {
  const { t } = useLocale();
  const { authUser, isLoading, memberships, ready, restaurant } = useMiseSession();
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [callbackResolved, setCallbackResolved] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const consumedCallbackRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    function consumeCallback(url: string | null) {
      if (!mounted || !url || consumedCallbackRef.current) return;
      if (!isMiseInviteCallbackUrl(url)) return;
      consumedCallbackRef.current = true;
      setCallbackUrl(url);
    }

    void Linking.getInitialURL()
      .then((url) => {
        consumeCallback(url);
        if (mounted) setCallbackResolved(true);
      })
      .catch(() => {
        if (mounted) setCallbackResolved(true);
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      consumeCallback(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!accepted || !ready || isLoading) return;

    const hasActiveOwnerMembership = memberships.some(
      (membership) => membership.status === "active" && membership.role === "owner"
    );
    if (hasActiveOwnerMembership && restaurant) {
      router.replace("/today");
      return;
    }
    if (authUser) {
      router.replace("/setup");
    }
  }, [accepted, authUser, isLoading, memberships, ready, restaurant]);

  async function handleAccept() {
    if (loading || accepted || !callbackUrl) return;

    setLoading(true);
    setErrorKey(null);
    try {
      await acceptOwnerInvitation(callbackUrl, password, confirmPassword);
      setPassword("");
      setConfirmPassword("");
      setAccepted(true);
    } catch (error) {
      setPassword("");
      setConfirmPassword("");
      if (error instanceof InviteAcceptanceError) {
        setErrorKey(inviteErrorKeys[error.code]);
      } else {
        captureMiseError(error, { flow: "accept_invite", operation: "accept_owner_invitation" });
        setErrorKey("invite.error.sessionFailed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!callbackResolved) {
    return <Screen title={t("invite.title")} subtitle={t("invite.loading")} loading />;
  }

  if (!callbackUrl) {
    return (
      <Screen title={t("invite.title")} subtitle={t("invite.invalid.subtitle")} scroll>
        <View style={styles.stack}>
          <StatusNotice
            tone="warning"
            title={t("invite.invalid.title")}
            message={t("invite.invalid.body")}
          />
          <Button
            title={t("invite.action.backToLogin")}
            accessibilityLabel={t("invite.action.backToLogin")}
            accessibilityHint={t("invite.action.backToLoginHint")}
            onPress={() => router.replace("/login")}
            fullWidth
            style={styles.primaryButton}
          />
          <LegalLinks />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t("invite.title")} subtitle={t("invite.subtitle")} scroll keyboardAware>
      <View style={styles.stack}>
        <Card>
          <View style={styles.headerRow}>
            <KeyRound size={icon.emphasis} color={colors.accent} strokeWidth={iconStroke} />
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {t("invite.form.title")}
            </Text>
          </View>
          <Text style={styles.cardCopy}>{t("invite.form.body")}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t("invite.form.password")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              accessibilityLabel={t("invite.form.password")}
              accessibilityHint={t("invite.form.passwordHint")}
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!loading && !accepted}
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              placeholder={t("invite.form.passwordPlaceholder")}
              placeholderTextColor={colors.faint}
              textContentType="newPassword"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("invite.form.confirmPassword")}</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              accessibilityLabel={t("invite.form.confirmPassword")}
              accessibilityHint={t("invite.form.confirmPasswordHint")}
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!loading && !accepted}
              onSubmitEditing={() => void handleAccept()}
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              placeholder={t("invite.form.passwordPlaceholder")}
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
              accepted
                ? t("invite.action.opening")
                : loading
                  ? t("invite.action.saving")
                  : t("invite.action.accept")
            }
            accessibilityLabel={t("invite.action.accept")}
            accessibilityHint={t("invite.action.acceptHint")}
            accessibilityState={{ disabled: loading || accepted, busy: loading || accepted }}
            onPress={() => void handleAccept()}
            disabled={loading || accepted}
            fullWidth
            style={styles.primaryButton}
          />
        </Card>

        <Button
          title={t("invite.action.backToLogin")}
          variant="secondary"
          accessibilityLabel={t("invite.action.backToLogin")}
          accessibilityHint={t("invite.action.backToLoginHint")}
          onPress={() => router.replace("/login")}
          disabled={loading || accepted}
          fullWidth
        />

        <LegalLinks />
      </View>
    </Screen>
  );
}

function LegalLinks() {
  const { t } = useLocale();
  return (
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
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    flex: 1
  },
  cardCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8
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
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12
  },
  primaryButton: {
    marginTop: 14
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
