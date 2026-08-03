import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle2, ExternalLink, Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react-native";
import { AppState, Linking, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  connectRestaurantGmail,
  disconnectRestaurantGmail,
  fetchEmailConnectionState,
  isGmailIntegrationError
} from "../../services/miseService";
import {
  presentGmailHubSenderCopy,
  presentGmailHubStatusCopy,
  presentGmailMutationActionsEditable,
  presentGmailMutationBusy,
  presentGmailMutationErrorNotice,
  presentGmailMutationNoticeCopy,
  resolveGmailHubLoadState,
  resolveGmailMutationErrorReason,
  type GmailMutationAction,
  type GmailMutationErrorReason,
  type GmailMutationNoticeReason
} from "../../services/presentation/gmailHubPresentation";
import { captureMiseError } from "../../services/telemetry";
import { canDeleteRestaurantData } from "../../services/tenantAccess";
import type { RestaurantEmailConnection } from "../../types/mise";

interface GmailNotice {
  tone: StatusNoticeTone;
  title: string;
  message: string;
}

const MUTATION_NOTICE_KEYS: Record<
  GmailMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  ownerRequired: {
    title: "settings.gmail.owner.title",
    message: "settings.gmail.owner.body"
  },
  oauthStarted: {
    title: "settings.gmail.oauth.title",
    message: "settings.gmail.oauth.body"
  },
  callbackConnected: {
    title: "settings.gmail.connected.title",
    message: "settings.gmail.connected.body"
  },
  callbackFailed: {
    title: "settings.gmail.failed.title",
    message: "settings.gmail.failed.body"
  },
  demoConnected: {
    title: "settings.gmail.demoConnected.title",
    message: "settings.gmail.demoConnected.body"
  },
  disconnectedDemo: {
    title: "settings.gmail.disconnected.title",
    message: "settings.gmail.disconnected.demoBody"
  },
  disconnectedLive: {
    title: "settings.gmail.disconnected.title",
    message: "settings.gmail.disconnected.liveBody"
  }
};

