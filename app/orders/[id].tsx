import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  Save,
  Search,
  Send
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  confirmSupplierOrderPlaced,
  fetchPurchaseRecommendations,
  fetchEmailConnectionState,
  fetchStorageLocations,
  fetchSupplierOrder,
  fetchSupplierOrderReceiveSummary,
  isGmailIntegrationError,
  receiveSupplierOrder,
  sendSupplierOrderEmail,
  updateSupplierOrder
} from "../../services/miseService";
import {
  filterInventoryItemsBySearch,
  filterStorageLocationsBySearch,
  PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD,
  STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD
} from "../../services/domain/inventoryItemSearch";
import { MAIN_STORAGE_LOCATION_NAME } from "../../services/domain/inventoryTransfer";
import type { MessageKey } from "../../i18n/catalog";
import {
  isOrderDetailReceiveBlockedByPutAwayLoad,
  isOrderDetailReceiveLocationReady,
  presentOrderDetailMissingCopy,
  presentOrderDetailMutationActionsEditable,
  presentOrderDetailMutationBusy,
  presentOrderDetailMutationNoticeCopy,
  presentOrderDetailReceivePutAwayCopy,
  presentOrderDetailSendErrorNotice,
  resolveOrderDetailLoadState,
  resolveOrderDetailReceivePutAwayLoadState,
  resolveOrderDetailSendErrorReason,
  type OrderDetailMutationNoticeReason,
  type OrderDetailSendErrorReason
} from "../../services/presentation/orderDetailPresentation";
import { canDeleteRestaurantData, canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import { SUPPLIER_NOTE_MAX_CHARACTERS } from "../../services/miseValidation";
import {
  SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS,
  buildReceiveLinesFromFormInputs,
  defaultReceiveLinesFromRecommendations,
  isReceiveQuantityInputReady,
  linkedOrderedRecommendationsForOrder,
  type CompletedSupplierOrderReceiveSummary
} from "../../services/domain/supplierOrderReceiving";
import type {
  PurchaseRecommendation,
  RestaurantEmailConnection,
  StorageLocation,
  SupplierOrder
} from "../../types/mise";

interface OrderNotice {
  title: string;
  message: string;
  tone: StatusNoticeTone;
  recovery?: "gmail" | "supplier";
}

const MUTATION_NOTICE_KEYS: Record<
  OrderDetailMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  viewOnly: {
    title: "orders.detail.viewOnly.title",
    message: "orders.detail.viewOnly.actionBody"
  },
  noteSaved: {
    title: "orders.detail.notice.noteSavedTitle",
    message: "orders.detail.notice.noteSavedBody"
  },
  noteSaveFailed: {
    title: "orders.detail.notice.noteSaveFailedTitle",
    message: "orders.detail.notice.noteSaveFailedBody"
  },
  copied: {
    title: "orders.detail.notice.copiedTitle",
    message: "orders.detail.notice.copiedBody"
  },
  copyFailed: {
    title: "orders.detail.notice.copyFailedTitle",
    message: "orders.detail.notice.copyFailedBody"
  },
  placed: {
    title: "orders.detail.notice.placedTitle",
    message: "orders.detail.notice.placedBody"
  },
  placeFailed: {
    title: "orders.detail.notice.placeFailedTitle",
    message: "orders.detail.notice.placeFailedBody"
  },
  demoSent: {
    title: "orders.detail.notice.demoSentTitle",
    message: "orders.detail.notice.demoSentBody"
  },
  alreadySent: {
    title: "orders.detail.notice.alreadySentTitle",
    message: "orders.detail.notice.acceptedBody"
  },
  accepted: {
    title: "orders.detail.notice.acceptedTitle",
    message: "orders.detail.notice.acceptedBody"
  },
  receiveInvalidStorage: {
    title: "orders.detail.notice.receiveInvalidTitle",
    message: "orders.detail.receive.storageRequired"
  },
  receiveLocationsUnavailable: {
    title: "orders.detail.receive.locationsUnavailable.title",
    message: "orders.detail.receive.locationsUnavailable.body"
  },
  receiveInvalidNote: {
    title: "orders.detail.notice.receiveInvalidTitle",
    message: "orders.detail.receive.noteTooLong"
  },
  receiveInvalidQuantity: {
    title: "orders.detail.notice.receiveInvalidTitle",
    message: "orders.detail.receive.invalidQuantity"
  },
  received: {
    title: "orders.detail.notice.receivedTitle",
    message: "orders.detail.notice.receivedBody"
  },
  receivedWithDiscrepancy: {
    title: "orders.detail.notice.receivedTitle",
    message: "orders.detail.notice.receivedWithDiscrepancyBody"
  },
  receiveFailed: {
    title: "orders.detail.notice.receiveFailedTitle",
    message: "orders.detail.notice.receiveFailedBody"
  },
  gmailConnectRequired: {
    title: "orders.detail.connection.connectTitle",
    message: "orders.detail.gmail.notConnected"
  },
  gmailReconnectRequired: {
    title: "orders.detail.connection.reconnectTitle",
    message: "orders.detail.gmail.notConnected"
  },
  noRestaurant: {
    title: "orders.detail.noRestaurant.title",
    message: "orders.detail.noRestaurant.body"
  },
  loadFailed: {
    title: "orders.detail.load.title",
    message: "orders.detail.load.body"
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
    message: "orders.detail.error.sendBody"
  },
  sendFailedGmail: {
    title: "orders.detail.error.sendTitle",
    message: "orders.detail.gmail.failed"
  }
};

