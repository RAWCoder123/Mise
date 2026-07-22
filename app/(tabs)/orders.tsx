import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { LockKeyhole, Mail, RotateCcw, Truck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RecommendationDecisionRow } from "../../components/RecommendationDecisionRow";
import { SupplierDraftCard } from "../../components/SupplierDraftCard";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { TrendLineChart } from "../../components/ui/TrendLineChart";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  approvePurchaseRecommendation,
  dismissPurchaseRecommendation,
  fetchEmailConnectionState,
  fetchPurchaseRecommendations,
  fetchSupplierOrders,
  fetchSupplierSpendTrend,
  isGmailIntegrationError,
  sendSupplierOrderEmail,
  undoPurchaseRecommendationAction,
  type SupplierSpendTrendPoint
} from "../../services/miseService";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";
import { trackMiseEvent } from "../../services/telemetry";
import type { PurchaseRecommendation, RestaurantEmailConnection, SupplierOrder } from "../../types/mise";

type OrderLane = "drafts" | "sent" | "history";
type RecommendationAction = "approve" | "dismiss";

interface UndoAction {
  id: string;
  action: "approved" | "dismissed";
  recommendation: PurchaseRecommendation;
  busy: boolean;
}

const EMPTY_ACTIONS: Record<string, RecommendationAction | undefined> = {};

