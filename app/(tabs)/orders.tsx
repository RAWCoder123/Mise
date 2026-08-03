import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { LockKeyhole, Mail, RotateCcw, Search, Truck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  approvePurchaseRecommendation,
  confirmSupplierOrderPlaced,
  dismissPurchaseRecommendation,
  fetchEmailConnectionState,
  fetchPurchaseRecommendations,
  fetchSupplierOrders,
  isGmailIntegrationError,
  sendSupplierOrderEmail,
  undoPurchaseRecommendationAction
} from "../../services/miseService";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import {
  filterInventoryItemsBySearch,
  filterSupplierOrdersBySearch,
  PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD,
  SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD
} from "../../services/domain/inventoryItemSearch";
import { buildRecommendationDecisionTelemetry } from "../../services/domain/recommendationFeedback";
import {
  operatingLimits,
  RECOMMENDATION_DISMISS_REASON_MAX_CHARACTERS
} from "../../services/miseValidation";
import {
  presentOrderDetailSendErrorNotice,
  resolveOrderDetailSendErrorReason,
  type OrderDetailSendErrorReason
} from "../../services/presentation/orderDetailPresentation";
import {
  presentOrdersHubGmailCopy,
  presentOrdersHubLaneEmptyCopy,
  presentOrdersHubMutationNoticeCopy,
  resolveOrdersHubLoadState,
  resolveOrdersHubSendSuccessReason,
  type OrdersHubMutationNoticeReason,
  type OrdersHubNoticeRecovery
} from "../../services/presentation/ordersHubPresentation";
import { captureMiseError, trackMiseEvent } from "../../services/telemetry";
import type { PurchaseRecommendation, RestaurantEmailConnection, SupplierOrder } from "../../types/mise";

type OrderLane = "drafts" | "sent" | "history";
type RecommendationAction = "approve" | "dismiss";

interface UndoAction {
  id: string;
  action: "approved" | "dismissed";
  recommendation: PurchaseRecommendation;
  busy: boolean;
}

interface OrdersHubNotice {
  title: string;
  message: string;
  tone: StatusNoticeTone;
  recovery?: OrdersHubNoticeRecovery;
  restaurantId: string | null;
}

const EMPTY_ACTIONS: Record<string, RecommendationAction | undefined> = {};

const MUTATION_NOTICE_KEYS: Record<
  OrdersHubMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  viewOnly: {
    title: "orders.notice.viewOnlyTitle",
    message: "orders.error.viewOnly"
  },
  approved: {
    title: "orders.notice.approvedTitle",
    message: "orders.notice.approved"
  },
  approveFailed: {
    title: "orders.notice.approveFailedTitle",
    message: "orders.error.approve"
  },
  dismissed: {
    title: "orders.notice.dismissedTitle",
    message: "orders.notice.dismissed"
  },
  dismissFailed: {
    title: "orders.notice.dismissFailedTitle",
    message: "orders.error.dismiss"
  },
  undoRestored: {
    title: "orders.notice.undoRestoredTitle",
    message: "orders.notice.undoRestored"
  },
  undoFailed: {
    title: "orders.notice.undoFailedTitle",
    message: "orders.error.undo"
  },
  copied: {
    title: "orders.notice.copiedTitle",
    message: "orders.notice.copied"
  },
  copyFailed: {
    title: "orders.notice.copyFailedTitle",
    message: "orders.error.copy"
  },
  placed: {
    title: "orders.notice.placedTitle",
    message: "orders.notice.placed"
  },
  placeFailed: {
    title: "orders.notice.placeFailedTitle",
    message: "orders.detail.notice.placeFailedBody"
  },
  sendDemoAlready: {
    title: "orders.notice.send.demoAlreadyTitle",
    message: "orders.notice.send.demo.already"
  },
  sendDemoZero: {
    title: "orders.notice.send.demoTitle",
    message: "orders.notice.send.demo.zero"
  },
  sendDemoOne: {
    title: "orders.notice.send.demoTitle",
    message: "orders.notice.send.demo.one"
  },
  sendDemoOther: {
    title: "orders.notice.send.demoTitle",
    message: "orders.notice.send.demo.other"
  },
  sendGmailAlready: {
    title: "orders.notice.send.gmailAlreadyTitle",
    message: "orders.notice.send.gmail.already"
  },
  sendGmailZero: {
    title: "orders.notice.send.gmailTitle",
    message: "orders.notice.send.gmail.zero"
  },
  sendGmailOne: {
    title: "orders.notice.send.gmailTitle",
    message: "orders.notice.send.gmail.one"
  },
  sendGmailOther: {
    title: "orders.notice.send.gmailTitle",
    message: "orders.notice.send.gmail.other"
  },
  loadFailed: {
    title: "orders.notice.loadFailedTitle",
    message: "orders.error.load"
  }
};