export default function GmailConnectionScreen() {
  const navigation = useNavigation();
  const { gmail } = useLocalSearchParams<{ gmail?: string }>();
  const { formatDate, t } = useLocale();
  const { isDemoMode, memberships, restaurant } = useMiseSession();
  const [connection, setConnection] = useState<RestaurantEmailConnection | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyAction, setBusyAction] = useState<GmailMutationAction | null>(null);
  const [notice, setNotice] = useState<GmailNotice | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const actionLockRef = useRef(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManageConnection = canDeleteRestaurantData(memberships, restaurant?.id);
  const mutationBusy = presentGmailMutationBusy(busyAction);

  function mutationNotice(reason: GmailMutationNoticeReason): GmailNotice {
    const localized = (
      Object.keys(MUTATION_NOTICE_KEYS) as GmailMutationNoticeReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(MUTATION_NOTICE_KEYS[key].title),
          message: t(MUTATION_NOTICE_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<GmailMutationNoticeReason, { title: string; message: string }>
    );
    return presentGmailMutationNoticeCopy(reason, localized);
  }

  function mutationErrorNotice(
    error: unknown,
    fallbackMessage: string
  ): GmailNotice {
    const status = isGmailIntegrationError(error) ? error.status : null;
    const reason = resolveGmailMutationErrorReason(status);
    const copy: Record<GmailMutationErrorReason, { title: string; message: string }> = {
      notEnabled: {
        title: t("settings.gmail.error.notEnabledTitle"),
        message: fallbackMessage
      },
      reviewRequired: {
        title: t("settings.gmail.error.reviewTitle"),
        message: t("orders.detail.gmail.review")
      },
      reconnectRequired: {
        title: t("settings.gmail.error.reconnectTitle"),
        message: t("settings.gmail.failed.body")
      },
      actionFailed: {
        title: t("settings.gmail.error.actionTitle"),
        message: fallbackMessage
      }
    };
    return presentGmailMutationErrorNotice(reason, copy);
  }

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant) {
      setLoading(false);
      setLoadError(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading || loadedRestaurantRef.current !== restaurantId) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      const nextConnection = await fetchEmailConnectionState(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextConnection && nextConnection.restaurant_id !== restaurantId) {
        throw new Error("Gmail connection did not match the active restaurant.");
      }
      setConnection(nextConnection);
      loadedRestaurantRef.current = restaurantId;
      setLoadedRestaurantId(restaurantId);
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "settings_gmail",
        operation: "load",
        restaurant_id: restaurantId
      });
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    actionLockRef.current = false;
    setConnection(null);
    setLoadedRestaurantId(null);
    setLoadError(false);
    setBusyAction(null);
    setNotice(null);
    setConfirmDisconnect(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && restaurant) void load(false);
    });
    return () => subscription.remove();
  }, [load, restaurant?.id]);

  useEffect(() => {
    if (gmail === "connected") {
      setNotice(mutationNotice("callbackConnected"));
      void load(false);
    } else if (gmail === "connection_failed") {
      setNotice(mutationNotice("callbackFailed"));
      void load(false);
    }
  }, [gmail, load]);

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  async function connect() {
    if (!restaurant || actionLockRef.current) return;
    if (!canManageConnection) {
      setNotice(mutationNotice("ownerRequired"));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusyAction("connect");
    setConfirmDisconnect(false);
    setNotice(null);
    try {
      const result = await connectRestaurantGmail(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      if (result.status === "connected") {
        setConnection(result.connection);
        loadedRestaurantRef.current = restaurantId;
        setLoadedRestaurantId(restaurantId);
        setLoadError(false);
        setNotice(mutationNotice("demoConnected"));
        return;
      }
      const canOpen = await Linking.canOpenURL(result.authorizationUrl);
      if (!canOpen) throw new Error(t("settings.gmail.error.authorization"));
      await Linking.openURL(result.authorizationUrl);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("oauthStarted"));
    } catch (connectError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(connectError, {
        flow: "settings_gmail",
        operation: "connect",
        restaurant_id: restaurantId
      });
      setNotice(mutationErrorNotice(connectError, t("settings.gmail.error.authorization")));
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function disconnect() {
    if (!restaurant || actionLockRef.current || !canManageConnection) return;
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusyAction("disconnect");
    setNotice(null);
    try {
      await disconnectRestaurantGmail(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setConnection((current) => current ? {
        ...current,
        status: "not_connected",
        sender_email: null,
        last_verified_at: null,
        updated_at: new Date().toISOString()
      } : null);
      setConfirmDisconnect(false);
      setNotice(mutationNotice(isDemoMode ? "disconnectedDemo" : "disconnectedLive"));
    } catch (disconnectError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(disconnectError, {
        flow: "settings_gmail",
        operation: "disconnect",
        restaurant_id: restaurantId
      });
      setNotice(mutationErrorNotice(disconnectError, t("settings.gmail.error.disconnect")));
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function refresh() {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBusyAction("refresh");
    setNotice(null);
    try {
      await load(false);
    } finally {
      actionLockRef.current = false;
      setBusyAction(null);
    }
  }

  const hubLoadState = resolveGmailHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentGmailMutationActionsEditable(
    canManageConnection,
    mutationBusy,
    hubReady
  );
  const visibleConnection = hubReady ? connection : null;
  const status = visibleConnection?.status ?? null;
  const statusPresentation = presentGmailHubStatusCopy(hubLoadState, status, {
    loading: t("settings.gmail.status.loading"),
    unavailable: t("settings.gmail.status.unavailable"),
    connected: t("settings.gmail.status.connected"),
    needsReauth: t("settings.gmail.status.needsReauth"),
    restricted: t("settings.gmail.status.restricted"),
    notConnected: t("settings.gmail.status.notConnected")
  });
  const senderValue = presentGmailHubSenderCopy(hubLoadState, visibleConnection?.sender_email, {
    loading: t("settings.gmail.detail.senderLoading"),
    unavailable: t("settings.gmail.detail.senderUnavailable"),
    notConnected: t("settings.gmail.status.notConnected")
  });
  const connectLabel = status === "needs_reauth" || status === "restricted"
    ? t("settings.gmail.action.reconnect")
    : t("settings.gmail.action.connect");
  const showConnectActions = hubReady && statusPresentation.metaReady;

  return (
    <Screen
      title={t("settings.gmail.title")}
      subtitle={t("settings.gmail.subtitle")}
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("settings.gmail.back")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
        </ActionIcon>
      }
    >
      {!restaurant ? (
        <StatusNotice
          tone="warning"
          title={t("settings.gmail.noRestaurant.title")}
          message={t("settings.gmail.noRestaurant.body")}
        />
      ) : (
        <View style={styles.stack}>
          {isDemoMode ? (
            <StatusNotice
              title={t("settings.gmail.demo.title")}
              message={t("settings.gmail.demo.body")}
            />
          ) : null}

          {!canManageConnection ? (
            <StatusNotice
              title={t("settings.gmail.readOnly.title")}
              message={t("settings.gmail.readOnly.body")}
            />
          ) : null}

          {loadError ? (
            <RetryNotice
              title={t("settings.gmail.retry.title")}
              message={t("settings.gmail.error.loadBody")}
              onRetry={() => void load(true)}
              retryLabel={t("common.retry")}
              accessibilityLabel={t("settings.gmail.retry.accessibility")}
            />
          ) : null}
          {!loadError && notice ? (
            <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
          ) : null}

          <Card>
            <View style={styles.connectionHeader}>
              <IconBadge tone={statusPresentation.iconTone}>
                {status === "connected" ? (
                  <CheckCircle2 size={21} color={colors.success} strokeWidth={2.4} />
                ) : (
                  <Mail size={21} color={colors.accent} strokeWidth={2.4} />
                )}
              </IconBadge>
              <View style={styles.connectionTitleBlock}>
                <Text style={styles.connectionTitle}>{t("settings.gmail.card.title")}</Text>
                <Text style={styles.connectionSubtitle}>{restaurant.name}</Text>
              </View>
              <Badge label={statusPresentation.label} tone={statusPresentation.badgeTone} />
            </View>

            <View style={styles.detailRows}>
              <ConnectionDetail label={t("settings.gmail.detail.sender")} value={senderValue} />
              <ConnectionDetail
                label={t("settings.gmail.detail.lastVerified")}
                value={
                  !showConnectActions
                    ? statusPresentation.label
                    : visibleConnection?.last_verified_at
                      ? formatDate(visibleConnection.last_verified_at, { dateStyle: "medium", timeStyle: "short" })
                      : t("settings.gmail.detail.notVerified")
                }
              />
            </View>

            {canManageConnection && showConnectActions ? (
              <View style={styles.connectionActions}>
                {status === "connected" ? (
                  confirmDisconnect ? (
                    <View style={styles.confirmPanel}>
                      <Text style={styles.confirmTitle}>{t("settings.gmail.confirm.title")}</Text>
                      <Text style={styles.confirmCopy}>{t("settings.gmail.confirm.body")}</Text>
                      <View style={styles.confirmActions}>
                        <Button
                          title={t("common.cancel")}
                          variant="secondary"
                          onPress={() => setConfirmDisconnect(false)}
                          disabled={mutationBusy}
                          style={styles.confirmButton}
                        />
                        <Button
                          title={busyAction === "disconnect" ? t("settings.gmail.action.disconnecting") : t("settings.gmail.action.confirmDisconnect")}
                          accessibilityLabel={t("settings.gmail.action.confirmDisconnectAccessibility")}
                          variant="danger"
                          icon={<Unplug size={16} color={colors.surface} strokeWidth={2.3} />}
                          onPress={() => void disconnect()}
                          disabled={!actionsEditable}
                          style={styles.confirmButton}
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      title={t("settings.gmail.action.disconnect")}
                      variant="secondary"
                      icon={<Unplug size={17} color={colors.text} strokeWidth={2.25} />}
                      onPress={() => setConfirmDisconnect(true)}
                      disabled={mutationBusy}
                      fullWidth
                    />
                  )
                ) : (
                  <Button
                    title={busyAction === "connect" ? t("settings.gmail.action.openingGoogle") : connectLabel}
                    icon={<ExternalLink size={17} color={colors.surface} strokeWidth={2.25} />}
                    onPress={() => void connect()}
                    disabled={!actionsEditable}
                    fullWidth
                  />
                )}
              </View>
            ) : null}
          </Card>

          <Card tone="warm">
            <View style={styles.securityHeader}>
              <ShieldCheck size={20} color={colors.text} strokeWidth={2.35} />
              <Text style={styles.securityTitle}>{t("settings.gmail.security.title")}</Text>
            </View>
            <Text style={styles.securityCopy}>
              {t("settings.gmail.security.scope")}
            </Text>
            <Text style={styles.securityCopy}>
              {t("settings.gmail.security.private")}
            </Text>
            <Text style={styles.securityCopy}>
              {t("settings.gmail.security.workspace")}
            </Text>
          </Card>

          <Button
            title={busyAction === "refresh" ? t("settings.gmail.action.refreshing") : t("settings.gmail.action.refresh")}
            accessibilityLabel={t("settings.gmail.action.refreshAccessibility")}
            variant="ghost"
            icon={<RefreshCw size={17} color={colors.text} strokeWidth={2.2} />}
            onPress={() => void refresh()}
            disabled={mutationBusy}
            fullWidth
          />
        </View>
      )}
    </Screen>
  );
}

function ConnectionDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.lg
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  connectionTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  connectionTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  connectionSubtitle: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2
  },
  detailRows: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 5
  },
  detailRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  detailLabel: {
    color: colors.muted,
    ...typography.caption
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    fontWeight: "700",
    textAlign: "right"
  },
  connectionActions: {
    marginTop: 12
  },
  confirmPanel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.redBorder,
    backgroundColor: colors.dangerSoft,
    padding: 12
  },
  confirmTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  confirmCopy: {
    color: colors.muted,
    ...typography.body,
    marginTop: 4
  },
  confirmActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  confirmButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  securityTitle: {
    flex: 1,
    color: colors.text,
    ...typography.cardTitle
  },
  securityCopy: {
    color: colors.muted,
    ...typography.body,
    marginTop: 9
  }
});
