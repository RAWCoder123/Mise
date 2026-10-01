import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle, FileText, ListChecks, PlugZap } from "lucide-react-native";
import { Animated, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePressScale } from "../../components/ui/Motion";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  connectRestaurantSquare,
  disconnectRestaurantSquare,
  fetchLatestSquareModifierSyncSummary,
  fetchPosMappingReviewQueue,
  fetchPilotReadiness,
  fetchSquarePosIntegration,
  isSquareIntegrationError,
  syncSquarePosSales
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import type { PilotReadiness, PilotReadinessAreaId } from "../../services/domain/pilotReadiness";
import type { SquareModifierSyncSummary } from "../../services/repositories/miseRepository";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import type { PosIntegration, PosProvider } from "../../types/mise";
import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];
type PosMessage =
  | { key: "pos.message.demoLoaded"; values: { provider: string } }
  | { key: "pos.error.demoLoad" }
  | { key: "pos.message.syncCompleted"; values: { count: string } }
  | {
      key: "pos.message.syncCompletedWithModifiers";
      values: { count: string; modifiers: string };
    };

export default function POSConnectionScreen() {
  const navigation = useNavigation();
  const { square } = useLocalSearchParams<{ square?: string }>();
  const { formatDate, t } = useLocale();
  const { isDemoMode, memberships, posProvider, restaurant, connectDemoPOS } = useMiseSession();
  const [loadingProvider, setLoadingProvider] = useState<PosProvider | null>(null);
  const [message, setMessage] = useState<PosMessage | null>(null);
  const [integration, setIntegration] = useState<PosIntegration | null>(null);
  const [pilotReadiness, setPilotReadiness] = useState<PilotReadiness | null>(null);
  const [readinessLoadError, setReadinessLoadError] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(!isDemoMode);
  const [mappingReviewCount, setMappingReviewCount] = useState<number | null>(null);
  const [modifierSummary, setModifierSummary] = useState<SquareModifierSyncSummary | null>(null);
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | "sync" | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "danger" | "neutral";
    title: string;
    message: string;
  } | null>(null);
  const requestIdRef = useRef(0);
  const readinessRequestIdRef = useRef(0);
  const mappingRequestIdRef = useRef(0);
  const modifierRequestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const canManage = canDeleteRestaurantData(memberships, restaurant?.id);
  const canReviewMappings = canManageRestaurantData(memberships, restaurant?.id);
  const posProviderLabel = posProvider === "Manual CSV Upload" ? t("pos.provider.manualCsv") : posProvider;

  useEffect(() => {
    requestIdRef.current += 1;
    setIntegration(null);
    setPilotReadiness(null);
    setReadinessLoadError(false);
    setLoadedRestaurantId(null);
    setHubLoadError(false);
    setNotice(null);
    setMessage(null);
    setBusyAction(null);
    setLoadingProvider(null);
    setMappingReviewCount(null);
    setModifierSummary(null);
    setLoadingIntegration(Boolean(restaurant) && !isDemoMode);
    if (isDemoMode && restaurant) {
      setLoadedRestaurantId(restaurant.id);
      setLoadingIntegration(false);
    }
  }, [isDemoMode, restaurant?.id]);

  const loadMappingReviewCount = useCallback(async () => {
    if (isDemoMode || !restaurant || !canReviewMappings) {
      setMappingReviewCount(null);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++mappingRequestIdRef.current;
    try {
      const queue = await fetchPosMappingReviewQueue(restaurantId);
      if (requestId !== mappingRequestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setMappingReviewCount(queue.pendingCount);
    } catch {
      if (requestId === mappingRequestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setMappingReviewCount(null);
      }
    }
  }, [canReviewMappings, isDemoMode, restaurant?.id]);

  const loadModifierSummary = useCallback(async () => {
    if (!restaurant || (!isDemoMode && !canReviewMappings)) {
      setModifierSummary(null);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++modifierRequestIdRef.current;
    try {
      const next = await fetchLatestSquareModifierSyncSummary(restaurantId);
      if (requestId !== modifierRequestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setModifierSummary(next);
    } catch {
      if (
        requestId === modifierRequestIdRef.current &&
        activeRestaurantIdRef.current === restaurantId
      ) {
        setModifierSummary(null);
      }
    }
  }, [canReviewMappings, isDemoMode, restaurant?.id]);
  const loadPilotReadiness = useCallback(async () => {
    if (!restaurant) return;
    const restaurantId = restaurant.id;
    const requestId = ++readinessRequestIdRef.current;
    try {
      const next = await fetchPilotReadiness(restaurantId);
      if (requestId !== readinessRequestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setPilotReadiness(next);
      setReadinessLoadError(false);
    } catch {
      if (requestId === readinessRequestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setPilotReadiness(null);
        setReadinessLoadError(true);
      }
    }
  }, [restaurant?.id]);

  const loadIntegration = useCallback(async (showLoading = true) => {
    if (isDemoMode || !restaurant) {
      setLoadingIntegration(false);
      if (isDemoMode && restaurant) {
        setLoadedRestaurantId(restaurant.id);
        setHubLoadError(false);
      }
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading) setLoadingIntegration(true);
    setHubLoadError(false);
    try {
      const next = await fetchSquarePosIntegration(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setIntegration(next);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setHubLoadError(true);
      setNotice({
        tone: "danger",
        title: t("pos.error.loadTitle"),
        message: t("pos.error.loadBody")
      });
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoadingIntegration(false);
      }
    }
  }, [isDemoMode, restaurant?.id, t]);

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: hubLoadError
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: busyAction !== null || loadingProvider !== null
  });
  const visibleIntegration = hubReady ? integration : null;
  const visibleSquareConnected = visibleIntegration?.status === "connected";

  useFocusEffect(
    useCallback(() => {
      void loadIntegration(false);
      void loadPilotReadiness();
      void loadMappingReviewCount();
      void loadModifierSummary();
    }, [loadIntegration, loadMappingReviewCount, loadModifierSummary, loadPilotReadiness])
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
    if (!actionsEditable) return;
    const restaurantId = restaurant?.id ?? null;
    setLoadingProvider(provider);
    setMessage(null);
    try {
      await connectDemoPOS(provider);
      if (restaurantId && activeRestaurantIdRef.current !== restaurantId) return;
      setMessage({ key: "pos.message.demoLoaded", values: { provider } });
      await loadPilotReadiness();
    } catch {
      if (restaurantId && activeRestaurantIdRef.current !== restaurantId) return;
      setMessage({ key: "pos.error.demoLoad" });
    } finally {
      if (!restaurantId || activeRestaurantIdRef.current === restaurantId) {
        setLoadingProvider(null);
      }
    }
  }

  async function connectSquare() {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyAction("connect");
    setNotice(null);
    try {
      const result = await connectRestaurantSquare(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
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
        setLoadedRestaurantId(restaurantId);
        setNotice({
          tone: "success",
          title: t("pos.square.connectedTitle"),
          message: t("pos.square.connectedBody")
        });
        await loadPilotReadiness();
        await loadMappingReviewCount();
      }
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.square.connectErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.connectErrorBody")
      });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function disconnectSquare() {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyAction("disconnect");
    setNotice(null);
    try {
      await disconnectRestaurantSquare(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setIntegration((current) =>
        current ? { ...current, status: "not_connected", last_sync_at: null } : current
      );
      setNotice({
        tone: "neutral",
        title: t("pos.square.disconnectedTitle"),
        message: t("pos.square.disconnectedBody")
      });
      await loadIntegration(false);
      await loadPilotReadiness();
      await loadMappingReviewCount();
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.square.disconnectErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.disconnectErrorBody")
      });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function syncSquare() {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyAction("sync");
    setNotice(null);
    try {
      const to = toDateKeyInTimeZone(new Date(), restaurant.timezone);
      const from = addDaysToDateKey(to, -27);
      const result = await syncSquarePosSales(
        restaurantId,
        from,
        to
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      if (result.modifiersUniqueCount > 0) {
        setModifierSummary({
          modifiersObservedCount: result.modifiersObservedCount,
          modifiersUniqueCount: result.modifiersUniqueCount,
          modifiersSample: result.modifiersSample
        });
        setMessage({
          key: "pos.message.syncCompletedWithModifiers",
          values: {
            count: String(result.recordsProcessed),
            modifiers: String(result.modifiersUniqueCount)
          }
        });
        setNotice({
          tone: "warning",
          title: t("pos.square.syncTitle"),
          message: t("pos.square.syncBodyWithModifiers", {
            count: String(result.recordsProcessed),
            modifiers: String(result.modifiersUniqueCount)
          })
        });
      } else {
        setModifierSummary(null);
        setMessage({
          key: "pos.message.syncCompleted",
          values: { count: String(result.recordsProcessed) }
        });
        setNotice({
          tone: "success",
          title: t("pos.square.syncTitle"),
          message: t("pos.square.syncBody", { count: String(result.recordsProcessed) })
        });
      }
      await loadIntegration(false);
      await loadPilotReadiness();
      await loadMappingReviewCount();
      await loadModifierSummary();
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.square.syncErrorTitle"),
        message: isSquareIntegrationError(error) ? error.message : t("pos.square.syncErrorBody")
      });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
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
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
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
              : visibleSquareConnected
                ? t("pos.hero.connected", { provider: "Square" })
                : t("pos.hero.connectSource")
          }
          body={
            isDemoMode
              ? posProviderLabel
                ? t("pos.status.demoConnected", { provider: posProviderLabel })
                : t("pos.status.demoMode")
              : visibleSquareConnected
                ? t("pos.status.squareConnected")
                : t("pos.status.squareReady")
          }
          meta={
            isDemoMode
              ? posProviderLabel ?? t("common.demo")
              : visibleSquareConnected
                ? t("common.live")
                : t("pos.value.beta")
          }
          tone={isDemoMode ? (posProvider ? "leaf" : "caution") : visibleSquareConnected ? "leaf" : "caution"}
          icon={
            <PlugZap
              size={icon.emphasis}
              color={
                (isDemoMode ? posProvider : visibleSquareConnected) ? colors.success : colors.caution
              }
              strokeWidth={iconStroke}
            />
          }
          stats={[
            {
              label: t("pos.stat.provider"),
              value: isDemoMode
                ? posProvider
                  ? t("common.on")
                  : t("common.none")
                : visibleSquareConnected
                  ? t("common.on")
                  : t("common.none"),
              tone: (isDemoMode ? posProvider : visibleSquareConnected) ? "leaf" : "caution"
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
          <StatusNotice
            tone={notice.tone}
            title={notice.title}
            message={notice.message}
            actionLabel={hubLoadError ? t("common.retry") : undefined}
            onAction={hubLoadError ? () => void loadIntegration(true) : undefined}
          />
        ) : null}

        {readinessLoadError ? (
          <StatusNotice
            tone="danger"
            title={t("pos.readiness.unavailableTitle")}
            message={t("pos.readiness.unavailableBody")}
            actionLabel={t("common.retry")}
            onAction={() => void loadPilotReadiness()}
          />
        ) : pilotReadiness ? (
          <StatusNotice
            tone={pilotReadiness.canSend ? "success" : "warning"}
            title={pilotReadiness.canSend
              ? t("pos.readiness.readyTitle")
              : t("pos.readiness.attentionTitle")}
            message={pilotReadiness.canSend
              ? t("pos.readiness.readyBody")
              : t("pos.readiness.attentionBody", {
                  areas: pilotReadiness.areas
                    .filter((area) => area.status !== "ready")
                    .map((area) => pilotReadinessAreaLabel(area.id, t))
                    .join(", ")
                })}
          />
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
                    disabled={!actionsEditable || loadingProvider !== null}
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
            {loadingIntegration || !hubReady ? (
              <Text style={styles.meta}>{t("common.loading")}</Text>
            ) : (
              <Text style={styles.meta}>
                {visibleSquareConnected
                  ? t("pos.square.lastSync", {
                      value: visibleIntegration?.last_sync_at
                        ? formatDate(visibleIntegration.last_sync_at)
                        : t("common.none")
                    })
                  : t("pos.square.notConnectedMeta")}
              </Text>
            )}
            <View style={styles.actions}>
              {actionsEditable ? (
                visibleSquareConnected ? (
                  <>
                    <Button
                      title={busyAction === "sync" ? t("pos.square.syncing") : t("pos.square.syncNow")}
                      onPress={() => void syncSquare()}
                      disabled={!actionsEditable}
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
                      disabled={!actionsEditable}
                      accessibilityHint={t("pos.square.disconnectHint")}
                    />
                  </>
                ) : (
                  <Button
                    title={
                      busyAction === "connect" ? t("pos.square.connecting") : t("pos.square.connect")
                    }
                    onPress={() => void connectSquare()}
                    disabled={!actionsEditable}
                    accessibilityHint={t("pos.square.connectHint")}
                  />
                )
              ) : (
                <Text style={styles.meta}>
                  {canManage ? t("common.loading") : t("pos.square.ownerRequired")}
                </Text>
              )}
              <Button
                title={t("pos.restricted.importCsv")}
                variant="secondary"
                onPress={() => router.push("/settings/sales-import" as never)}
                disabled={!hubReady}
                accessibilityHint={t("pos.provider.hintCsvImport")}
              />
            </View>
            {visibleSquareConnected && canReviewMappings ? (
              <View style={styles.mappingReview}>
                <OperationalRow
                  title={t("pos.mappings.title")}
                  subtitle={
                    mappingReviewCount === null
                      ? t("pos.mappings.loading")
                      : mappingReviewCount === 1
                        ? t("pos.mappings.needReview.one", { count: "1" })
                        : t("pos.mappings.needReview.other", { count: String(mappingReviewCount) })
                  }
                  icon={<ListChecks size={icon.row} color={colors.accentDark} strokeWidth={iconStroke} />}
                  iconTone={mappingReviewCount ? "warning" : "leaf"}
                  badgeLabel={mappingReviewCount ? String(mappingReviewCount) : undefined}
                  badgeTone="warning"
                  onPress={() => router.push("/settings/pos-mappings" as never)}
                  accessibilityHint={t("pos.mappings.openHint")}
                />
                {modifierSummary && modifierSummary.modifiersUniqueCount > 0 ? (
                  <OperationalRow
                    title={t("pos.modifiers.title")}
                    subtitle={
                      modifierSummary.modifiersUniqueCount === 1
                        ? t("pos.modifiers.observed.one", { count: "1" })
                        : t("pos.modifiers.observed.other", {
                            count: String(modifierSummary.modifiersUniqueCount)
                          })
                    }
                    icon={<PlugZap size={icon.row} color={colors.accentDark} strokeWidth={iconStroke} />}
                    iconTone="warning"
                    badgeLabel={String(modifierSummary.modifiersUniqueCount)}
                    badgeTone="warning"
                    onPress={() => router.push("/settings/recipes" as never)}
                    accessibilityHint={t("pos.modifiers.openHint")}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function pilotReadinessAreaLabel(
  area: PilotReadinessAreaId,
  t: ReturnType<typeof useLocale>["t"]
) {
  switch (area) {
    case "pos_sales": return t("pos.readiness.area.posSales");
    case "inventory_counts": return t("pos.readiness.area.inventoryCounts");
    case "recipe_coverage": return t("pos.readiness.area.recipeCoverage");
    case "supplier_routing": return t("pos.readiness.area.supplierRouting");
    case "email_delivery": return t("pos.readiness.area.emailDelivery");
  }
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
            <FileText size={icon.row} color={colors.text} strokeWidth={iconStroke} />
          ) : selected ? (
            <CheckCircle size={icon.row} color={colors.success} strokeWidth={iconStroke} />
          ) : (
            <PlugZap size={icon.row} color={colors.muted} strokeWidth={iconStroke} />
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
    backgroundColor: colors.surface
  },
  providerCopy: { flex: 1, gap: 2 },
  providerTitle: { ...typography.cardTitle, color: colors.text },
  providerBody: { ...typography.caption, color: colors.muted },
  providerAction: { ...typography.caption, color: colors.accentDark, fontWeight: "700" },
  restrictedTitle: { ...typography.cardTitle, color: colors.text },
  restrictedCopy: { ...typography.body, color: colors.muted, marginTop: 6 },
  meta: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  mappingReview: {
    marginTop: spacing.md,
    gap: spacing.sm
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 }
});