export default function OrderDraftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant, usingLocalDemo } = useMiseSession();
  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [emailConnection, setEmailConnection] = useState<RestaurantEmailConnection | null>(null);
  const [linkedRecommendations, setLinkedRecommendations] = useState<PurchaseRecommendation[]>([]);
  const [receiveSummary, setReceiveSummary] = useState<CompletedSupplierOrderReceiveSummary | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [receiveNotes, setReceiveNotes] = useState<Record<string, string>>({});
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [storageLocationsLoadError, setStorageLocationsLoadError] = useState(false);
  const [receiveStorageLocationId, setReceiveStorageLocationId] = useState("");
  const [receiveStorageLocationIds, setReceiveStorageLocationIds] = useState<Record<string, string>>({});
  const [putAwayLocationQuery, setPutAwayLocationQuery] = useState("");
  const [receiveLineQuery, setReceiveLineQuery] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const loadedOrderIdRef = useRef<string | null>(null);
  const actionLockRef = useRef(false);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  function mutationNotice(
    reason: OrderDetailMutationNoticeReason,
    params?: Record<string, string>
  ): OrderNotice {
    const localized = (
      Object.keys(MUTATION_NOTICE_KEYS) as OrderDetailMutationNoticeReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(MUTATION_NOTICE_KEYS[key].title),
          message: t(MUTATION_NOTICE_KEYS[key].message, params)
        };
        return acc;
      },
      {} as Record<OrderDetailMutationNoticeReason, { title: string; message: string }>
    );
    return presentOrderDetailMutationNoticeCopy(reason, localized);
  }

  function sendErrorNotice(error: unknown): OrderNotice {
    const status = isGmailIntegrationError(error) ? error.status : null;
    const reason = resolveOrderDetailSendErrorReason(status);
    const localized = (
      Object.keys(SEND_ERROR_NOTICE_KEYS) as OrderDetailSendErrorReason[]
    ).reduce(
      (acc, key) => {
        acc[key] = {
          title: t(SEND_ERROR_NOTICE_KEYS[key].title),
          message: t(SEND_ERROR_NOTICE_KEYS[key].message)
        };
        return acc;
      },
      {} as Record<OrderDetailSendErrorReason, { title: string; message: string }>
    );
    return presentOrderDetailSendErrorNotice(reason, localized);
  }

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant || !id) {
      setLoading(false);
      setLoadError(false);
      setNotice(mutationNotice("noRestaurant"));
      return;
    }

    const restaurantId = restaurant.id;
    const orderId = id;
    const requestId = ++requestIdRef.current;
    if (
      showLoading ||
      loadedRestaurantRef.current !== restaurantId ||
      loadedOrderIdRef.current !== orderId
    ) {
      setLoading(true);
    }
    setNotice(null);
    setLoadError(false);
    try {
      const [nextOrder, nextEmailConnection, recommendations, locationsResult] = await Promise.all([
        fetchSupplierOrder(restaurantId, orderId),
        fetchEmailConnectionState(restaurantId),
        fetchPurchaseRecommendations(restaurantId, "all"),
        fetchStorageLocations(restaurantId)
          .then((locations) => ({ ok: true as const, locations }))
          .catch((locationError: unknown) => ({ ok: false as const, error: locationError }))
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (nextEmailConnection && nextEmailConnection.restaurant_id !== restaurantId) {
        throw new Error(t("orders.detail.connectionMismatch"));
      }
      const linked = linkedOrderedRecommendationsForOrder(orderId, recommendations);
      const completedSummary =
        nextOrder.status === "completed"
          ? (
              await fetchSupplierOrderReceiveSummary(restaurantId, orderId).catch(() => null)
            )?.summary ?? null
          : null;
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      const nextLocations = locationsResult.ok ? locationsResult.locations : [];
      if (!locationsResult.ok) {
        captureMiseError(locationsResult.error, {
          flow: "order_detail",
          operation: "load_storage_locations",
          restaurant_id: restaurantId
        });
      }
      const main = nextLocations.find(
        (location) => location.name.toLowerCase() === MAIN_STORAGE_LOCATION_NAME.toLowerCase()
      );
      setOrder(nextOrder);
      setEmailConnection(nextEmailConnection);
      setLinkedRecommendations(linked);
      setReceiveSummary(completedSummary);
      setStorageLocations(nextLocations);
      setStorageLocationsLoadError(!locationsResult.ok);
      const fallbackLocationId = main?.id ?? nextLocations[0]?.id ?? "";
      setReceiveStorageLocationId((currentDefault) => {
        if (!locationsResult.ok) return "";
        const nextDefault =
          currentDefault && nextLocations.some((location) => location.id === currentDefault)
            ? currentDefault
            : fallbackLocationId;
        return nextDefault;
      });
      setReceiveStorageLocationIds((currentLineIds) => {
        if (!locationsResult.ok) {
          return Object.fromEntries(
            linked.map((recommendation) => [recommendation.inventory_item_id, ""])
          );
        }
        const preservedDefault = Object.values(currentLineIds).find((id) =>
          nextLocations.some((location) => location.id === id)
        );
        const nextDefault = preservedDefault ?? fallbackLocationId;
        return Object.fromEntries(
          linked.map((recommendation) => {
            const existing = currentLineIds[recommendation.inventory_item_id];
            return [
              recommendation.inventory_item_id,
              existing && nextLocations.some((location) => location.id === existing)
                ? existing
                : nextDefault
            ];
          })
        );
      });
      setReceiveQuantities(
        Object.fromEntries(
          defaultReceiveLinesFromRecommendations(linked).map((line) => [
            line.inventoryItemId,
            formatNumber(line.quantityReceived, { maximumFractionDigits: 2, useGrouping: false })
          ])
        )
      );
      setReceiveNotes(
        Object.fromEntries(
          linked.map((recommendation) => [recommendation.inventory_item_id, ""])
        )
      );
      loadedRestaurantRef.current = restaurantId;
      loadedOrderIdRef.current = orderId;
      setLoadedRestaurantId(restaurantId);
      setOperatorNote(nextOrder.operator_note ?? "");
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "order_detail",
        operation: "load",
        restaurant_id: restaurantId
      });
      const keepPrior =
        loadedRestaurantRef.current === restaurantId && loadedOrderIdRef.current === orderId;
      if (!keepPrior) {
        setOrder(null);
        setEmailConnection(null);
        setLinkedRecommendations([]);
        setReceiveSummary(null);
        setStorageLocations([]);
        setStorageLocationsLoadError(false);
        setReceiveStorageLocationId("");
        setReceiveStorageLocationIds({});
      }
      setLoadError(true);
      setNotice(
        error instanceof Error && error.message === t("orders.detail.connectionMismatch")
          ? {
              title: t("orders.detail.load.title"),
              message: error.message,
              tone: "danger"
            }
          : mutationNotice("loadFailed")
      );
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [formatNumber, id, restaurant?.id, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionLockRef.current = false;
    loadedRestaurantRef.current = null;
    loadedOrderIdRef.current = null;
    setLoadedRestaurantId(null);
    setOrder(null);
    setEmailConnection(null);
    setLinkedRecommendations([]);
    setReceiveSummary(null);
    setReceiveQuantities({});
    setReceiveNotes({});
    setStorageLocations([]);
    setStorageLocationsLoadError(false);
    setReceiveStorageLocationId("");
    setReceiveStorageLocationIds({});
    setPutAwayLocationQuery("");
    setReceiveLineQuery("");
    setOperatorNote("");
    setBusy(false);
    setNotice(null);
    setLoadError(false);
    setLoading(Boolean(restaurant && id));
    void load(true);
  }, [id, load, restaurant?.id]);

  function applyDefaultPutAwayLocation(locationId: string): void {
    setReceiveStorageLocationId(locationId);
    setReceiveStorageLocationIds((current) => {
      const next: Record<string, string> = { ...current };
      for (const recommendation of linkedRecommendations) {
        next[recommendation.inventory_item_id] = locationId;
      }
      return next;
    });
  }

  function seedReceiveForm(
    recommendations: readonly PurchaseRecommendation[]
  ): void {
    const defaults = defaultReceiveLinesFromRecommendations(
      recommendations,
      receiveStorageLocationId || null
    );
    setReceiveQuantities(
      Object.fromEntries(
        defaults.map((line) => [
          line.inventoryItemId,
          formatNumber(line.quantityReceived, { maximumFractionDigits: 2, useGrouping: false })
        ])
      )
    );
    setReceiveNotes(Object.fromEntries(defaults.map((line) => [line.inventoryItemId, ""])));
    setReceiveStorageLocationIds(
      Object.fromEntries(
        defaults.map((line) => [
          line.inventoryItemId,
          line.storageLocationId ?? receiveStorageLocationId
        ])
      )
    );
  }

  async function persistNote(): Promise<SupplierOrder> {
    if (!restaurant || !order) throw new Error(t("orders.detail.notFound"));
    if (!canManage) return order;
    if (order.status !== "draft") return order;
    if (operatorNote.trim() === (order.operator_note ?? "").trim()) return order;

    const updated = await updateSupplierOrder(restaurant.id, order.id, {
      operator_note: operatorNote.trim() || null
    });
    if (activeRestaurantIdRef.current === restaurant.id) {
      setOrder(updated);
      setOperatorNote(updated.operator_note ?? "");
    }
    return updated;
  }

  async function saveNote() {
    if (!restaurant || !order || actionLockRef.current) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("noteSaved"));
    } catch (error) {
      captureMiseError(error, {
        flow: "order_detail",
        operation: "save_note",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("noteSaveFailed"));
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function copyOrder() {
    if (!restaurant || !order || actionLockRef.current) return;
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const savedOrder = await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await Clipboard.setStringAsync(savedOrder.order_message);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("copied"));
    } catch (error) {
      captureMiseError(error, {
        flow: "order_detail",
        operation: "copy",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("copyFailed"));
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function markPlaced() {
    if (!restaurant || !order || order.status !== "draft" || actionLockRef.current) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly"));
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const result = await confirmSupplierOrderPlaced(restaurantId, order.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(result.order);
      setOperatorNote(result.order.operator_note ?? "");
      setLinkedRecommendations(result.orderedRecommendations);
      seedReceiveForm(result.orderedRecommendations);
      setNotice(mutationNotice("placed"));
    } catch (error) {
      captureMiseError(error, {
        flow: "order_detail",
        operation: "mark_placed",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        await load(false);
        if (activeRestaurantIdRef.current === restaurantId) {
          setNotice(mutationNotice("placeFailed"));
        }
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function sendOrder() {
    if (!restaurant || !order || order.status !== "draft" || actionLockRef.current) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly"));
      return;
    }
    if (emailConnection?.status !== "connected") {
      setNotice(
        mutationNotice(
          emailConnection?.status === "needs_reauth"
            ? "gmailReconnectRequired"
            : "gmailConnectRequired"
        )
      );
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const savedOrder = await persistNote();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const result = await sendSupplierOrderEmail(restaurantId, savedOrder.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(result.order);
      setOperatorNote(result.order.operator_note ?? "");
      setLinkedRecommendations(result.orderedRecommendations);
      seedReceiveForm(result.orderedRecommendations);
      setNotice(
        mutationNotice(
          usingLocalDemo
            ? "demoSent"
            : result.outcome === "already_sent"
              ? "alreadySent"
              : "accepted"
        )
      );
    } catch (error) {
      captureMiseError(error, {
        flow: "order_detail",
        operation: "send",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        await load(false);
        if (activeRestaurantIdRef.current === restaurantId) setNotice(sendErrorNotice(error));
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  async function receiveDelivery() {
    if (!restaurant || !order || order.status !== "sent" || actionLockRef.current) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnly"));
      return;
    }
    const putAwayLoadState = resolveOrderDetailReceivePutAwayLoadState({
      loadError: storageLocationsLoadError,
      locationCount: storageLocations.length
    });
    if (isOrderDetailReceiveBlockedByPutAwayLoad(putAwayLoadState)) {
      setNotice(mutationNotice("receiveLocationsUnavailable"));
      return;
    }
    if (
      linkedRecommendations.some((recommendation) => {
        const locationId = receiveStorageLocationIds[recommendation.inventory_item_id] ?? "";
        return !isOrderDetailReceiveLocationReady({
          putAwayLoadState,
          locationId,
          locationIds: storageLocations.map((location) => location.id)
        });
      })
    ) {
      setNotice(mutationNotice("receiveInvalidStorage"));
      return;
    }
    const drafted = buildReceiveLinesFromFormInputs({
      inventoryItemIds: linkedRecommendations.map((recommendation) => recommendation.inventory_item_id),
      quantitiesByItemId: receiveQuantities,
      notesByItemId: receiveNotes,
      storageLocationId: receiveStorageLocationId || null,
      storageLocationIdsByItemId: receiveStorageLocationIds,
      parseNumber
    });
    if (!drafted.ok) {
      setNotice(
        drafted.error === "note_too_long"
          ? mutationNotice("receiveInvalidNote", {
              count: formatNumber(SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS)
            })
          : mutationNotice("receiveInvalidQuantity")
      );
      return;
    }
    const restaurantId = restaurant.id;
    actionLockRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await receiveSupplierOrder(restaurantId, order.id, drafted.lines);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setOrder(result.order);
      const summaryResult = await fetchSupplierOrderReceiveSummary(restaurantId, order.id).catch(
        () => null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setReceiveSummary(summaryResult?.summary ?? null);
      setNotice(
        result.discrepancyCount > 0
          ? mutationNotice("receivedWithDiscrepancy", {
              count: formatNumber(result.discrepancyCount)
            })
          : mutationNotice("received")
      );
    } catch (error) {
      captureMiseError(error, {
        flow: "order_detail",
        operation: "receive",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current === restaurantId) {
        setNotice(mutationNotice("receiveFailed"));
      }
    } finally {
      actionLockRef.current = false;
      if (activeRestaurantIdRef.current === restaurantId) setBusy(false);
    }
  }

  const hubLoadState = resolveOrderDetailLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const visibleOrder = hubReady ? order : null;
  const visibleReceiveSummary = hubReady ? receiveSummary : null;
  const visibleLinkedRecommendations = hubReady ? linkedRecommendations : [];
  const visibleStorageLocations = hubReady ? storageLocations : [];
  const visibleStorageLocationsLoadError = hubReady ? storageLocationsLoadError : false;
  const receivePutAwayLoadState = resolveOrderDetailReceivePutAwayLoadState({
    loadError: visibleStorageLocationsLoadError,
    locationCount: visibleStorageLocations.length
  });
  const receivePutAwayUnavailableCopy = presentOrderDetailReceivePutAwayCopy(receivePutAwayLoadState, {
    unavailableTitle: t("orders.detail.receive.locationsUnavailable.title"),
    unavailableBody: t("orders.detail.receive.locationsUnavailable.body")
  });
  const isDraft = visibleOrder?.status === "draft";
  const isSent = visibleOrder?.status === "sent";
  const isCompleted = visibleOrder?.status === "completed";
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canManageGmail = canDeleteRestaurantData(memberships, restaurant?.id);
  const mutationBusy = presentOrderDetailMutationBusy(busy);
  const mutationActionsEditable = presentOrderDetailMutationActionsEditable(
    canManage,
    mutationBusy,
    hubReady
  );
  const canEditDraft = Boolean(isDraft && mutationActionsEditable);
  const visibleEmailConnection = hubReady ? emailConnection : null;
  const gmailReady = visibleEmailConnection?.status === "connected";
  const generatedMessage = visibleOrder ? generatedOrderMessage(visibleOrder) : "";
  const missingCopy = presentOrderDetailMissingCopy(hubLoadState, {
    loading: t("orders.detail.loading"),
    unavailable: t("orders.detail.unavailable"),
    notFound: t("orders.detail.notFound")
  });
  const receiveReady = useMemo(
    () =>
      isSent &&
      !isOrderDetailReceiveBlockedByPutAwayLoad(receivePutAwayLoadState) &&
      visibleLinkedRecommendations.length > 0 &&
      visibleLinkedRecommendations.every((recommendation) => {
        const quantityReady = isReceiveQuantityInputReady(
          receiveQuantities[recommendation.inventory_item_id] ?? "",
          parseNumber
        );
        const note = receiveNotes[recommendation.inventory_item_id] ?? "";
        const locationId = receiveStorageLocationIds[recommendation.inventory_item_id] ?? "";
        const locationReady = isOrderDetailReceiveLocationReady({
          putAwayLoadState: receivePutAwayLoadState,
          locationId,
          locationIds: visibleStorageLocations.map((location) => location.id)
        });
        return (
          quantityReady &&
          locationReady &&
          note.trim().length <= SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS
        );
      }),
    [
      isSent,
      parseNumber,
      receiveNotes,
      receivePutAwayLoadState,
      receiveQuantities,
      receiveStorageLocationIds,
      visibleLinkedRecommendations,
      visibleStorageLocations
    ]
  );
  const showPutAwayLocationSearch =
    visibleStorageLocations.length >= STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD;
  const showReceiveLineSearch =
    visibleLinkedRecommendations.length >= PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD;
  const visibleReceiveLines = useMemo(() => {
    if (!showReceiveLineSearch) return visibleLinkedRecommendations;
    return filterInventoryItemsBySearch(visibleLinkedRecommendations, receiveLineQuery, {
      getExtraSearchText: (recommendation) => recommendation.supplier_name
    });
  }, [receiveLineQuery, showReceiveLineSearch, visibleLinkedRecommendations]);
  const receiveLineSearchNoMatches =
    showReceiveLineSearch &&
    receiveLineQuery.trim().length > 0 &&
    visibleReceiveLines.length === 0;
  const matchedPutAwayLocations = useMemo(
    () =>
      showPutAwayLocationSearch
        ? filterStorageLocationsBySearch(visibleStorageLocations, putAwayLocationQuery)
        : visibleStorageLocations,
    [putAwayLocationQuery, showPutAwayLocationSearch, visibleStorageLocations]
  );
  const visiblePutAwayLocations = useMemo(
    () =>
      showPutAwayLocationSearch
        ? filterStorageLocationsBySearch(visibleStorageLocations, putAwayLocationQuery, {
            selectedId: receiveStorageLocationId
          })
        : visibleStorageLocations,
    [
      putAwayLocationQuery,
      receiveStorageLocationId,
      showPutAwayLocationSearch,
      visibleStorageLocations
    ]
  );
  const putAwayLocationNoMatches =
    showPutAwayLocationSearch &&
    putAwayLocationQuery.trim().length > 0 &&
    matchedPutAwayLocations.length === 0;

  function goBackToOrders() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/orders");
  }

  return (
    <Screen
      title={visibleOrder?.supplier_name ?? t("orders.detail.title")}
      subtitle={
        visibleOrder
          ? (canEditDraft
              ? t("orders.detail.subtitle.editable")
              : isDraft
                ? t("orders.detail.subtitle.readOnlyDraft")
                : isSent
                  ? t("orders.detail.subtitle.receive")
                  : isCompleted
                    ? t("orders.detail.subtitle.completed")
                    : t("orders.detail.subtitle.sent"))
          : t("orders.detail.subtitle.default")
      }
      loading={loading}
      keyboardAware
      action={
        <ActionIcon
          accessibilityLabel={t("orders.detail.back")}
          onPress={goBackToOrders}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
        </ActionIcon>
      }
    >
      {visibleOrder ? (
        <View style={styles.stack}>
          {loadError ? (
            <RetryNotice
              title={t("orders.detail.retry.title")}
              message={notice?.message ?? t("orders.detail.load.body")}
              onRetry={() => void load(true)}
              retryLabel={t("common.retry")}
              accessibilityLabel={t("orders.detail.retry.accessibility")}
            />
          ) : null}

          {!canManage ? (
            <StatusNotice
              title={t("orders.detail.viewOnly.title")}
              message={t("orders.detail.viewOnly.body")}
            />
          ) : null}

          {canEditDraft && !gmailReady ? (
            <StatusNotice
              tone="warning"
              title={visibleEmailConnection?.status === "needs_reauth"
                ? t("orders.detail.connection.reconnectTitle")
                : t("orders.detail.connection.connectTitle")}
              message={
                canManageGmail
                  ? t("orders.detail.connection.manageBody")
                  : t("orders.detail.connection.managerBody")
              }
              actionLabel={canManageGmail
                ? (visibleEmailConnection?.status === "needs_reauth"
                    ? t("orders.detail.gmail.reconnect")
                    : t("orders.detail.gmail.connect"))
                : undefined}
              onAction={canManageGmail ? () => router.push("/settings/gmail" as never) : undefined}
            />
          ) : null}

          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, !isDraft && styles.statusIconSent]}>
              {isDraft ? (
                <FileText size={20} color={colors.text} strokeWidth={2.25} />
              ) : (
                <CheckCircle2 size={20} color={colors.success} strokeWidth={2.25} />
              )}
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {isDraft
                  ? t("orders.detail.status.draft")
                  : isCompleted
                    ? t("orders.detail.status.completed")
                    : t("orders.detail.status.sent")}
              </Text>
              <Text style={styles.statusMeta}>
                {visibleOrder.delivery_date
                  ? t("orders.detail.delivery.date", {
                      date: formatDate(`${visibleOrder.delivery_date}T12:00:00.000Z`, {
                        dateStyle: "medium",
                        timeZone: "UTC"
                      })
                    })
                  : t("orders.detail.delivery.none")}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("orders.detail.generated.title")}</Text>
            <Text style={styles.sectionBody}>
              {t("orders.detail.generated.body")}
            </Text>
            <View style={styles.messagePanel}>
              <Text selectable style={styles.orderMessage}>
                {generatedMessage}
              </Text>
            </View>
          </View>

          {isCompleted ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("orders.detail.receivedSummary.title")}</Text>
              <Text style={styles.sectionBody}>
                {visibleReceiveSummary && visibleReceiveSummary.discrepancyCount > 0
                  ? t("orders.detail.receivedSummary.bodyWithDiscrepancy", {
                      count: formatNumber(visibleReceiveSummary.discrepancyCount)
                    })
                  : visibleReceiveSummary && visibleReceiveSummary.lines.length > 0
                    ? t("orders.detail.receivedSummary.bodyMatched")
                    : t("orders.detail.receivedSummary.bodyUnavailable")}
              </Text>
              {visibleReceiveSummary && visibleReceiveSummary.lines.length > 0 ? (
                visibleReceiveSummary.lines.map((line) => (
                  <View key={line.inventoryItemId} style={styles.receiveRow}>
                    <Text style={styles.receiveName}>{line.itemName}</Text>
                    <Text style={styles.receiveOrdered}>
                      {t("orders.detail.receive.ordered", {
                        quantity: formatNumber(line.quantityOrdered),
                        unit: line.unit
                      })}
                    </Text>
                    <Text style={styles.receiveOrdered}>
                      {t("orders.detail.receivedSummary.received", {
                        quantity: formatNumber(line.quantityReceived),
                        unit: line.unit
                      })}
                    </Text>
                    {line.hasDiscrepancy ? (
                      <Text
                        style={[
                          styles.receiveDiscrepancy,
                          line.discrepancy < 0
                            ? styles.receiveDiscrepancyShort
                            : styles.receiveDiscrepancyOver
                        ]}
                      >
                        {t("orders.detail.receive.discrepancy", {
                          delta: formatNumber(line.discrepancy),
                          unit: line.unit
                        })}
                      </Text>
                    ) : (
                      <Text style={styles.receiveMatched}>
                        {t("orders.detail.receivedSummary.matched")}
                      </Text>
                    )}
                    {line.storageLocationName ? (
                      <Text style={styles.receiveOrdered}>
                        {t("orders.detail.receivedSummary.putAway", {
                          location: line.storageLocationName
                        })}
                      </Text>
                    ) : null}
                    {line.note ? (
                      <Text style={styles.receiveOrdered}>
                        {t("orders.detail.receivedSummary.note", { note: line.note })}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <EmptyState
                  compact
                  title={t("orders.detail.receivedSummary.emptyTitle")}
                  body={t("orders.detail.receivedSummary.emptyBody")}
                />
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("orders.detail.note.title")}</Text>
            <Text style={styles.sectionBody}>
              {t("orders.detail.note.body")}
            </Text>
            {canEditDraft ? (
              <TextInput
                accessibilityLabel={t("orders.detail.note.label")}
                accessibilityHint={t("orders.detail.note.hint", {
                  count: formatNumber(SUPPLIER_NOTE_MAX_CHARACTERS)
                })}
                accessibilityState={{ disabled: mutationBusy }}
                value={operatorNote}
                onChangeText={setOperatorNote}
                maxLength={SUPPLIER_NOTE_MAX_CHARACTERS}
                editable={!mutationBusy}
                multiline
                textAlignVertical="top"
                placeholder={t("orders.detail.note.placeholder")}
                placeholderTextColor={colors.faint}
                style={styles.noteInput}
              />
            ) : (
              <View style={styles.sentNote}>
                <Text style={styles.sentNoteText}>
                  {visibleOrder.operator_note || t("orders.detail.note.none")}
                </Text>
              </View>
            )}
          </View>

          {isSent && canManage ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("orders.detail.receive.title")}</Text>
              <Text style={styles.sectionBody}>{t("orders.detail.receive.body")}</Text>
              {receivePutAwayUnavailableCopy ? (
                <RetryNotice
                  title={receivePutAwayUnavailableCopy.title}
                  message={receivePutAwayUnavailableCopy.message}
                  onRetry={() => void load(false)}
                  retryLabel={t("common.retry")}
                  accessibilityLabel={t("orders.detail.receive.locationsUnavailable.retryAccessibility")}
                />
              ) : null}
              {visibleStorageLocations.length > 0 ? (
                <View style={styles.receivePutAway}>
                  <Text style={styles.receivePutAwayLabel}>
                    {t("orders.detail.receive.putAwayDefault")}
                  </Text>
                  <Text style={styles.receivePutAwayHelp}>{t("orders.detail.receive.putAwayHelp")}</Text>
                  {showPutAwayLocationSearch ? (
                    <View style={styles.locationSearchBox}>
                      <Search size={18} color={colors.faint} strokeWidth={2.25} />
                      <TextInput
                        accessibilityLabel={t("orders.detail.receive.putAwaySearch.accessibility")}
                        accessibilityHint={t("orders.detail.receive.putAwaySearch.hint")}
                        value={putAwayLocationQuery}
                        onChangeText={setPutAwayLocationQuery}
                        editable={!mutationBusy}
                        placeholder={t("orders.detail.receive.putAwaySearch.placeholder")}
                        placeholderTextColor={colors.faint}
                        returnKeyType="search"
                        style={styles.locationSearchInput}
                      />
                    </View>
                  ) : null}
                  <View style={styles.locationChips}>
                    {visiblePutAwayLocations.map((location) => {
                      const selected = location.id === receiveStorageLocationId;
                      return (
                        <Pressable
                          key={location.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled: mutationBusy }}
                          accessibilityLabel={t("orders.detail.receive.putAwayOption", {
                            location: location.name
                          })}
                          disabled={mutationBusy}
                          onPress={() => applyDefaultPutAwayLocation(location.id)}
                          style={[styles.locationChip, selected && styles.locationChipSelected]}
                        >
                          <Text
                            style={[
                              styles.locationChipText,
                              selected && styles.locationChipTextSelected
                            ]}
                          >
                            {location.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {putAwayLocationNoMatches ? (
                    <Text style={styles.locationSearchEmpty} accessibilityLiveRegion="polite">
                      {t("orders.detail.receive.putAwaySearch.empty")}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {showReceiveLineSearch ? (
                <View style={styles.receiveLineSearchBox}>
                  <Search size={18} color={colors.faint} strokeWidth={2.25} />
                  <TextInput
                    accessibilityLabel={t("orders.detail.receive.lineSearch.accessibility")}
                    accessibilityHint={t("orders.detail.receive.lineSearch.hint")}
                    value={receiveLineQuery}
                    onChangeText={setReceiveLineQuery}
                    placeholder={t("orders.detail.receive.lineSearch.placeholder")}
                    placeholderTextColor={colors.faint}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                    editable={!mutationBusy}
                    style={styles.receiveLineSearchInput}
                  />
                </View>
              ) : null}
              {receiveLineSearchNoMatches ? (
                <EmptyState
                  compact
                  title={t("orders.detail.receive.lineSearch.emptyTitle")}
                  body={t("orders.detail.receive.lineSearch.emptyBody")}
                />
              ) : null}
              {visibleReceiveLines.map((recommendation) => {
                const raw = receiveQuantities[recommendation.inventory_item_id] ?? "";
                const note = receiveNotes[recommendation.inventory_item_id] ?? "";
                const linePutAwayId =
                  receiveStorageLocationIds[recommendation.inventory_item_id] ??
                  receiveStorageLocationId;
                const linePutAwayLocations = showPutAwayLocationSearch
                  ? filterStorageLocationsBySearch(visibleStorageLocations, putAwayLocationQuery, {
                      selectedId: linePutAwayId
                    })
                  : visibleStorageLocations;
                const received = parseNumber(raw);
                const discrepancy =
                  received != null && Number.isFinite(received)
                    ? received - recommendation.recommended_quantity
                    : 0;
                const showDiscrepancy = received != null && Number.isFinite(received) && discrepancy !== 0;
                return (
                  <View key={recommendation.id} style={styles.receiveRow}>
                    <Text style={styles.receiveName}>{recommendation.item_name}</Text>
                    <Text style={styles.receiveOrdered}>
                      {t("orders.detail.receive.ordered", {
                        quantity: formatNumber(recommendation.recommended_quantity),
                        unit: recommendation.unit
                      })}
                    </Text>
                    <TextInput
                      accessibilityLabel={t("orders.detail.receive.receivedLabel", {
                        item: recommendation.item_name
                      })}
                      keyboardType="decimal-pad"
                      value={raw}
                      editable={!mutationBusy}
                      onChangeText={(value) =>
                        setReceiveQuantities((current) => ({
                          ...current,
                          [recommendation.inventory_item_id]: value
                        }))
                      }
                      style={styles.receiveInput}
                    />
                    {showDiscrepancy ? (
                      <Text style={styles.receiveDiscrepancy}>
                        {t("orders.detail.receive.discrepancy", {
                          delta: formatNumber(discrepancy),
                          unit: recommendation.unit
                        })}
                      </Text>
                    ) : null}
                    {visibleStorageLocations.length > 0 ? (
                      <View style={styles.receiveLinePutAway}>
                        <Text style={styles.receiveLinePutAwayLabel}>
                          {t("orders.detail.receive.putAwayLine", {
                            item: recommendation.item_name
                          })}
                        </Text>
                        <View style={styles.locationChips}>
                          {linePutAwayLocations.map((location) => {
                            const selected = location.id === linePutAwayId;
                            return (
                              <Pressable
                                key={`${recommendation.id}-${location.id}`}
                                accessibilityRole="button"
                                accessibilityState={{ selected, disabled: mutationBusy }}
                                accessibilityLabel={t("orders.detail.receive.putAwayLineOption", {
                                  item: recommendation.item_name,
                                  location: location.name
                                })}
                                disabled={mutationBusy}
                                onPress={() =>
                                  setReceiveStorageLocationIds((current) => ({
                                    ...current,
                                    [recommendation.inventory_item_id]: location.id
                                  }))
                                }
                                style={[styles.locationChip, selected && styles.locationChipSelected]}
                              >
                                <Text
                                  style={[
                                    styles.locationChipText,
                                    selected && styles.locationChipTextSelected
                                  ]}
                                >
                                  {location.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    <TextInput
                      accessibilityLabel={t("orders.detail.receive.noteLabel", {
                        item: recommendation.item_name
                      })}
                      accessibilityHint={t("orders.detail.receive.noteHint", {
                        count: formatNumber(SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS)
                      })}
                      value={note}
                      editable={!mutationBusy}
                      onChangeText={(value) =>
                        setReceiveNotes((current) => ({
                          ...current,
                          [recommendation.inventory_item_id]: value
                        }))
                      }
                      maxLength={SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS}
                      placeholder={t("orders.detail.receive.notePlaceholder")}
                      placeholderTextColor={colors.faint}
                      style={styles.receiveNoteInput}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}

          {notice && !loadError ? (
            <StatusNotice
              tone={notice.tone}
              title={notice.title}
              message={notice.message}
              actionLabel={notice.recovery === "gmail"
                ? t("orders.detail.recovery.gmail")
                : notice.recovery === "supplier"
                  ? t("orders.detail.recovery.supplier")
                  : undefined}
              onAction={
                notice.recovery === "gmail"
                  ? () => router.push("/settings/gmail" as never)
                  : notice.recovery === "supplier"
                    ? () => router.push("/settings/suppliers" as never)
                    : undefined
              }
            />
          ) : null}

          <View style={styles.actions}>
            <Button
              title={t("orders.detail.action.copy")}
              accessibilityLabel={t("orders.detail.action.copyAccessibility", {
                supplier: visibleOrder.supplier_name
              })}
              variant="secondary"
              icon={<Copy size={17} color={colors.text} strokeWidth={2.25} />}
              onPress={() => void copyOrder()}
              disabled={mutationBusy}
              style={styles.actionButton}
            />
            {canEditDraft ? (
              <Button
                title={mutationBusy ? t("orders.detail.action.saving") : t("orders.detail.action.save")}
                accessibilityLabel={t("orders.detail.action.saveAccessibility")}
                variant="secondary"
                icon={<Save size={17} color={colors.text} strokeWidth={2.25} />}
                onPress={() => void saveNote()}
                disabled={mutationBusy}
                style={styles.actionButton}
              />
            ) : null}
          </View>

          {canEditDraft ? (
            <>
              <Text style={styles.placedHint}>{t("orders.detail.placed.body")}</Text>
              <Button
                title={mutationBusy
                  ? t("orders.detail.action.markingPlaced")
                  : t("orders.detail.action.markPlaced")}
                accessibilityLabel={t("orders.detail.action.markPlacedAccessibility", {
                  supplier: visibleOrder.supplier_name
                })}
                variant="secondary"
                icon={<ClipboardCheck size={17} color={colors.text} strokeWidth={2.25} />}
                onPress={() => void markPlaced()}
                disabled={mutationBusy}
                fullWidth
              />
            </>
          ) : null}

          {canEditDraft && gmailReady ? (
            <Button
              title={mutationBusy
                ? (usingLocalDemo
                    ? t("orders.detail.action.simulating")
                    : t("orders.detail.gmail.sending"))
                : usingLocalDemo
                  ? t("orders.detail.action.simulate")
                  : t("orders.detail.gmail.send")}
              accessibilityLabel={usingLocalDemo
                ? t("orders.detail.action.simulateAccessibility", { supplier: visibleOrder.supplier_name })
                : t("orders.detail.action.sendAccessibility", { supplier: visibleOrder.supplier_name })}
              icon={<Send size={17} color={colors.surface} strokeWidth={2.25} />}
              onPress={() => void sendOrder()}
              disabled={mutationBusy}
              fullWidth
            />
          ) : null}

          {isSent && canManage ? (
            <Button
              title={mutationBusy
                ? t("orders.detail.action.receiving")
                : t("orders.detail.action.receive")}
              accessibilityLabel={t("orders.detail.action.receiveAccessibility", {
                supplier: visibleOrder.supplier_name
              })}
              icon={<ClipboardCheck size={17} color={colors.surface} strokeWidth={2.25} />}
              onPress={() => void receiveDelivery()}
              disabled={!mutationActionsEditable || !receiveReady}
              fullWidth
            />
          ) : null}
        </View>
      ) : loadError ? (
        <RetryNotice
          title={t("orders.detail.retry.title")}
          message={notice?.message ?? t("orders.detail.load.body")}
          onRetry={() => void load(true)}
          retryLabel={t("common.retry")}
          accessibilityLabel={t("orders.detail.retry.accessibility")}
        />
      ) : (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice?.message ?? missingCopy}
        </Text>
      )}
    </Screen>
  );
}

function generatedOrderMessage(order: SupplierOrder) {
  const note = order.operator_note?.trim();
  if (!note) return order.order_message;
  const suffix = "\n\nNotes:\n" + note;
  return order.order_message.endsWith(suffix)
    ? order.order_message.slice(0, -suffix.length)
    : order.order_message;
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
    paddingBottom: 24
  },
  statusRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center"
  },
  statusIconSent: {
    backgroundColor: colors.successSoft
  },
  statusCopy: {
    flex: 1,
    minWidth: 0
  },
  statusTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  statusMeta: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 2
  },
  section: {
    gap: 6
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle,
    fontSize: 18,
    lineHeight: 23
  },
  sectionBody: {
    color: colors.muted,
    ...typography.body
  },
  messagePanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 6
  },
  orderMessage: {
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400"
  },
  noteInput: {
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    padding: 13,
    marginTop: 6
  },
  sentNote: {
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceWarm,
    padding: 13,
    marginTop: 6,
    justifyContent: "center"
  },
  sentNoteText: {
    color: colors.muted,
    ...typography.body
  },
  receivePutAway: {
    gap: 6,
    marginTop: 8
  },
  receivePutAwayLabel: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 15,
    lineHeight: 20
  },
  receivePutAwayHelp: {
    color: colors.muted,
    ...typography.caption
  },
  receiveLinePutAway: {
    gap: 4,
    marginTop: 2
  },
  receiveLinePutAwayLabel: {
    color: colors.muted,
    ...typography.caption,
    fontWeight: "600"
  },
  receiveLineSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8
  },
  receiveLineSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
  },
  locationSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  locationSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
  },
  locationSearchEmpty: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2
  },
  locationChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  locationChip: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center"
  },
  locationChipSelected: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentSoft ?? colors.surface
  },
  locationChipText: {
    color: colors.text,
    ...typography.caption,
    fontWeight: "600"
  },
  locationChipTextSelected: {
    color: colors.accentDark
  },
  receiveRow: {
    gap: 6,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  receiveName: {
    color: colors.text,
    ...typography.cardTitle
  },
  receiveOrdered: {
    color: colors.muted,
    ...typography.caption
  },
  receiveInput: {
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  receiveNoteInput: {
    minHeight: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  receiveDiscrepancy: {
    color: colors.danger,
    ...typography.caption,
    fontWeight: "600"
  },
  receiveDiscrepancyShort: {
    color: colors.danger
  },
  receiveDiscrepancyOver: {
    color: colors.warning
  },
  receiveMatched: {
    color: colors.success,
    ...typography.caption,
    fontWeight: "600"
  },
  notice: {
    color: colors.text,
    ...typography.caption,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 10
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  placedHint: {
    color: colors.muted,
    ...typography.caption
  }
});