const SEND_ERROR_NOTICE_KEYS: Record<
  OrderDetailSendErrorReason,
  { title: MessageKey; message: MessageKey }
> = {
  gmailConnectRequired: {
    title: "orders.detail.connection.connectTitle",
    message: "orders.detail.gmail.notConnected"
  },
  gmailReconnectRequired: {
    title: "orders.detail.connection.reconnectTitle",
    message: "orders.detail.gmail.notConnected"
  },
  supplierEmailMissing: {
    title: "orders.detail.error.supplierEmailTitle",
    message: "orders.detail.error.supplierEmailBody"
  },
  deliveryReview: {
    title: "settings.gmail.error.reviewTitle",
    message: "orders.detail.gmail.review"
  },
  sendingDisabled: {
    title: "orders.detail.error.sendingDisabledTitle",
    message: "orders.detail.error.sendingDisabledBody"
  },
  sendFailed: {
    title: "orders.detail.error.sendTitle",
    message: "orders.error.send.demo"
  },
  sendFailedGmail: {
    title: "orders.detail.error.sendTitle",
    message: "orders.error.send.gmail"
  }
};

export default function OrdersScreen() {
  const { formatNumber, locale, parseNumber, t } = useLocale();
  const { memberships, restaurant, usingLocalDemo } = useMiseSession();
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canConnectGmail = canDeleteRestaurantData(memberships, restaurant?.id);
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [lane, setLane] = useState<OrderLane>("drafts");
  const [recommendationQuery, setRecommendationQuery] = useState("");
  const [orderLaneQuery, setOrderLaneQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string | undefined>>({});
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [dismissReasonErrors, setDismissReasonErrors] = useState<Record<string, string | undefined>>({});
  const [recommendationActions, setRecommendationActions] =
    useState<Record<string, RecommendationAction | undefined>>(EMPTY_ACTIONS);
  const [sendingOrderIds, setSendingOrderIds] = useState<Record<string, boolean>>({});
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [notice, setNotice] = useState<OrdersHubNotice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);

  const recommendationLocksRef = useRef(new Set<string>());
  const sendingLocksRef = useRef(new Set<string>());
  const undoLockRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const quantityLocaleRef = useRef(locale);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  function mutationNotice(
    reason: OrdersHubMutationNoticeReason,
    restaurantId: string | null = restaurant?.id ?? null,
    params?: Record<string, string>
  ): OrdersHubNotice {
    const localized = (
      Object.keys(MUTATION_NOTICE_KEYS) as OrdersHubMutationNoticeReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(MUTATION_NOTICE_KEYS[key].title),
          message: t(MUTATION_NOTICE_KEYS[key].message, params)
        };
        return acc;
      },
      {} as Record<OrdersHubMutationNoticeReason, { title: string; message: string }>
    );
    return {
      ...presentOrdersHubMutationNoticeCopy(reason, localized),
      restaurantId
    };
  }

  function sendErrorNotice(
    error: unknown,
    restaurantId: string | null = restaurant?.id ?? null
  ): OrdersHubNotice {
    const status = isGmailIntegrationError(error) ? error.status : null;
    const reason = resolveOrderDetailSendErrorReason(status);
    const localized = (
      Object.keys(SEND_ERROR_NOTICE_KEYS) as OrderDetailSendErrorReason[]
    ).reduce(
      (acc, key) => {
        const messageKey =
          key === "sendFailed" && !usingLocalDemo
            ? "orders.error.send.gmail"
            : SEND_ERROR_NOTICE_KEYS[key].message;
        acc[key] = {
          title: t(SEND_ERROR_NOTICE_KEYS[key].title),
          message: t(messageKey)
        };
        return acc;
      },
      {} as Record<OrderDetailSendErrorReason, { title: string; message: string }>
    );
    return {
      ...presentOrderDetailSendErrorNotice(reason, localized),
      restaurantId
    };
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
        const [nextRecommendations, nextOrders, nextEmailConnection] = await Promise.all([
          fetchPurchaseRecommendations(restaurantId, "pending"),
          fetchSupplierOrders(restaurantId),
          fetchEmailConnectionState(restaurantId)
        ]);
        if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

        setRecommendations(nextRecommendations);
        setOrders(nextOrders);
        setEmailConnection(nextEmailConnection);
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
        setDismissReasons((current) => {
          const next: Record<string, string> = {};
          nextRecommendations.forEach((recommendation) => {
            next[recommendation.id] = current[recommendation.id] ?? "";
          });
          return next;
        });
        loadedRestaurantRef.current = restaurantId;
        setLoadedRestaurantId(restaurantId);
      } catch (error) {
        if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
          captureMiseError(error, {
            flow: "orders_hub",
            operation: "load",
            restaurant_id: restaurantId
          });
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
    setEmailConnection(null);
    setQuantities({});
    setQuantityErrors({});
    setDismissReasons({});
    setDismissReasonErrors({});
    setRecommendationActions(EMPTY_ACTIONS);
    setSendingOrderIds({});
    setUndoAction(null);
    setNotice(null);
    setLoadError(null);
    setLoadedRestaurantId(null);
    setLane("drafts");
    setRecommendationQuery("");
    setOrderLaneQuery("");
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useEffect(() => {
    setOrderLaneQuery("");
  }, [lane]);

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
    if (!notice || notice.tone === "danger" || notice.recovery) return undefined;
    const timeout = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!undoAction) return undefined;
    const timeout = setTimeout(() => setUndoAction(null), 7000);
    return () => clearTimeout(timeout);
  }, [undoAction?.id]);

  const hubLoadState = resolveOrdersHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: Boolean(loadError)
  });
  const hubReady = hubLoadState === "ready";
  const visibleRecommendations = hubReady ? recommendations : [];
  const visibleOrders = hubReady ? orders : [];
  const visibleEmailConnection = hubReady ? emailConnection : null;
  const visibleNotice = notice?.restaurantId === restaurant?.id ? notice : null;
  const visibleUndoAction = hubReady && canManage ? undoAction : null;

  const showRecommendationSearch =
    visibleRecommendations.length >= PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD;
  const filteredRecommendations = useMemo(() => {
    if (!showRecommendationSearch) return visibleRecommendations;
    return filterInventoryItemsBySearch(visibleRecommendations, recommendationQuery, {
      getExtraSearchText: (recommendation) => recommendation.reason
    });
  }, [recommendationQuery, showRecommendationSearch, visibleRecommendations]);
  const recommendationSearchNoMatches =
    showRecommendationSearch &&
    recommendationQuery.trim().length > 0 &&
    filteredRecommendations.length === 0;

  const groupedRecommendations = useMemo(() => {
    const groups = new Map<string, PurchaseRecommendation[]>();
    filteredRecommendations.forEach((recommendation) => {
      const current = groups.get(recommendation.supplier_name) ?? [];
      current.push(recommendation);
      groups.set(recommendation.supplier_name, current);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [filteredRecommendations]);

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
  const activeLaneOrders =
    lane === "drafts" ? draftOrders : lane === "sent" ? sentOrders : completedOrders;
  const showOrderLaneSearch = activeLaneOrders.length >= SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD;
  const filteredDraftOrders = useMemo(() => {
    if (lane !== "drafts" || !showOrderLaneSearch) return draftOrders;
    return filterSupplierOrdersBySearch(draftOrders, orderLaneQuery);
  }, [draftOrders, lane, orderLaneQuery, showOrderLaneSearch]);
  const filteredSentOrders = useMemo(() => {
    if (lane !== "sent" || !showOrderLaneSearch) return sentOrders;
    return filterSupplierOrdersBySearch(sentOrders, orderLaneQuery);
  }, [lane, orderLaneQuery, sentOrders, showOrderLaneSearch]);
  const filteredCompletedOrders = useMemo(() => {
    if (lane !== "history" || !showOrderLaneSearch) return completedOrders;
    return filterSupplierOrdersBySearch(completedOrders, orderLaneQuery);
  }, [completedOrders, lane, orderLaneQuery, showOrderLaneSearch]);
  const orderLaneSearchNoMatches =
    showOrderLaneSearch &&
    orderLaneQuery.trim().length > 0 &&
    (lane === "drafts"
      ? filteredDraftOrders.length === 0
      : lane === "sent"
        ? filteredSentOrders.length === 0
        : filteredCompletedOrders.length === 0);
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
  const gmailIsConnected = hubReady && gmailStatus === "connected";
  const gmailNeedsAttention =
    hubReady && (gmailStatus === "needs_reauth" || gmailStatus === "restricted");
  const canSendOrders = canManage && gmailIsConnected;
  const readyGmailTitle = usingLocalDemo
    ? t("orders.gmail.demo.title")
    : gmailIsConnected
      ? t("orders.gmail.connected.title")
      : gmailStatus === "needs_reauth"
        ? t("orders.gmail.reauth.title")
        : t("orders.gmail.ready.title");
  const readyGmailBody = usingLocalDemo
    ? t("orders.gmail.demo.body")
    : gmailIsConnected
      ? t("orders.gmail.connected.body", {
          sender: visibleEmailConnection?.sender_email ?? t("orders.gmail.connected.fallbackSender")
        })
      : canConnectGmail
        ? t("orders.gmail.connect.body")
        : t("orders.gmail.readOnly.body");
  const readyGmailActionTitle = usingLocalDemo
    ? t("orders.gmail.action.viewSetup")
    : gmailIsConnected
      ? t("orders.gmail.action.manage")
      : gmailStatus === "needs_reauth"
        ? t("orders.gmail.action.reconnect")
        : t("orders.gmail.action.link");
  const gmailPresentation = presentOrdersHubGmailCopy(
    hubLoadState,
    {
      title: readyGmailTitle,
      body: readyGmailBody,
      actionTitle: readyGmailActionTitle
    },
    {
      loadingTitle: t("orders.gmail.loading.title"),
      loadingBody: t("orders.gmail.loading.body"),
      unavailableTitle: t("orders.gmail.unavailable.title"),
      unavailableBody: t("orders.gmail.unavailable.body"),
      loadingAction: t("common.loading"),
      unavailableAction: t("orders.gmail.unavailable.action")
    }
  );
  const draftsEmptyPresentation = presentOrdersHubLaneEmptyCopy(
    hubLoadState,
    {
      title: t("orders.empty.drafts.title"),
      body: t("orders.empty.drafts.body")
    },
    {
      loadingTitle: t("orders.empty.drafts.loadingTitle"),
      loadingBody: t("orders.empty.drafts.loadingBody"),
      unavailableTitle: t("orders.empty.drafts.unavailableTitle"),
      unavailableBody: t("orders.empty.drafts.unavailableBody")
    }
  );
  const sentEmptyPresentation = presentOrdersHubLaneEmptyCopy(
    hubLoadState,
    {
      title: t("orders.empty.sent.title"),
      body: t("orders.empty.sent.body")
    },
    {
      loadingTitle: t("orders.empty.sent.loadingTitle"),
      loadingBody: t("orders.empty.sent.loadingBody"),
      unavailableTitle: t("orders.empty.sent.unavailableTitle"),
      unavailableBody: t("orders.empty.sent.unavailableBody")
    }
  );
  const historyEmptyPresentation = presentOrdersHubLaneEmptyCopy(
    hubLoadState,
    {
      title: t("orders.empty.history.title"),
      body: t("orders.empty.history.body")
    },
    {
      loadingTitle: t("orders.empty.history.loadingTitle"),
      loadingBody: t("orders.empty.history.loadingBody"),
      unavailableTitle: t("orders.empty.history.unavailableTitle"),
      unavailableBody: t("orders.empty.history.unavailableBody")
    }
  );

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
      setNotice(mutationNotice("viewOnly", restaurant.id));
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
    setNotice(null);

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
        urgency: recommendation.urgency,
        ...buildRecommendationDecisionTelemetry({
          originalQuantity: approved.original_recommended_quantity ?? recommendation.recommended_quantity,
          acceptedQuantity: approved.recommended_quantity
        })
      });
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id)
      );
      setNotice(mutationNotice("approved", restaurantId, { item: approved.item_name }));
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "approve",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("approveFailed", restaurantId));
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
      setNotice(mutationNotice("viewOnly", restaurant.id));
      return;
    }
    const restaurantId = restaurant.id;
    const dismissReasonRaw = dismissReasons[recommendation.id] ?? "";
    if (dismissReasonRaw.trim().length > RECOMMENDATION_DISMISS_REASON_MAX_CHARACTERS) {
      setDismissReasonErrors((current) => ({
        ...current,
        [recommendation.id]: t("orders.validation.dismissReasonTooLong", {
          maximum: formatNumber(RECOMMENDATION_DISMISS_REASON_MAX_CHARACTERS)
        })
      }));
      return;
    }

    setDismissReasonErrors((current) => ({ ...current, [recommendation.id]: undefined }));
    setRecommendationBusy(recommendation.id, "dismiss");
    setNotice(null);

    try {
      const dismissed = await dismissPurchaseRecommendation(
        restaurantId,
        recommendation.id,
        dismissReasonRaw.trim() || null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      registerUndo(dismissed, "dismissed");
      trackMiseEvent("recommendation_dismissed", {
        restaurant_id: restaurantId,
        supplier_name: recommendation.supplier_name,
        urgency: recommendation.urgency,
        ...buildRecommendationDecisionTelemetry({
          dismissReasonPresent: Boolean(dismissed.dismiss_reason)
        })
      });
      setRecommendations((current) =>
        current.filter((item) => item.id !== recommendation.id)
      );
      setNotice(mutationNotice("dismissed", restaurantId, { item: dismissed.item_name }));
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "dismiss",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("dismissFailed", restaurantId));
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
      setNotice(mutationNotice("viewOnly", restaurant.id));
      setUndoAction(null);
      return;
    }
    const restaurantId = restaurant.id;

    undoLockRef.current = true;
    setUndoAction((current) => (current ? { ...current, busy: true } : current));
    setNotice(null);
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
      setNotice(mutationNotice("undoRestored", restaurantId, { item: restored.item_name }));
      setUndoAction(null);
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "undo",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("undoFailed", restaurantId));
        setUndoAction(null);
      }
    } finally {
      undoLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) await load(false);
    }
  }

  async function copyOrder(order: SupplierOrder) {
    setNotice(null);
    try {
      await Clipboard.setStringAsync(order.order_message);
      trackMiseEvent("order_copied", {
        restaurant_id: order.restaurant_id,
        supplier_name: order.supplier_name,
        status: order.status
      });
      setNotice(
        mutationNotice("copied", order.restaurant_id, { supplier: order.supplier_name })
      );
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "copy",
        restaurant_id: order.restaurant_id
      });
      setNotice(mutationNotice("copyFailed", order.restaurant_id));
    }
  }

  async function markOrderPlaced(order: SupplierOrder) {
    if (!restaurant || sendingLocksRef.current.has(order.id)) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly", restaurant.id));
      return;
    }
    const restaurantId = restaurant.id;
    setOrderBusy(order.id, true);
    setNotice(null);
    try {
      await confirmSupplierOrderPlaced(restaurantId, order.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setUndoAction((current) =>
        current?.recommendation.supplier_name === order.supplier_name ? null : current
      );
      setNotice(
        mutationNotice("placed", restaurantId, { supplier: order.supplier_name })
      );
      setLane("sent");
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "place",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("placeFailed", restaurantId));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setOrderBusy(order.id, false);
        await load(false);
      }
    }
  }

  async function sendOrder(order: SupplierOrder) {
    if (!restaurant || sendingLocksRef.current.has(order.id)) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly", restaurant.id));
      return;
    }
    const restaurantId = restaurant.id;

    setOrderBusy(order.id, true);
    setNotice(null);
    try {
      const result = await sendSupplierOrderEmail(restaurantId, order.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const movedCount = result.orderedRecommendations.length;
      const wasAlreadySent = result.outcome !== "applied";
      setUndoAction((current) =>
        current?.recommendation.supplier_name === order.supplier_name ? null : current
      );
      const sendReason = resolveOrdersHubSendSuccessReason({
        usingLocalDemo,
        alreadySent: wasAlreadySent,
        movedCount
      });
      setNotice(
        mutationNotice(sendReason, restaurantId, {
          supplier: order.supplier_name,
          count: formatNumber(movedCount)
        })
      );
      setLane("sent");
    } catch (error) {
      captureMiseError(error, {
        flow: "orders_hub",
        operation: "send",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(sendErrorNotice(error, restaurantId));
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
            retryLabel={t("common.retry")}
            onRetry={() => void load(true)}
          />
        ) : null}

        {!canManage ? (
          <StatusNotice
            title={t("orders.readOnly.title")}
            message={t("orders.readOnly.body")}
          />
        ) : null}

        {visibleNotice ? (
          <StatusNotice
            title={visibleNotice.title}
            message={visibleNotice.message}
            tone={visibleNotice.tone}
            actionLabel={
              visibleNotice.recovery === "gmail"
                ? t("orders.detail.recovery.gmail")
                : visibleNotice.recovery === "supplier"
                  ? t("orders.detail.recovery.supplier")
                  : undefined
            }
            onAction={
              visibleNotice.recovery === "gmail"
                ? () => router.push("/settings/gmail" as never)
                : visibleNotice.recovery === "supplier"
                  ? () => router.push("/settings/suppliers" as never)
                  : undefined
            }
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
                      gmailPresentation.ready && gmailIsConnected && styles.mailIconConnected,
                      gmailPresentation.ready && gmailNeedsAttention && styles.mailIconAttention
                    ]}
                  >
                    <Mail
                      size={22}
                      color={
                        gmailPresentation.ready && gmailIsConnected
                          ? colors.success
                          : gmailPresentation.ready && gmailNeedsAttention
                            ? colors.caution
                            : colors.muted
                      }
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.emailCopy}>
                    <Text style={styles.emailTitle}>{gmailPresentation.title}</Text>
                    <Text style={styles.emailBody}>{gmailPresentation.body}</Text>
                  </View>
                  {canConnectGmail && gmailPresentation.ready ? (
                    <Button
                      title={gmailPresentation.actionTitle}
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
                    {!gmailPresentation.ready
                      ? t("orders.gmail.security.pending")
                      : usingLocalDemo
                        ? t("orders.gmail.security.demo")
                        : t("orders.gmail.security.live")}
                  </Text>
                </View>
              </SectionSurface>

              {showOrderLaneSearch ? (
                <View style={styles.orderLaneSearchBox}>
                  <Search size={18} color={colors.faint} strokeWidth={2.25} />
                  <TextInput
                    accessibilityLabel={t("orders.lane.search.accessibility")}
                    accessibilityHint={t("orders.lane.search.hint")}
                    value={orderLaneQuery}
                    onChangeText={setOrderLaneQuery}
                    placeholder={t("orders.lane.search.placeholder")}
                    placeholderTextColor={colors.faint}
                    returnKeyType="search"
                    style={styles.orderLaneSearchInput}
                  />
                </View>
              ) : null}

              {draftOrders.length === 0 ? (
                <EmptyState
                  compact
                  title={draftsEmptyPresentation.title}
                  body={draftsEmptyPresentation.body}
                />
              ) : orderLaneSearchNoMatches ? (
                <EmptyState
                  compact
                  title={t("orders.lane.search.emptyTitle")}
                  body={t("orders.lane.search.emptyBody")}
                />
              ) : (
                filteredDraftOrders.map((order) => (
                  <SupplierDraftCard
                    key={order.id}
                    order={order}
                    onCopy={() => void copyOrder(order)}
                    onOpen={() =>
                      router.push({ pathname: "/orders/[id]", params: { id: order.id } })
                    }
                    onSend={canSendOrders ? () => void sendOrder(order) : undefined}
                    onMarkSent={canManage && !canSendOrders ? () => void markOrderPlaced(order) : undefined}
                    showSend={canManage}
                    canSend={canSendOrders || canManage}
                    canMarkSent={canManage && !canSendOrders}
                    sendLabel={t(
                      canSendOrders
                        ? usingLocalDemo
                          ? "orders.action.simulateSend"
                          : "orders.action.gmailSend"
                        : "orders.card.action.markPlaced"
                    )}
                    busyLabel={t(
                      canSendOrders
                        ? usingLocalDemo
                          ? "orders.action.simulating"
                          : "orders.action.gmailSending"
                        : "orders.card.action.markingPlaced"
                    )}
                    sendAccessibilityLabel={t(
                      canSendOrders
                        ? usingLocalDemo
                          ? "orders.card.simulateSendAccessibility"
                          : "orders.card.gmailSendAccessibility"
                        : "orders.card.markPlacedAccessibility",
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
                  {showRecommendationSearch ? (
                    <View style={styles.recommendationSearchBox}>
                      <Search size={18} color={colors.faint} strokeWidth={2.25} />
                      <TextInput
                        accessibilityLabel={t("orders.review.search.accessibility")}
                        accessibilityHint={t("orders.review.search.hint")}
                        value={recommendationQuery}
                        onChangeText={setRecommendationQuery}
                        placeholder={t("orders.review.search.placeholder")}
                        placeholderTextColor={colors.faint}
                        returnKeyType="search"
                        style={styles.recommendationSearchInput}
                      />
                    </View>
                  ) : null}
                  {recommendationSearchNoMatches ? (
                    <EmptyState
                      compact
                      title={t("orders.review.search.emptyTitle")}
                      body={t("orders.review.search.emptyBody")}
                    />
                  ) : null}
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
                          dismissReason={dismissReasons[recommendation.id] ?? ""}
                          onDismissReasonChange={(value) => {
                            setDismissReasons((current) => ({ ...current, [recommendation.id]: value }));
                            setDismissReasonErrors((current) => ({
                              ...current,
                              [recommendation.id]: undefined
                            }));
                          }}
                          onApprove={() => void approve(recommendation)}
                          onDismiss={() => void dismiss(recommendation)}
                          action={recommendationActions[recommendation.id]}
                          error={quantityErrors[recommendation.id]}
                          dismissReasonError={dismissReasonErrors[recommendation.id]}
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
              {showOrderLaneSearch ? (
                <View style={styles.orderLaneSearchBox}>
                  <Search size={18} color={colors.faint} strokeWidth={2.25} />
                  <TextInput
                    accessibilityLabel={t("orders.lane.search.accessibility")}
                    accessibilityHint={t("orders.lane.search.hint")}
                    value={orderLaneQuery}
                    onChangeText={setOrderLaneQuery}
                    placeholder={t("orders.lane.search.placeholder")}
                    placeholderTextColor={colors.faint}
                    returnKeyType="search"
                    style={styles.orderLaneSearchInput}
                  />
                </View>
              ) : null}
              {sentOrders.length === 0 ? (
                <EmptyState
                  compact
                  title={sentEmptyPresentation.title}
                  body={sentEmptyPresentation.body}
                />
              ) : orderLaneSearchNoMatches ? (
                <EmptyState
                  compact
                  title={t("orders.lane.search.emptyTitle")}
                  body={t("orders.lane.search.emptyBody")}
                />
              ) : (
                filteredSentOrders.map((order) => (
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
            <>
              {showOrderLaneSearch ? (
                <View style={styles.orderLaneSearchBox}>
                  <Search size={18} color={colors.faint} strokeWidth={2.25} />
                  <TextInput
                    accessibilityLabel={t("orders.lane.search.accessibility")}
                    accessibilityHint={t("orders.lane.search.hint")}
                    value={orderLaneQuery}
                    onChangeText={setOrderLaneQuery}
                    placeholder={t("orders.lane.search.placeholder")}
                    placeholderTextColor={colors.faint}
                    returnKeyType="search"
                    style={styles.orderLaneSearchInput}
                  />
                </View>
              ) : null}
              {completedOrders.length === 0 ? (
                <EmptyState
                  compact
                  title={historyEmptyPresentation.title}
                  body={historyEmptyPresentation.body}
                />
              ) : orderLaneSearchNoMatches ? (
                <EmptyState
                  compact
                  title={t("orders.lane.search.emptyTitle")}
                  body={t("orders.lane.search.emptyBody")}
                />
              ) : (
                filteredCompletedOrders.map((order) => (
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
  recommendationSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  recommendationSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
  },
  orderLaneSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  orderLaneSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
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
