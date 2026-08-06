import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle, FileText, PlugZap } from "lucide-react-native";
import { Animated, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePressScale } from "../../components/ui/Motion";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  connectRestaurantSquare,
  disconnectRestaurantSquare,
  fetchSquarePosIntegration,
  isSquareIntegrationError,
  syncSquarePosSales
} from "../../services/miseService";
import { canDeleteRestaurantData } from "../../services/tenantAccess";
import type { PosIntegration, PosProvider } from "../../types/mise";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];
type PosMessage =
  | { key: "pos.message.demoLoaded"; values: { provider: string } }
  | { key: "pos.error.demoLoad" }
  | { key: "pos.message.syncCompleted"; values: { count: string } };

export default function POSConnectionScreen() {
  const navigation = useNavigation();
  const { square } = useLocalSearchParams<{ square?: string }>();
  const { formatDate, t } = useLocale();
  const { isDemoMode, memberships, posProvider, restaurant, connectDemoPOS } = useMiseSession();
  const [loadingProvider, setLoadingProvider] = useState<PosProvider | null>(null);
  const [message, setMessage] = useState<PosMessage | null>(null);
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(!isDemoMode);
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "sync" | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "danger" | "neutral";
    title: string;
    message: string;
  } | null>(null);
  const requestIdRef = useRef(0);
  const canManage = canDeleteRestaurantData(memberships, restaurant?.id);
  const posProviderLabel = posProvider === "Manual CSV Upload" ? t("pos.provider.manualCsv") : posProvider;
  const squareConnected = integration?.status === "connected";

  const loadIntegration = useCallback(async (showLoading = true) => {
    if (isDemoMode || !restaurant) {
      setLoadingIntegration(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading) setLoadingIntegration(true);
    try {
      const next = await fetchSquarePosIntegration(restaurantId);
      if (requestId !== requestIdRef.current) return;
      setIntegration(next);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setNotice({
        tone: "danger",
        title: t("pos.error.loadTitle"),
        message: t("pos.error.loadBody")
      });
    } finally {
      if (requestId === requestIdRef.current) setLoadingIntegration(false);
    }
  }, [isDemoMode, restaurant?.id, t]);

  useFocusEffect(
    useCallback(() => {
      void loadIntegration(false);
    }, [loadIntegration])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !isDemoMode) void loadIntegration(false);
    });
    return () => subscription.remove();
  }, [isDemoMode, loadIntegration]);

  useEffect(() => {
    if (square === "connected") {
      setNotice({
        tone: "success",
        title: t("pos.square.connectedTitle"),
        message: t("pos.square.connectedBody")
      });
      void loadIntegration(false);
    } else if (square === "connection_failed") {
      setNotice({
        tone: "warning",
        title: t("pos.square.failedTitle"),
        message: t("pos.square.failedBody")
      });
    }
  }, [square, loadIntegration, t]);

  async function connect(provider: PosProvider) {
    if (provider === "Manual CSV Upload") {
      router.push("/settings/sales-import" as never);
      return;
    }
    setLoadingProvider(provider);
    setMessage(null);
    try {
      await connectDemoPOS(provider);
      setMessage({ key: "pos.message.demoLoaded", values: { provider } });
    } catch {
      setMessage({ key: "pos.error.demoLoad" });
    } finally {
      setLoadingProvider(null);
    }
  }

  async function connectSquare() {
    if (!restaurant || !canManage) return;
    setBusyAction("connect");
    setNotice(null);
    try {
      const result = await connectRestaurantSquare(restaurant.id);
      if (result.status === "authorization_required") {
        const opened = await Linking.openURL(result.authorizationUrl);
        if (!opened) {
          setNotice({
            tone: "warning",
            title: t("pos.square.openFailedTitle"),
            message: t("pos.square.openFailedBody")
          });
        }
      } else {
        setIntegration(result.integration);
        setNotice({
          tone: "success",
          title: t("pos.square.connectedTitle"),
          message: t("pos.square.connectedBody")
        });
      }
    } catch (error) {
      setNotice({
        tone: "danger",
        title: t("pos.square.connectErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.connectErrorBody")
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectSquare() {
    if (!restaurant || !canManage) return;
    setBusyAction("disconnect");
    setNotice(null);
    try {
      await disconnectRestaurantSquare(restaurant.id);
      setIntegration((current) =>
        current ? { ...current, status: "not_connected", last_sync_at: null } : current
      );
      setNotice({
        tone: "neutral",
        title: t("pos.square.disconnectedTitle"),
        message: t("pos.square.disconnectedBody")
      });
      await loadIntegration(false);
    } catch (error) {
      setNotice({
        tone: "danger",
        title: t("pos.square.disconnectErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.disconnectErrorBody")
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function syncSquare() {
    if (!restaurant) return;
    setBusyAction("sync");
    setNotice(null);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);
      const result = await syncSquarePosSales(
        restaurant.id,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10)
      );
      setMessage({
        key: "pos.message.syncCompleted",
        values: { count: String(result.recordsProcessed) }
      });
      setNotice({
        tone: "success",
        title: t("pos.square.syncTitle"),
        message: t("pos.square.syncBody", { count: String(result.recordsProcessed) })
      });
      await loadIntegration(false);
    } catch (error) {
      setNotice({
        tone: "danger",
        title: t("pos.square.syncErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.syncErrorBody")
      });
    } finally {
      setBusyAction(null);
    }
  }

  function goBackToSettings() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/settings");
  }

  return (
    <Screen
      title={t("pos.title")}
      subtitle={isDemoMode ? t("pos.subtitle.demo") : t("pos.subtitle.live")}
      action={
        <ActionIcon accessibilityLabel={t("pos.backToSettings")} onPress={goBackToSettings}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      <View style={styles.stack}>
        <OperationalHero
          eyebrow={t("pos.hero.eyebrow")}
          title={
            isDemoMode
              ? posProviderLabel
                ? t("pos.hero.connected", { provider: posProviderLabel })
                : t("pos.hero.connectSource")
              : squareConnected
                ? t("pos.hero.connected", { provider: "Square" })
                : t("pos.hero.connectSource")
          }
          body={
            isDemoMode
              ? posProviderLabel
                ? t("pos.status.demoConnected", { provider: posProviderLabel })
                : t("pos.status.demoMode")
              : squareConnected
                ? t("pos.status.squareConnected")
                : t("pos.status.squareReady")
          }
          meta={
            isDemoMode
              ? posProviderLabel ?? t("common.demo")
              : squareConnected
                ? t("common.live")
                : t("pos.value.beta")
          }
          tone={isDemoMode ? (posProvider ? "leaf" : "caution") : squareConnected ? "leaf" : "caution"}
          icon={
            <PlugZap
              size={21}
              color={
                (isDemoMode ? posProvider : squareConnected) ? colors.success : colors.caution
              }
              strokeWidth={2.6}
            />
          }
          stats={[
            {
              label: t("pos.stat.provider"),
              value: isDemoMode
                ? posProvider
                  ? t("common.on")
                  : t("common.none")
                : squareConnected
                  ? t("common.on")
                  : t("common.none"),
              tone: (isDemoMode ? posProvider : squareConnected) ? "leaf" : "caution"
            },
            {
              label: t("pos.stat.mode"),
              value: isDemoMode ? t("common.demo") : t("common.live"),
              tone: "neutral"
            },
            { label: t("pos.stat.import"), value: t("common.on"), tone: "leaf" }
          ]}
        />

        {notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        <View style={styles.demoSafety}>
          <Text style={styles.demoSafetyTitle}>
            {isDemoMode ? t("pos.safety.demoTitle") : t("pos.safety.liveTitle")}
          </Text>
          <Text style={styles.demoSafetyCopy}>
            {isDemoMode ? t("pos.safety.demoBody") : t("pos.safety.liveBody")}
          </Text>
        </View>

        {message && (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {t(message.key, "values" in message ? message.values : undefined)}
          </Text>
        )}

        {isDemoMode ? (
          <>
            <SectionHeader
              title={t("pos.providers.title")}
              eyebrow={t("pos.providers.eyebrow")}
              action={posProviderLabel ?? t("common.none")}
            />
            <View style={styles.providerList}>
              {providers.map((provider) => {
                const isCsv = provider === "Manual CSV Upload";
                const selected = !isCsv && provider === posProvider;
                return (
                  <ProviderOption
                    key={provider}
                    provider={provider}
                    selected={selected}
                    isCsv={isCsv}
                    loading={loadingProvider === provider}
                    disabled={loadingProvider !== null}
                    onPress={() => void connect(provider)}
                  />
                );
              })}
            </View>
          </>
        ) : (
          <Card>
            <Text style={styles.restrictedTitle}>{t("pos.square.cardTitle")}</Text>
            <Text style={styles.restrictedCopy}>{t("pos.square.cardBody")}</Text>
            {loadingIntegration ? (
              <Text style={styles.meta}>{t("common.loading")}</Text>
            ) : (
              <Text style={styles.meta}>
                {squareConnected
                  ? t("pos.square.lastSync", {
                      value: integration?.last_sync_at
                        ? formatDate(integration.last_sync_at)
                        : t("common.none")
                    })
                  : t("pos.square.notConnectedMeta")}
              </Text>
            )}
            <View style={styles.actions}>
              {canManage ? (
                squareConnected ? (
                  <>
                    <Button
                      title={busyAction === "sync" ? t("pos.square.syncing") : t("pos.square.syncNow")}
                      onPress={() => void syncSquare()}
                      disabled={busyAction !== null}
                      accessibilityHint={t("pos.square.syncHint")}
                    />
                    <Button
                      title={
                        busyAction === "disconnect"
                          ? t("pos.square.disconnecting")
                          : t("pos.square.disconnect")
                      }
                      variant="secondary"
                      onPress={() => void disconnectSquare()}
                      disabled={busyAction !== null}
                      accessibilityHint={t("pos.square.disconnectHint")}
                    />
                  </>
                ) : (
                  <Button
                    title={
                      busyAction === "connect" ? t("pos.square.connecting") : t("pos.square.connect")
                    }
                    onPress={() => void connectSquare()}
                    disabled={busyAction !== null}
                    accessibilityHint={t("pos.square.connectHint")}
                  />
                )
              ) : (
                <Text style={styles.meta}>{t("pos.square.ownerRequired")}</Text>
              )}
              <Button
                title={t("pos.restricted.importCsv")}
                variant="secondary"
                onPress={() => router.push("/settings/sales-import" as never)}
                accessibilityHint={t("pos.provider.hintCsvImport")}
              />
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function ProviderOption({
  provider,
  selected,
  isCsv,
  loading,
  disabled,
  onPress
}: {
  provider: PosProvider;
  selected: boolean;
  isCsv: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const { pressIn, pressOut, scaleStyle } = usePressScale(0.985);
  const providerLabel = isCsv ? t("pos.provider.manualCsv") : provider;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Animated.View style={[styles.providerRow, selected && styles.providerRowSelected, scaleStyle]}>
        <View style={styles.providerIcon}>
          {isCsv ? (
            <FileText size={18} color={colors.text} strokeWidth={2.2} />
          ) : selected ? (
            <CheckCircle size={18} color={colors.success} strokeWidth={2.2} />
          ) : (
            <PlugZap size={18} color={colors.muted} strokeWidth={2.2} />
          )}
        </View>
        <View style={styles.providerCopy}>
          <Text style={styles.providerTitle}>{providerLabel}</Text>
          <Text style={styles.providerBody}>
            {isCsv ? t("pos.provider.copyCsv") : selected ? t("pos.provider.copyConnectedDemo") : t("pos.provider.copyDemo")}
          </Text>
        </View>
        <Text style={styles.providerAction}>
          {loading
            ? t("common.loading")
            : isCsv
              ? t("pos.provider.actionImport")
              : selected
                ? t("pos.provider.statusConnected")
                : t("pos.provider.actionConnect")}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  demoSafety: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 6
  },
  demoSafetyTitle: { ...typography.cardTitle, color: colors.text },
  demoSafetyCopy: { ...typography.body, color: colors.muted },
  message: { ...typography.body, color: colors.text },
  providerList: { gap: spacing.sm },
  providerRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  providerRowSelected: { borderColor: colors.success },
  providerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  providerCopy: { flex: 1, gap: 2 },
  providerTitle: { ...typography.cardTitle, color: colors.text },
  providerBody: { ...typography.caption, color: colors.muted },
  providerAction: { ...typography.caption, color: colors.accentDark, fontWeight: "700" },
  restrictedTitle: { ...typography.cardTitle, color: colors.text },
  restrictedCopy: { ...typography.body, color: colors.muted, marginTop: 6 },
  meta: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 }
});
