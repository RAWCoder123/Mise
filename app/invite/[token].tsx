import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  clearPendingInviteToken,
  savePendingInviteToken
} from "../../lib/pendingInvite";
import { claimRestaurantMemberInvite } from "../../services/miseService";
import {
  buildInviteClaimPath,
  classifyInviteClaimFailure,
  isTerminalInviteClaimFailure,
  isValidInviteToken,
  normalizeInviteToken,
  type InviteClaimFailureKind
} from "../../services/domain/teamInvites";
import { captureMiseError } from "../../services/telemetry";

type InviteNotice = { tone: StatusNoticeTone; key: MessageKey };

const CLAIM_FAILURE_NOTICE: Record<
  InviteClaimFailureKind,
  { tone: StatusNoticeTone; key: MessageKey }
> = {
  expired: { tone: "caution", key: "invite.claim.notice.expired" },
  revoked: { tone: "caution", key: "invite.claim.notice.revoked" },
  alreadyClaimed: { tone: "caution", key: "invite.claim.notice.alreadyClaimed" },
  emailMismatch: { tone: "danger", key: "invite.claim.notice.emailMismatch" },
  error: { tone: "danger", key: "invite.claim.notice.error" }
};

export default function ClaimInviteScreen() {
  const { t } = useLocale();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = normalizeInviteToken(rawToken ?? "");
  const tokenValid = isValidInviteToken(token);
  const { ready, refreshSession, restaurant, user } = useMiseSession();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<InviteNotice | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimFailureKind, setClaimFailureKind] = useState<InviteClaimFailureKind | null>(null);
  const autoClaimStarted = useRef(false);

  useEffect(() => {
    if (!tokenValid) {
      void clearPendingInviteToken();
      return;
    }
    void savePendingInviteToken(token);
  }, [token, tokenValid]);

  const dismissPendingInvite = useCallback(async () => {
    await clearPendingInviteToken();
    router.replace(restaurant ? "/today" : "/");
  }, [restaurant]);

  const claimInvite = useCallback(async () => {
    if (!tokenValid || busy || !user || claimed) return;
    if (claimFailureKind && isTerminalInviteClaimFailure(claimFailureKind)) return;
    setBusy(true);
    setNotice(null);
    try {
      await claimRestaurantMemberInvite(token);
      await clearPendingInviteToken();
      await refreshSession();
      setClaimed(true);
      setClaimFailureKind(null);
      setNotice({ tone: "success", key: "invite.claim.notice.success" });
    } catch (claimError) {
      captureMiseError(claimError, { flow: "invite_claim", operation: "claim" });
      const message = claimError instanceof Error ? claimError.message : "";
      const kind = classifyInviteClaimFailure(message);
      setClaimFailureKind(kind);
      setNotice(CLAIM_FAILURE_NOTICE[kind]);
      if (isTerminalInviteClaimFailure(kind)) {
        await clearPendingInviteToken();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, claimFailureKind, claimed, refreshSession, token, tokenValid, user]);

  useEffect(() => {
    if (
      !ready ||
      !tokenValid ||
      !user ||
      claimed ||
      busy ||
      claimFailureKind ||
      autoClaimStarted.current
    ) {
      return;
    }
    autoClaimStarted.current = true;
    void claimInvite();
  }, [busy, claimFailureKind, claimInvite, claimed, ready, tokenValid, user]);

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  if (!tokenValid) {
    return (
      <Screen title={t("invite.claim.title")} subtitle={t("invite.claim.subtitle")}>
        <EmptyState
          illustration={<ShieldCheck size={22} color={colors.muted} strokeWidth={2.25} />}
          title={t("invite.claim.invalidTitle")}
          body={t("invite.claim.invalidBody")}
        />
        <Button title={t("invite.claim.goHome")} onPress={() => void dismissPendingInvite()} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen title={t("invite.claim.title")} subtitle={t("invite.claim.subtitle")}>
      <View style={styles.stack}>
        {notice ? <StatusNotice title={t(notice.key)} tone={notice.tone} /> : null}

        <SectionSurface>
          <View style={styles.heading}>
            <IconBadge tone="brand">
              <KeyRound size={20} color={colors.accentDark} strokeWidth={2.25} />
            </IconBadge>
            <View style={styles.copy}>
              <Text style={styles.title}>{t("invite.claim.cardTitle")}</Text>
              <Text style={styles.body}>{t("invite.claim.cardBody")}</Text>
            </View>
          </View>
          <Text style={styles.path}>{buildInviteClaimPath(token)}</Text>
          {user ? (
            <Text style={styles.meta}>{t("invite.claim.signedInAs", { email: user.email })}</Text>
          ) : (
            <Text style={styles.meta}>{t("invite.claim.signInRequired")}</Text>
          )}
        </SectionSurface>

        {!user ? (
          <>
            <Button
              title={t("invite.claim.createAccount")}
              icon={<UserPlus size={18} color={colors.surface} strokeWidth={2.25} />}
              onPress={() => router.replace("/signup")}
              fullWidth
            />
            <Button
              title={t("invite.claim.signIn")}
              variant="secondary"
              icon={<LogIn size={18} color={colors.text} strokeWidth={2.25} />}
              onPress={() => router.replace("/login")}
              fullWidth
            />
          </>
        ) : claimed ? (
          <Button
            title={t(restaurant ? "invite.claim.openToday" : "invite.claim.goHome")}
            onPress={() => router.replace(restaurant ? "/today" : "/")}
            fullWidth
          />
        ) : claimFailureKind && isTerminalInviteClaimFailure(claimFailureKind) ? (
          <Button
            title={t("invite.claim.dismiss")}
            onPress={() => void dismissPendingInvite()}
            fullWidth
          />
        ) : (
          <>
            <Button
              title={t(busy ? "invite.claim.claiming" : "invite.claim.claim")}
              onPress={() => void claimInvite()}
              disabled={busy}
              fullWidth
            />
            {claimFailureKind === "emailMismatch" ? (
              <Button
                title={t("invite.claim.dismiss")}
                variant="secondary"
                onPress={() => void dismissPendingInvite()}
                disabled={busy}
                fullWidth
              />
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  heading: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  copy: {
    flex: 1,
    gap: 4
  },
  title: {
    ...typography.cardTitle,
    color: colors.text
  },
  body: {
    ...typography.body,
    color: colors.muted
  },
  path: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.sm
  },
  meta: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs
  }
});
