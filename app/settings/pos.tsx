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
import { colors, icon, iconStroke, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  connectRestaurantSquare,
  disconnectRestaurantSquare,
  fetchPilotReadiness,
  fetchSquarePosIntegration,
  isSquareIntegrationError,
  reviewPosCatalogMapping,
  selectPosLocation,
  syncSquarePosSales
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import type { PilotReadiness, PilotReadinessAreaId } from "../../services/domain/pilotReadiness";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import type { PosIntegration, PosProvider } from "../../types/mise";

const providers: PosProvider[] = ["Toast", "Square", "Clover", "Lightspeed", "Manual CSV Upload"];
type BusyAction =
  | "connect"
  | "disconnect"
  | "sync"
  | `location:${string}`
  | `mapping:${string}:${"verified" | "rejected"}`;
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
  const [pilotReadiness, setPilotReadiness] = useState<PilotReadiness | null>(null);
  const [readinessLoadError, setReadinessLoadError] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(!isDemoMode);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "danger" | "neutral";
    title: string;
    message: string;
  } | null>(null);
  const requestIdRef = useRef(0);
  const readinessRequestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;
  const canManageConnection = canDeleteRestaurantData(memberships, restaurant?.id);
  const canReviewPlanning = canManageRestaurantData(memberships, restaurant?.id);
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
    setLoadingIntegration(Boolean(restaurant) && !isDemoMode);
    if (isDemoMode && restaurant) {
      setLoadedRestaurantId(restaurant.id);
      setLoadingIntegration(false);
    }
  }, [isDemoMode, restaurant?.id]);

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
    allowed: canManageConnection,
    hubReady,
    busy: busyAction !== null || loadingProvider !== null
  });
  const visibleIntegration = hubReady ? integration : null;
  const visibleSquareConnected = visibleIntegration?.status === "connected";
  const planningActionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canReviewPlanning,
    hubReady,
    busy: busyAction !== null || loadingProvider !== null
  });
  const selectedLocation = visibleIntegration?.locations?.find(
    (location) => location.status === "active" && location.selected_for_planning
  ) ?? null;
  const visibleMappings = (visibleIntegration?.catalog_mappings ?? []).filter(
    (mapping) => !selectedLocation || mapping.pos_location_id === selectedLocation.id
  );

  useFocusEffect(
    useCallback(() => {
      void loadIntegration(false);
      void loadPilotReadiness();
    }, [loadIntegration, loadPilotReadiness])
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
      await Promise.all([loadIntegration(false), loadPilotReadiness()]);
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
      const to = new Date();
      const from = new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);
      const result = await syncSquarePosSales(
        restaurantId,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10)
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage({
        key: "pos.message.syncCompleted",
        values: { count: String(result.recordsProcessed) }
      });
      setNotice({
        tone: "success",
        title: t("pos.square.syncTitle"),
        message: t("pos.square.syncBody", { count: String(result.recordsProcessed) })
      });
      await Promise.all([loadIntegration(false), loadPilotReadiness()]);
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.square.syncErrorTitle"),
        message: isSquareIntegrationError(error) && error.status === "location_selection_required"
          ? t("pos.square.locationRequired")
          : t("pos.square.syncErrorBody")
      });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function choosePlanningLocation(locationId: string) {
    if (!restaurant || !planningActionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyAction(`location:${locationId}`);
    setNotice(null);
    try {
      await selectPosLocation(restaurantId, locationId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await loadIntegration(false);
      await loadPilotReadiness();
      setNotice({
        tone: "success",
        title: t("pos.location.selectedTitle"),
        message: t("pos.location.selectedBody")
      });
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.location.errorTitle"),
        message: error instanceof Error ? error.message : t("pos.location.errorBody")
      });
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyAction(null);
    }
  }

  async function reviewCatalogMapping(mappingId: string, decision: "verified" | "rejected") {
    if (!restaurant || !planningActionsEditable) return;
    const restaurantId = restaurant.id;
    setBusyAction(`mapping:${mappingId}:${decision}`);
    setNotice(null);
    try {
      await reviewPosCatalogMapping(restaurantId, mappingId, decision);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await loadIntegration(false);
      await loadPilotReadiness();
      setNotice({
        tone: decision === "verified" ? "success" : "neutral",
        title: t(decision === "verified" ? "pos.mapping.verifiedTitle" : "pos.mapping.rejectedTitle"),
        message: t("pos.mapping.reviewedBody")
      });
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice({
        tone: "danger",
        title: t("pos.mapping.errorTitle"),
        message: error instanceof Error ? error.message : t("pos.mapping.errorBody")
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
          <>
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
                    {canManageConnection ? t("common.loading") : t("pos.square.ownerRequired")}
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
            </Card>

            {visibleSquareConnected ? (
              <>
                <Card>
                  <Text style={styles.restrictedTitle}>{t("pos.location.title")}</Text>
                  <Text style={styles.restrictedCopy}>{t("pos.location.body")}</Text>
                  <View style={styles.reviewList}>
                    {(visibleIntegration?.locations ?? []).length === 0 ? (
                      <Text style={styles.meta}>{t("pos.location.empty")}</Text>
                    ) : (visibleIntegration?.locations ?? []).map((location) => (
                      <View key={location.id} style={styles.reviewRow}>
                        <View style={styles.reviewCopy}>
                          <Text style={styles.reviewTitle}>{location.display_name}</Text>
                          <Text style={styles.metaInline}>
                            {location.selected_for_planning
                              ? t("pos.location.selected")
                              : t(`pos.location.status.${location.status}`)}
                          </Text>
                        </View>
                        <Button
                          title={
                            busyAction === `location:${location.id}`
                              ? t("common.saving")
                              : location.selected_for_planning
                                ? t("pos.location.selected")
                                : t("pos.location.select")
                          }
                          size="compact"
                          variant={location.selected_for_planning ? "soft" : "secondary"}
                          disabled={!planningActionsEditable || location.status !== "active" || location.selected_for_planning}
                          onPress={() => void choosePlanningLocation(location.id)}
                          accessibilityLabel={t("pos.location.selectAccessibility", {
                            location: location.display_name
                          })}
                          accessibilityHint={t("pos.location.selectHint")}
                        />
                      </View>
                    ))}
                  </View>
                </Card>

                <Card>
                  <Text style={styles.restrictedTitle}>{t("pos.mapping.title")}</Text>
                  <Text style={styles.restrictedCopy}>{t("pos.mapping.body")}</Text>
                  {!selectedLocation ? (
                    <Text style={styles.meta}>{t("pos.mapping.selectLocation")}</Text>
                  ) : visibleMappings.length === 0 ? (
                    <Text style={styles.meta}>{t("pos.mapping.empty")}</Text>
                  ) : (
                    <View style={styles.reviewList}>
                      {visibleMappings.map((mapping) => (
                        <View key={mapping.id} style={styles.mappingRow}>
                          <View style={styles.reviewCopy}>
                            <Text style={styles.reviewTitle}>{mapping.external_name}</Text>
                            <Text style={styles.metaInline}>
                              {mapping.verification_status === "verified"
                                ? t("pos.mapping.verified")
                                : mapping.verification_status === "rejected"
                                  ? t("pos.mapping.rejected")
                                  : t("pos.mapping.needsReview")}
                            </Text>
                          </View>
                          {mapping.verification_status === "draft" ? (
                            <View style={styles.inlineActions}>
                              <Button
                                title={
                                  busyAction === `mapping:${mapping.id}:verified`
                                    ? t("common.saving")
                                    : t("pos.mapping.verify")
                                }
                                size="compact"
                                variant="soft"
                                disabled={!planningActionsEditable}
                                onPress={() => void reviewCatalogMapping(mapping.id, "verified")}
                                accessibilityLabel={t("pos.mapping.verifyAccessibility", {
                                  item: mapping.external_name
                                })}
                                accessibilityHint={t("pos.mapping.reviewHint")}
                              />
                              <Button
                                title={
                                  busyAction === `mapping:${mapping.id}:rejected`
                                    ? t("common.saving")
                                    : t("pos.mapping.reject")
                                }
                                size="compact"
                                variant="ghost"
                                disabled={!planningActionsEditable}
                                onPress={() => void reviewCatalogMapping(mapping.id, "rejected")}
                                accessibilityLabel={t("pos.mapping.rejectAccessibility", {
                                  item: mapping.external_name
                                })}
                                accessibilityHint={t("pos.mapping.reviewHint")}
                              />
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </>
            ) : null}
          </>
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
  reviewList: { gap: spacing.sm, marginTop: spacing.md },
  reviewRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  mappingRow: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
  metaInline: { ...typography.caption, color: colors.muted, marginTop: 2 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.55 }
});