export default function OrdersScreen() {
  const { formatCompactCurrency, formatDate, formatNumber, locale, parseNumber, t } = useLocale();
  const { memberships, restaurant, usingLocalDemo } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canConnectGmail = canDeleteRestaurantData(memberships, restaurant?.id);
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [spendTrend, setSpendTrend] = useState<SupplierSpendTrendPoint[]>([]);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [lane, setLane] = useState<OrderLane>("drafts");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string | undefined>>({});
  const [recommendationActions, setRecommendationActions] =
    useState<Record<string, RecommendationAction | undefined>>(EMPTY_ACTIONS);
  const [sendingOrderIds, setSendingOrderIds] = useState<Record<string, boolean>>({});
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<StatusNoticeTone>("neutral");
  const [messageRestaurantId, setMessageRestaurantId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const recommendationLocksRef = useRef(new Set<string>());
  const sendingLocksRef = useRef(new Set<string>());
  const undoLockRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const quantityLocaleRef = useRef(locale);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  function showMessage(
    nextMessage: string | null,
    restaurantId = restaurant?.id ?? null,
    tone: StatusNoticeTone = "success"
  ) {
    setMessage(nextMessage);
    setMessageTone(nextMessage ? tone : "neutral");
    setMessageRestaurantId(nextMessage ? restaurantId : null);
  }

  const load = useCallback(
    async (showLoading = false) => {
      if (!restaurant) {
        setLoading(false);
        return;
      }

      const restaurantId = restaurant.id;
      const requestId = ++requestIdRef.current;
      if (showLoading || loadedRestaurantRef.current !== restaurantId) setLoading(true);
      setLoadError(null);

      try {
        const [nextRecommendations, nextOrders, nextEmailConnection, nextSpendTrend] = await Promise.all([
          fetchPurchaseRecommendations(restaurantId, "pending"),
          fetchSupplierOrders(restaurantId),
          fetchEmailConnectionState(restaurantId),
          fetchSupplierSpendTrend(restaurantId)
        ]);
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

        setRecommendations(nextRecommendations);
        setOrders(nextOrders);
        setEmailConnection(nextEmailConnection);
        setSpendTrend(nextSpendTrend);
        setQuantities((current) => {
          const next: Record<string, string> = {};
          nextRecommendations.forEach((recommendation) => {
            next[recommendation.id] =
              current[recommendation.id] ?? formatNumber(recommendation.recommended_quantity, {
                maximumFractionDigits: 3
              });
          });
          return next;
        });
        loadedRestaurantRef.current = restaurantId;
      } catch {
        if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
          setLoadError(t("orders.error.load"));
        }
      } finally {
        if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
      }
    },
    [formatNumber, restaurant?.id, t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    recommendationLocksRef.current.clear();
    sendingLocksRef.current.clear();
    undoLockRef.current = false;
    setRecommendations([]);
    setOrders([]);
    setSpendTrend([]);
    setEmailConnection(null);
    setQuantities({});
    setQuantityErrors({});
    setRecommendationActions(EMPTY_ACTIONS);
    setSendingOrderIds({});
    setUndoAction(null);
    setMessage(null);
    setMessageTone("neutral");
    setMessageRestaurantId(null);
    setLoadError(null);
    setLane("drafts");
  }, [restaurant?.id]);

  useEffect(() => {
    if (!canManage) setUndoAction(null);
  }, [canManage]);

  useEffect(() => {
    if (quantityLocaleRef.current === locale) return;
    quantityLocaleRef.current = locale;
    setQuantities(Object.fromEntries(recommendations.map((recommendation) => [
      recommendation.id,
      formatNumber(recommendation.recommended_quantity, { maximumFractionDigits: 3 })
    ])));
    setQuantityErrors({});
  }, [formatNumber, locale, recommendations]);

  useFocusEffect(
    useCallback(() => {
      void load(loadedRestaurantRef.current !== restaurant?.id);
    }, [load, restaurant?.id])
  );

  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => showMessage(null), 4200);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!undoAction) return undefined;
    const timeout = setTimeout(() => setUndoAction(null), 7000);
    return () => clearTimeout(timeout);
  }, [undoAction?.id]);

  const dataMatchesActiveRestaurant = loadedRestaurantRef.current === restaurant?.id;
  const visibleRecommendations = dataMatchesActiveRestaurant ? recommendations : [];
  const visibleOrders = dataMatchesActiveRestaurant ? orders : [];
  const visibleSpendTrend = dataMatchesActiveRestaurant ? spendTrend : [];
  const visibleEmailConnection = dataMatchesActiveRestaurant ? emailConnection : null;
  const visibleMessage = messageRestaurantId === restaurant?.id ? message : null;
  const visibleUndoAction = dataMatchesActiveRestaurant && canManage ? undoAction : null;

  const groupedRecommendations = useMemo(() => {
    const groups = new Map<string, PurchaseRecommendation[]>();
    visibleRecommendations.forEach((recommendation) => {
      const current = groups.get(recommendation.supplier_name) ?? [];
      current.push(recommendation);
      groups.set(recommendation.supplier_name, current);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visibleRecommendations]);

  const draftOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === "draft"),
    [visibleOrders]
  );
  const sentOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === "sent"),
    [visibleOrders]
  );
  const completedOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === "completed"),
    [visibleOrders]
  );
  const laneOptions = useMemo<readonly SegmentOption<OrderLane>[]>(
    () => {
      const draftsLabel = t("orders.lane.drafts");
      const sentLabel = t("orders.lane.sent");
      const historyLabel = t("orders.lane.history");
      return [
        {
          value: "drafts",
          label: draftsLabel,
          accessibilityLabel: t("orders.lane.optionAccessibility", {
            lane: draftsLabel,
            count: formatNumber(draftOrders.length)
          })
        },
        {
          value: "sent",
          label: sentLabel,
          accessibilityLabel: t("orders.lane.optionAccessibility", {
            lane: sentLabel,
            count: formatNumber(sentOrders.length)
          })
        },
        {
          value: "history",
          label: historyLabel,
          accessibilityLabel: t("orders.lane.optionAccessibility", {
            lane: historyLabel,
            count: formatNumber(completedOrders.length)
          })
        }
      ];
    },
    [completedOrders.length, draftOrders.length, formatNumber, sentOrders.length, t]
  );
  const gmailStatus = visibleEmailConnection?.status ?? "not_connected";
  const gmailIsConnected = gmailStatus === "connected";
  const gmailNeedsAttention = gmailStatus === "needs_reauth" || gmailStatus === "restricted";
  const canSendOrders = canManage && gmailIsConnected;
  const gmailTitle = usingLocalDemo
    ? t("orders.gmail.demo.title")
    : gmailIsConnected
      ? t("orders.gmail.connected.title")
      : gmailStatus === "needs_reauth"
        ? t("orders.gmail.reauth.title")
        : t("orders.gmail.ready.title");
  const gmailBody = usingLocalDemo
    ? t("orders.gmail.demo.body")
    : gmailIsConnected
      ? t("orders.gmail.connected.body", {
          sender: visibleEmailConnection?.sender_email ?? t("orders.gmail.connected.fallbackSender")
        })
      : canConnectGmail
        ? t("orders.gmail.connect.body")
        : t("orders.gmail.readOnly.body");
  const gmailActionTitle = usingLocalDemo
    ? t("orders.gmail.action.viewSetup")
    : gmailIsConnected
      ? t("orders.gmail.action.manage")
      : gmailStatus === "needs_reauth"
        ? t("orders.gmail.action.reconnect")
        : t("orders.gmail.action.link");

  function setRecommendationBusy(
    recommendationId: string,
    action: RecommendationAction | undefined
  ) {
    if (action) recommendationLocksRef.current.add(recommendationId);
    else recommendationLocksRef.current.delete(recommendationId);

    setRecommendationActions((current) => {
      if (action) return { ...current, [recommendationId]: action };
      const next = { ...current };
      delete next[recommendationId];
      return next;
    });
  }

  function setOrderBusy(orderId: string, busy: boolean) {
    if (busy) sendingLocksRef.current.add(orderId);
    else sendingLocksRef.current.delete(orderId);

    setSendingOrderIds((current) => {
      if (busy) return { ...current, [orderId]: true };
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }

  function registerUndo(
    recommendation: PurchaseRecommendation,
    action: UndoAction["action"]
  ) {
    setUndoAction({
      id: recommendation.id + "_" + Date.now(),
      action,
      recommendation,
      busy: false
    });
  }

  async function approve(recommendation: PurchaseRecommendation) {
    if (!restaurant || recommendationLocksRef.current.has(recommendation.id)) return;
    if (!canManage) {
      showMessage(t("orders.error.viewOnly"), restaurant.id, "neutral");
      return;
    }
    const restaurantId = restaurant.id;

    const rawQuantity = quantities[recommendation.id]?.trim() ?? "";
    const nextQuantity = parseNumber(rawQuantity);
    if (
      !rawQuantity ||
      nextQuantity === null ||
      nextQuantity <= 0 ||
      nextQuantity > operatingLimits.recommendationQuantity
    ) {
      setQuantityErrors((current) => ({
        ...current,
        [recommendation.id]: t("orders.validation.quantityRange", {
          maximum: formatNumber(operatingLimits.recommendationQuantity)
        })
      }));
      return;
    }

    setQuantityErrors((current) => ({ ...current, [recommendation.id]: undefined }));
    setRecommendationBusy(recommendation.id, "approve");

    try {
      const approved = await approvePurchaseRecommendation(
        restaurantId,
        recommendation.id,
        nextQuantity
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      registerUndo(approved, "approved");
      trackMiseEvent("recommendation_approved", {
        restaurant_id: restaurantId,
        supplier_name: recommendation.supplier_name,
        urgency: recommendation.urgency
      });
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id)
      );
      showMessage(t("orders.notice.approved", { item: approved.item_name }), restaurantId);
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        showMessage(t("orders.error.approve"), restaurantId, "danger");
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setRecommendationBusy(recommendation.id, undefined);
        await load(false);
      }
    }
  }

  async function dismiss(recommendation: PurchaseRecommendation) {
    if (!restaurant || recommendationLocksRef.current.has(recommendation.id)) return;
    if (!canManage) {
      showMessage(t("orders.error.viewOnly"), restaurant.id, "neutral");
      return;
    }
    const restaurantId = restaurant.id;

    setRecommendationBusy(recommendation.id, "dismiss");

    try {
      const dismissed = await dismissPurchaseRecommendation(restaurantId, recommendation.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      registerUndo(dismissed, "dismissed");
      trackMiseEvent("recommendation_dismissed", {
        restaurant_id: restaurantId,
        supplier_name: recommendation.supplier_name,
        urgency: recommendation.urgency
      });
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id)
      );
      showMessage(t("orders.notice.dismissed", { item: dismissed.item_name }), restaurantId);
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        showMessage(t("orders.error.dismiss"), restaurantId, "danger");
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setRecommendationBusy(recommendation.id, undefined);
        await load(false);
      }
    }
  }

  async function undoLastAction() {
    if (!restaurant || !undoAction || undoLockRef.current) return;
    if (!canManage) {
      showMessage(t("orders.error.viewOnly"), restaurant.id, "neutral");
      setUndoAction(null);
      return;
    }
    const restaurantId = restaurant.id;

    undoLockRef.current = true;
    setUndoAction((current) => (current ? { ...current, busy: true } : current));
    try {
      const restored = await undoPurchaseRecommendationAction(
        restaurantId,
        undoAction.recommendation.id
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      trackMiseEvent("recommendation_undo", {
        restaurant_id: restaurantId,
        supplier_name: restored.supplier_name,
        action: undoAction.action
      });
      showMessage(t("orders.notice.undoRestored", { item: restored.item_name }), restaurantId);
      setUndoAction(null);
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        showMessage(t("orders.error.undo"), restaurantId, "danger");
        setUndoAction(null);
      }
    } finally {
      undoLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) await load(false);
    }
  }

  async function copyOrder(order: SupplierOrder) {
    try {
      await Clipboard.setStringAsync(order.order_message);
      trackMiseEvent("order_copied", {
        restaurant_id: order.restaurant_id,
        supplier_name: order.supplier_name,
        status: order.status
      });
      showMessage(t("orders.notice.copied", { supplier: order.supplier_name }), order.restaurant_id);
    } catch {
      showMessage(t("orders.error.copy"), order.restaurant_id, "danger");
    }
  }

  async function sendOrder(order: SupplierOrder) {
    if (!restaurant || sendingLocksRef.current.has(order.id)) return;
    if (!canManage) {
      showMessage(t("orders.error.viewOnly"), restaurant.id, "neutral");
      return;
    }
    const restaurantId = restaurant.id;

    setOrderBusy(order.id, true);
    try {
      const result = await sendSupplierOrderEmail(restaurantId, order.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const movedCount = result.orderedRecommendations.length;
      const wasAlreadySent = result.outcome !== "applied";
      setUndoAction((current) =>
        current?.recommendation.supplier_name === order.supplier_name ? null : current
      );
      const sendMessage = usingLocalDemo
        ? wasAlreadySent
          ? t("orders.notice.send.demo.already", { supplier: order.supplier_name })
          : t(
              movedCount === 0
                ? "orders.notice.send.demo.zero"
                : movedCount === 1
                  ? "orders.notice.send.demo.one"
                  : "orders.notice.send.demo.other",
              { supplier: order.supplier_name, count: formatNumber(movedCount) }
            )
        : wasAlreadySent
          ? t("orders.notice.send.gmail.already", { supplier: order.supplier_name })
          : t(
              movedCount === 0
                ? "orders.notice.send.gmail.zero"
                : movedCount === 1
                  ? "orders.notice.send.gmail.one"
                  : "orders.notice.send.gmail.other",
              { supplier: order.supplier_name, count: formatNumber(movedCount) }
            );
      showMessage(sendMessage, restaurantId);
      setLane("sent");
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        let detail = t(usingLocalDemo ? "orders.error.send.demo" : "orders.error.send.gmail");
        if (isGmailIntegrationError(error)) {
          if (error.status === "needs_reauth") detail = t("orders.error.send.reauth");
          else if (error.status === "gmail_not_connected") detail = t("orders.error.send.notConnected");
          else if (error.status === "supplier_email_missing" || error.status === "supplier_email_invalid") {
            detail = t("orders.error.send.supplierEmail");
          } else if (error.status === "delivery_requires_review" || error.status === "in_progress") {
            detail = t("orders.error.send.review");
          } else if (error.status === "live_sending_disabled" || error.status === "server_configuration_missing") {
            detail = t("orders.error.send.disabled");
          }
        }
        showMessage(detail, restaurantId, "danger");
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setOrderBusy(order.id, false);
        await load(false);
      }
    }
  }

  return (
    <Screen
      title={t("orders.title")}
      loading={loading}
    >
      <View style={styles.stack}>
        <SegmentedControl
          accessibilityLabel={t("orders.lane.accessibility")}
          options={laneOptions}
          value={lane}
          onValueChange={setLane}
          variant="underline"
          style={styles.tabs}
        />

        {loadError ? (
          <RetryNotice
            title={t("orders.retry.title")}
            message={loadError}
            accessibilityLabel={t("orders.retry.accessibility")}
            onRetry={() => void load(true)}
          />
        ) : null}

        {!canManage ? (
          <StatusNotice
            title={t("orders.readOnly.title")}
            message={t("orders.readOnly.body")}
          />
        ) : null}

        {visibleMessage ? (
          <StatusNotice
            title={
              messageTone === "danger"
                ? t("orders.status.attention")
                : messageTone === "success"
                  ? t("orders.status.updated")
                  : t("orders.status.neutral")
            }
            message={visibleMessage}
            tone={messageTone}
          />
        ) : null}

        <MotionView key={lane} distance={4} duration={220} style={styles.laneContent}>
          {lane === "drafts" ? (
            <>
              <SectionSurface padding="none">
                <View style={styles.emailMain}>
                  <View
                    style={[
                      styles.mailIcon,
                      gmailIsConnected && styles.mailIconConnected,
                      gmailNeedsAttention && styles.mailIconAttention
                    ]}
                  >
                    <Mail
                      size={22}
                      color={gmailIsConnected ? colors.success : gmailNeedsAttention ? colors.caution : colors.muted}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.emailCopy}>
                    <Text style={styles.emailTitle}>{gmailTitle}</Text>
                    <Text style={styles.emailBody}>{gmailBody}</Text>
                  </View>
                  {canConnectGmail ? (
                    <Button
                      title={gmailActionTitle}
                      variant="secondary"
                      accessibilityLabel={t("orders.gmail.settingsAccessibility")}
                      onPress={() => router.push("/settings/gmail" as never)}
                      style={styles.emailButton}
                    />
                  ) : null}
                </View>
                <View style={styles.emailSecurity}>
                  <LockKeyhole size={12} color={colors.muted} strokeWidth={1.8} />
                  <Text style={styles.emailSecurityText}>
                    {usingLocalDemo
                      ? t("orders.gmail.security.demo")
                      : t("orders.gmail.security.live")}
                  </Text>
                </View>
              </SectionSurface>

              {draftOrders.length === 0 ? (
                <EmptyState
                  compact
                  title={t("orders.empty.drafts.title")}
                  body={t("orders.empty.drafts.body")}
                />
              ) : (
                draftOrders.map((order) => (
                  <SupplierDraftCard
                    key={order.id}
                    order={order}
                    onCopy={() => void copyOrder(order)}
                    onOpen={() =>
                      router.push({ pathname: "/orders/[id]", params: { id: order.id } })
                    }
                    onSend={() => void sendOrder(order)}
                    showSend={canManage}
                    canSend={canSendOrders}
                    sendLabel={t(usingLocalDemo ? "orders.action.simulateSend" : "orders.action.gmailSend")}
                    busyLabel={t(usingLocalDemo ? "orders.action.simulating" : "orders.action.gmailSending")}
                    sendAccessibilityLabel={t(
                      usingLocalDemo
                        ? "orders.card.simulateSendAccessibility"
                        : "orders.card.gmailSendAccessibility",
                      { supplier: order.supplier_name }
                    )}
                    sendDisabledHint={
                      canConnectGmail
                        ? t("orders.action.sendDisabledOwner")
                        : t("orders.action.sendDisabledManager")
                    }
                    busy={Boolean(sendingOrderIds[order.id])}
                  />
                ))
              )}

              {visibleRecommendations.length > 0 ? (
                <View style={styles.reviewQueue}>
                  <SectionHeader
                    title={t("orders.review.title")}
                    actionTone="caution"
                    action={t(
                      visibleRecommendations.length === 1
                        ? "orders.review.total.one"
                        : "orders.review.total.other",
                      { count: formatNumber(visibleRecommendations.length) }
                    )}
                    size="compact"
                  />
                  {groupedRecommendations.map(([supplierName, supplierRecommendations]) => (
                    <SectionSurface key={supplierName} padding="none">
                      <View style={styles.supplierHeader}>
                        <View style={styles.supplierIcon}>
                          <Truck size={20} color={colors.success} strokeWidth={2.25} />
                        </View>
                        <View style={styles.supplierHeaderCopy}>
                          <Text style={styles.supplierName}>{supplierName}</Text>
                          <Text style={styles.supplierMeta}>
                            {t(
                              supplierRecommendations.length === 1
                                ? "orders.review.supplier.one"
                                : "orders.review.supplier.other",
                              { count: formatNumber(supplierRecommendations.length) }
                            )}
                          </Text>
                        </View>
                      </View>
                      {supplierRecommendations.map((recommendation, index) => (
                        <RecommendationDecisionRow
                          key={recommendation.id}
                          recommendation={recommendation}
                          quantity={quantities[recommendation.id] ?? formatNumber(
                            recommendation.recommended_quantity,
                            { maximumFractionDigits: 3 }
                          )}
                          onQuantityChange={(value) => {
                            setQuantities((current) => ({ ...current, [recommendation.id]: value }));
                            setQuantityErrors((current) => ({ ...current, [recommendation.id]: undefined }));
                          }}
                          onApprove={() => void approve(recommendation)}
                          onDismiss={() => void dismiss(recommendation)}
                          action={recommendationActions[recommendation.id]}
                          error={quantityErrors[recommendation.id]}
                          readOnly={!canManage}
                          showDivider={index < supplierRecommendations.length - 1}
                        />
                      ))}
                    </SectionSurface>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {lane === "sent" ? (
            <>
              {visibleSpendTrend.length >= 2 ? (
                <SectionSurface
                  title={t("orders.spend.title")}
                  subtitle={t("orders.spend.subtitle")}
                >
                  <TrendLineChart
                    series={[{ values: visibleSpendTrend.map((point) => point.spend) }]}
                    labels={visibleSpendTrend.map((point) =>
                      formatDate(`${point.date}T12:00:00`, { month: "numeric", day: "numeric" })
                    )}
                    height={116}
                    formatValue={(value) => formatCompactCurrency(value, restaurant?.currency)}
                    accessibilityLabel={t("orders.spend.accessibility", {
                      count: formatNumber(visibleSpendTrend.length),
                      latest: formatCompactCurrency(
                        visibleSpendTrend[visibleSpendTrend.length - 1]?.spend ?? 0,
                        restaurant?.currency
                      )
                    })}
                  />
                </SectionSurface>
              ) : null}
              {sentOrders.length === 0 ? (
                <EmptyState
                  compact
                  title={t("orders.empty.sent.title")}
                  body={t("orders.empty.sent.body")}
                />
              ) : (
                sentOrders.map((order) => (
                  <SupplierDraftCard
                    key={order.id}
                    order={order}
                    onCopy={() => void copyOrder(order)}
                    onOpen={() =>
                      router.push({ pathname: "/orders/[id]", params: { id: order.id } })
                    }
                  />
                ))
              )}
            </>
          ) : null}

          {lane === "history" ? (
            completedOrders.length === 0 ? (
              <EmptyState
                compact
                title={t("orders.empty.history.title")}
                body={t("orders.empty.history.body")}
              />
            ) : (
              completedOrders.map((order) => (
                <SupplierDraftCard
                  key={order.id}
                  order={order}
                  onCopy={() => void copyOrder(order)}
                  onOpen={() =>
                    router.push({ pathname: "/orders/[id]", params: { id: order.id } })
                  }
                />
              ))
            )
          ) : null}
        </MotionView>
      </View>

      {visibleUndoAction ? (
        <View style={styles.undoToast} accessibilityLiveRegion="polite">
          <RotateCcw size={18} color={colors.surface} strokeWidth={2.25} />
          <Text style={styles.undoText} numberOfLines={2}>
            {t(
              visibleUndoAction.action === "approved"
                ? "orders.undo.approved"
                : "orders.undo.dismissed",
              { item: visibleUndoAction.recommendation.item_name }
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              visibleUndoAction.action === "approved"
                ? "orders.undo.approvedAccessibility"
                : "orders.undo.dismissedAccessibility",
              { item: visibleUndoAction.recommendation.item_name }
            )}
            disabled={visibleUndoAction.busy}
            onPress={() => void undoLastAction()}
            style={({ pressed }) => [
              styles.undoButton,
              pressed && styles.undoButtonPressed,
              visibleUndoAction.busy && styles.undoButtonDisabled
            ]}
          >
            <Text style={styles.undoButtonText}>
              {t(visibleUndoAction.busy ? "orders.undo.busy" : "orders.undo.action")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14,
    paddingBottom: 72
  },
  tabs: {
    marginTop: -8
  },
  laneContent: {
    gap: 14
  },
  emailMain: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  mailIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center"
  },
  mailIconConnected: {
    backgroundColor: colors.successSoft
  },
  mailIconAttention: {
    backgroundColor: colors.cautionSoft
  },
  emailCopy: {
    flex: 1,
    minWidth: 0
  },
  emailTitle: {
    color: colors.text,
    ...typography.caption,
    fontSize: 12
  },
  emailBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2
  },
  emailButton: {
    paddingHorizontal: 10
  },
  emailSecurity: {
    minHeight: 29,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  emailSecurityText: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10,
    lineHeight: 13
  },
  reviewQueue: {
    gap: 10,
    paddingTop: 4
  },
  supplierHeader: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  supplierIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  supplierHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  supplierName: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 16,
    lineHeight: 21
  },
  supplierMeta: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 1
  },
  undoToast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  undoText: {
    flex: 1,
    minWidth: 0,
    color: colors.surface,
    ...typography.caption,
    fontWeight: "500"
  },
  undoButton: {
    minWidth: 66,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  undoButtonPressed: {
    opacity: 0.72
  },
  undoButtonDisabled: {
    opacity: 0.5
  },
  undoButtonText: {
    color: colors.surface,
    ...typography.caption
  }
});
