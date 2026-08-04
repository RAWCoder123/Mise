import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ClipboardList,
  PackageCheck,
  Save,
  Search,
  Trash2
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import {
  addInventoryItemToOrder,
  createStorageLocation,
  fetchInventoryItemOutlook,
  fetchInventoryLocationBalances,
  fetchInventoryMovements,
  fetchStorageLocations,
  recordInventoryWaste,
  transferInventory,
  updateInventoryItem
} from "../../services/miseService";
import {
  filterStorageLocationsBySearch,
  STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD
} from "../../services/domain/inventoryItemSearch";
import { reconcileLocationBalancesForDisplay } from "../../services/domain/inventoryTransfer";
import {
  isInventoryDetailStationActionBlocked,
  presentInventoryDetailMissingCopy,
  presentInventoryDetailMutationActionsEditable,
  presentInventoryDetailMutationBusy,
  presentInventoryDetailMutationNoticeCopy,
  presentInventoryDetailSecondaryLoadCopy,
  resolveInventoryDetailLoadState,
  resolveInventoryDetailSaveFailureReason,
  resolveInventoryDetailSecondaryLoadState,
  resolveInventoryDetailTransferFailureReason,
  resolveInventoryDetailWasteFailureReason,
  type InventoryDetailMutationNoticeReason
} from "../../services/presentation/inventoryDetailPresentation";
import {
  canManageRestaurantData,
  canManageStorageLocations,
  canRecordInventoryWaste,
  canTransferInventory
} from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";
import { captureMiseError } from "../../services/telemetry";
import type { MessageKey } from "../../i18n/catalog";
import type {
  InventoryLocationBalance,
  InventoryMovement,
  InventoryMovementReason,
  InventoryOutlookItem,
  StorageLocation
} from "../../types/mise";
import { statusTone } from "../../utils/inventory";

type InventoryDetailNotice = {
  tone: StatusNoticeTone;
  title: string;
  message: string;
};

const MUTATION_NOTICE_KEYS: Record<
  InventoryDetailMutationNoticeReason,
  { title: MessageKey; message: MessageKey }
> = {
  noWorkspace: {
    title: "inventory.detail.notice.noWorkspaceTitle",
    message: "inventory.detail.noWorkspace"
  },
  viewOnlyInventory: {
    title: "inventory.detail.notice.viewOnlyInventoryTitle",
    message: "inventory.detail.viewOnlyInventory"
  },
  viewOnlyOrdering: {
    title: "inventory.detail.notice.viewOnlyOrderingTitle",
    message: "inventory.detail.viewOnlyOrdering"
  },
  reviewFields: {
    title: "inventory.detail.notice.reviewFieldsTitle",
    message: "inventory.detail.reviewFields"
  },
  updated: {
    title: "inventory.detail.notice.updatedTitle",
    message: "inventory.detail.updated"
  },
  saveFailed: {
    title: "inventory.detail.notice.saveFailedTitle",
    message: "inventory.detail.saveError"
  },
  added: {
    title: "inventory.detail.notice.addedTitle",
    message: "inventory.detail.added"
  },
  addFailed: {
    title: "inventory.detail.notice.addFailedTitle",
    message: "inventory.detail.addError"
  },
  reviewWaste: {
    title: "inventory.detail.notice.reviewWasteTitle",
    message: "inventory.detail.reviewWaste"
  },
  wasteRecorded: {
    title: "inventory.detail.notice.wasteRecordedTitle",
    message: "inventory.detail.wasteRecorded"
  },
  wasteNothingOnHand: {
    title: "inventory.detail.notice.wasteNothingOnHandTitle",
    message: "inventory.detail.notice.wasteNothingOnHandBody"
  },
  wasteLocationMissing: {
    title: "inventory.detail.notice.wasteLocationMissingTitle",
    message: "inventory.detail.notice.wasteLocationMissingBody"
  },
  wasteLocationInsufficient: {
    title: "inventory.detail.notice.wasteLocationInsufficientTitle",
    message: "inventory.detail.wasteLocationInsufficient"
  },
  wasteFailed: {
    title: "inventory.detail.notice.wasteFailedTitle",
    message: "inventory.detail.wasteError"
  },
  reviewTransfer: {
    title: "inventory.detail.notice.reviewTransferTitle",
    message: "inventory.detail.reviewTransfer"
  },
  transferRecorded: {
    title: "inventory.detail.notice.transferRecordedTitle",
    message: "inventory.detail.transferRecorded"
  },
  transferInsufficient: {
    title: "inventory.detail.notice.transferInsufficientTitle",
    message: "inventory.detail.notice.transferInsufficientBody"
  },
  transferSameLocation: {
    title: "inventory.detail.notice.transferSameLocationTitle",
    message: "inventory.detail.notice.transferSameLocationBody"
  },
  transferLocationMissing: {
    title: "inventory.detail.notice.transferLocationMissingTitle",
    message: "inventory.detail.notice.transferLocationMissingBody"
  },
  transferFailed: {
    title: "inventory.detail.notice.transferFailedTitle",
    message: "inventory.detail.transferError"
  },
  locationAdded: {
    title: "inventory.detail.notice.locationAddedTitle",
    message: "inventory.detail.locationAdded"
  },
  locationFailed: {
    title: "inventory.detail.notice.locationFailedTitle",
    message: "inventory.detail.locationError"
  },
  locationsUnavailable: {
    title: "inventory.detail.notice.locationsUnavailableTitle",
    message: "inventory.detail.notice.locationsUnavailableBody"
  },
  loadFailed: {
    title: "inventory.detail.notice.loadFailedTitle",
    message: "inventory.detail.loadError"
  }
};

export default function InventoryDetailScreen() {
  const { formatDate, formatNumber, formatRelativeTime, parseNumber, t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { memberships, restaurant } = useMiseSession();
  const [outlook, setOutlook] = useState<InventoryOutlookItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementsLoadError, setMovementsLoadError] = useState(false);
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [wasteNote, setWasteNote] = useState("");
  const [wasteStorageLocationId, setWasteStorageLocationId] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [storageLocationsLoadError, setStorageLocationsLoadError] = useState(false);
  const [locationBalances, setLocationBalances] = useState<InventoryLocationBalance[]>([]);
  const [locationBalancesLoadError, setLocationBalancesLoadError] = useState(false);
  const [fromStorageLocationId, setFromStorageLocationId] = useState("");
  const [toStorageLocationId, setToStorageLocationId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<InventoryFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<InventoryDetailNotice | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const loadedItemIdRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const mutationNotice = useCallback(
    (reason: InventoryDetailMutationNoticeReason): InventoryDetailNotice => {
      const localized = (
        Object.keys(MUTATION_NOTICE_KEYS) as InventoryDetailMutationNoticeReason[]
      ).reduce(
        (acc, key) => {
          acc[key] = {
            title: t(MUTATION_NOTICE_KEYS[key].title),
            message: t(MUTATION_NOTICE_KEYS[key].message)
          };
          return acc;
        },
        {} as Record<InventoryDetailMutationNoticeReason, { title: string; message: string }>
      );
      return presentInventoryDetailMutationNoticeCopy(reason, localized);
    },
    [t]
  );

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant || !id) {
      setLoading(false);
      setLoadError(false);
      setNotice(mutationNotice("noWorkspace"));
      return;
    }
    const restaurantId = restaurant.id;
    const itemId = id;
    const requestId = ++requestIdRef.current;
    if (
      showLoading ||
      loadedRestaurantRef.current !== restaurantId ||
      loadedItemIdRef.current !== itemId
    ) {
      setLoading(true);
    }
    setNotice(null);
    setLoadError(false);
    try {
      const [nextOutlook, movementsResult, locationsResult, balancesResult] = await Promise.all([
        fetchInventoryItemOutlook(restaurantId, itemId),
        fetchInventoryMovements(restaurantId, itemId, 6)
          .then((rows) => ({ ok: true as const, rows }))
          .catch((error: unknown) => ({ ok: false as const, error })),
        fetchStorageLocations(restaurantId)
          .then((locations) => ({ ok: true as const, locations }))
          .catch((error: unknown) => ({ ok: false as const, error })),
        fetchInventoryLocationBalances(restaurantId, itemId)
          .then((balances) => ({ ok: true as const, balances }))
          .catch((error: unknown) => ({ ok: false as const, error }))
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      if (!movementsResult.ok) {
        captureMiseError(movementsResult.error, {
          flow: "inventory_detail",
          operation: "load_movements",
          restaurant_id: restaurantId
        });
      }
      if (!locationsResult.ok) {
        captureMiseError(locationsResult.error, {
          flow: "inventory_detail",
          operation: "load_storage_locations",
          restaurant_id: restaurantId
        });
      }
      if (!balancesResult.ok) {
        captureMiseError(balancesResult.error, {
          flow: "inventory_detail",
          operation: "load_location_balances",
          restaurant_id: restaurantId
        });
      }
      const nextMovements = movementsResult.ok ? movementsResult.rows : [];
      const nextLocations = locationsResult.ok ? locationsResult.locations : [];
      const nextBalances = balancesResult.ok ? balancesResult.balances : [];
      setOutlook(nextOutlook);
      setMovements(nextMovements);
      setMovementsLoadError(!movementsResult.ok);
      setStorageLocations(nextLocations);
      setStorageLocationsLoadError(!locationsResult.ok);
      setLocationBalances(nextBalances);
      setLocationBalancesLoadError(!balancesResult.ok);
      loadedRestaurantRef.current = restaurantId;
      loadedItemIdRef.current = itemId;
      setLoadedRestaurantId(restaurantId);
      if (nextOutlook) {
        setCurrentQuantity(formatNumber(nextOutlook.item.current_quantity, { maximumFractionDigits: 2, useGrouping: false }));
        setParLevel(formatNumber(nextOutlook.item.par_level, { maximumFractionDigits: 2, useGrouping: false }));
        setReorderThreshold(formatNumber(nextOutlook.item.reorder_threshold, { maximumFractionDigits: 2, useGrouping: false }));
        setFieldErrors({});
      }
      const main = nextLocations.find((location) => location.name.toLowerCase() === "main") ?? nextLocations[0];
      const secondary =
        nextLocations.find((location) => location.id !== main?.id) ?? nextLocations[1] ?? null;
      setFromStorageLocationId((current) => {
        if (!locationsResult.ok) return "";
        return current && nextLocations.some((location) => location.id === current)
          ? current
          : main?.id ?? "";
      });
      setWasteStorageLocationId((current) => {
        if (!locationsResult.ok) return "";
        return current && nextLocations.some((location) => location.id === current)
          ? current
          : main?.id ?? "";
      });
      setToStorageLocationId((current) => {
        if (!locationsResult.ok) return "";
        return current &&
          nextLocations.some((location) => location.id === current) &&
          current !== (main?.id ?? "")
          ? current
          : secondary?.id ?? "";
      });
    } catch (error) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(error, {
        flow: "inventory_detail",
        operation: "load",
        restaurant_id: restaurantId
      });
      const keepPrior =
        loadedRestaurantRef.current === restaurantId && loadedItemIdRef.current === itemId;
      if (!keepPrior) {
        setOutlook(null);
        setMovements([]);
        setMovementsLoadError(false);
        setStorageLocations([]);
        setStorageLocationsLoadError(false);
        setLocationBalances([]);
        setLocationBalancesLoadError(false);
      }
      setLoadError(true);
      setNotice(mutationNotice("loadFailed"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [formatNumber, id, mutationNotice, restaurant]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    loadedItemIdRef.current = null;
    setLoadedRestaurantId(null);
    setOutlook(null);
    setCurrentQuantity("");
    setParLevel("");
    setReorderThreshold("");
    setWasteQuantity("");
    setWasteNote("");
    setWasteStorageLocationId("");
    setCorrectionNote("");
    setMovements([]);
    setMovementsLoadError(false);
    setStorageLocations([]);
    setStorageLocationsLoadError(false);
    setLocationBalances([]);
    setLocationBalancesLoadError(false);
    setFromStorageLocationId("");
    setToStorageLocationId("");
    setTransferQuantity("");
    setTransferNote("");
    setNewLocationName("");
    setSaving(false);
    setFieldErrors({});
    setNotice(null);
    setLoadError(false);
    setLoading(Boolean(restaurant && id));
    void load(true);
  }, [id, load, restaurant?.id]);

  useEffect(() => {
    if (
      !notice ||
      notice.tone === "danger" ||
      notice.tone === "caution" ||
      notice.tone === "warning"
    ) {
      return undefined;
    }
    const timeout = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const hubLoadState = resolveInventoryDetailLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const visibleOutlook = hubReady ? outlook : null;
  const missingCopy = presentInventoryDetailMissingCopy(hubLoadState, {
    loading: t("inventory.detail.loading"),
    unavailable: t("inventory.detail.unavailable"),
    notFound: t("inventory.detail.notFound")
  });
  const item = visibleOutlook?.item ?? null;
  const prediction = visibleOutlook?.prediction ?? null;
  const localizedPrediction = item && prediction
    ? localizeInventoryPrediction(t, formatNumber, item, prediction)
    : null;
  const status = prediction?.projectedStatus ?? null;
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canRecordWaste = canRecordInventoryWaste(memberships, restaurant?.id);
  const canTransfer = canTransferInventory(memberships, restaurant?.id);
  const canManageLocations = canManageStorageLocations(memberships, restaurant?.id);
  const mutationBusy = presentInventoryDetailMutationBusy(saving);
  const manageEditable = presentInventoryDetailMutationActionsEditable(
    canManage,
    mutationBusy,
    hubReady
  );
  const wasteEditable = presentInventoryDetailMutationActionsEditable(
    canRecordWaste,
    mutationBusy,
    hubReady
  );
  const transferEditable = presentInventoryDetailMutationActionsEditable(
    canTransfer,
    mutationBusy,
    hubReady
  );
  const locationEditable = presentInventoryDetailMutationActionsEditable(
    canManageLocations,
    mutationBusy,
    hubReady
  );
  /** Staff primary action — surface waste above read-only count settings. */
  const showWasteBeforeCountSettings = canRecordWaste && !canManage;
  const visibleMovements = hubReady ? movements : [];
  const visibleMovementsLoadError = hubReady ? movementsLoadError : false;
  const visibleStorageLocations = hubReady ? storageLocations : [];
  const visibleStorageLocationsLoadError = hubReady ? storageLocationsLoadError : false;
  const visibleLocationBalances = hubReady ? locationBalances : [];
  const visibleLocationBalancesLoadError = hubReady ? locationBalancesLoadError : false;
  const movementsLoadState = resolveInventoryDetailSecondaryLoadState({
    loadError: visibleMovementsLoadError,
    count: visibleMovements.length
  });
  const locationsLoadState = resolveInventoryDetailSecondaryLoadState({
    loadError: visibleStorageLocationsLoadError,
    count: visibleStorageLocations.length
  });
  const balancesLoadState = resolveInventoryDetailSecondaryLoadState({
    loadError: visibleLocationBalancesLoadError,
    count: visibleLocationBalances.length
  });
  const movementsUnavailableCopy = presentInventoryDetailSecondaryLoadCopy(movementsLoadState, {
    unavailableTitle: t("inventory.detail.movements.unavailable.title"),
    unavailableBody: t("inventory.detail.movements.unavailable.body")
  });
  const locationsUnavailableCopy = presentInventoryDetailSecondaryLoadCopy(locationsLoadState, {
    unavailableTitle: t("inventory.detail.locations.unavailable.title"),
    unavailableBody: t("inventory.detail.locations.unavailable.body")
  });
  const balancesUnavailableCopy = presentInventoryDetailSecondaryLoadCopy(balancesLoadState, {
    unavailableTitle: t("inventory.detail.balances.unavailable.title"),
    unavailableBody: t("inventory.detail.balances.unavailable.body")
  });
  const stationsBlocked = isInventoryDetailStationActionBlocked(locationsLoadState);
  const balanceView =
    item && !visibleLocationBalancesLoadError
      ? reconcileLocationBalancesForDisplay({
          onHandQuantity: item.current_quantity,
          balances: visibleLocationBalances.map((balance) => {
            const location = visibleStorageLocations.find(
              (entry) => entry.id === balance.storage_location_id
            );
            return {
              storageLocationId: balance.storage_location_id,
              name: location?.name ?? balance.storage_location_id,
              quantity: balance.quantity
            };
          })
        })
      : null;

  function goBackToInventory() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/inventory");
  }

  async function save() {
    if (!restaurant || !item || !hubReady || mutationBusy) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnlyInventory"));
      return;
    }

    const nextFieldErrors: InventoryFieldErrors = {
      currentQuantity: validateInventoryNumber(currentQuantity, t("inventory.detail.field.currentQuantity"), parseNumber, formatNumber, t),
      parLevel: validateInventoryNumber(parLevel, t("inventory.detail.field.parLevel"), parseNumber, formatNumber, t),
      reorderThreshold: validateInventoryNumber(reorderThreshold, t("inventory.detail.field.reorderThreshold"), parseNumber, formatNumber, t)
    };
    if (correctionNote.trim().length > 240) {
      nextFieldErrors.correctionNote = t("inventory.detail.correctionNoteTooLong");
    }
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      setNotice(mutationNotice("reviewFields"));
      return;
    }

    const restaurantId = restaurant.id;
    setFieldErrors({});
    setSaving(true);
    setNotice(null);
    try {
      await updateInventoryItem(
        restaurantId,
        item.id,
        {
          current_quantity: parseNumber(currentQuantity) ?? 0,
          par_level: parseNumber(parLevel) ?? 0,
          reorder_threshold: parseNumber(reorderThreshold) ?? 0
        },
        correctionNote.trim() || null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setCorrectionNote("");
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("updated"));
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        captureMiseError(error, {
          flow: "inventory_detail",
          operation: "update_inventory_item",
          restaurant_id: restaurantId
        });
        setNotice(mutationNotice(resolveInventoryDetailSaveFailureReason(error)));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function addToOrder() {
    if (!restaurant || !item || !hubReady || mutationBusy) return;
    if (!canManage) {
      setNotice(mutationNotice("viewOnlyOrdering"));
      return;
    }
    const restaurantId = restaurant.id;
    setSaving(true);
    setNotice(null);
    try {
      await addInventoryItemToOrder(restaurantId, item.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("added"));
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        captureMiseError(error, {
          flow: "inventory_detail",
          operation: "add_to_order",
          restaurant_id: restaurantId
        });
        setNotice(mutationNotice("addFailed"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function recordWaste() {
    if (!restaurant || !item || !hubReady || mutationBusy) return;
    if (!canRecordWaste) {
      setNotice(mutationNotice("viewOnlyInventory"));
      return;
    }
    if (
      isInventoryDetailStationActionBlocked(
        resolveInventoryDetailSecondaryLoadState({
          loadError: storageLocationsLoadError,
          count: storageLocations.length
        })
      )
    ) {
      setNotice(mutationNotice("locationsUnavailable"));
      return;
    }

    const wasteFieldError = validateWasteQuantity(
      wasteQuantity,
      t("inventory.detail.field.wasteQuantity"),
      parseNumber,
      formatNumber,
      t
    );
    if (wasteFieldError) {
      setFieldErrors((current) => ({ ...current, wasteQuantity: wasteFieldError }));
      setNotice(mutationNotice("reviewWaste"));
      return;
    }
    if (wasteNote.trim().length > 240) {
      setFieldErrors((current) => ({
        ...current,
        wasteNote: t("inventory.detail.wasteNoteTooLong")
      }));
      setNotice(mutationNotice("reviewWaste"));
      return;
    }
    if (storageLocations.length > 0 && !wasteStorageLocationId) {
      setFieldErrors((current) => ({
        ...current,
        wasteLocation: t("inventory.detail.fieldRequired", {
          field: t("inventory.detail.wasteLocation")
        })
      }));
      setNotice(mutationNotice("reviewWaste"));
      return;
    }

    const restaurantId = restaurant.id;
    setFieldErrors((current) => ({
      ...current,
      wasteQuantity: undefined,
      wasteNote: undefined,
      wasteLocation: undefined
    }));
    setSaving(true);
    setNotice(null);
    try {
      await recordInventoryWaste(
        restaurantId,
        item.id,
        parseNumber(wasteQuantity) ?? 0,
        wasteNote.trim() || null,
        wasteStorageLocationId || null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setWasteQuantity("");
      setWasteNote("");
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("wasteRecorded"));
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        captureMiseError(error, {
          flow: "inventory_detail",
          operation: "record_waste",
          restaurant_id: restaurantId
        });
        setNotice(mutationNotice(resolveInventoryDetailWasteFailureReason(error)));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function submitTransfer() {
    if (!restaurant || !item || !hubReady || mutationBusy) return;
    if (!canTransfer) {
      setNotice(mutationNotice("viewOnlyInventory"));
      return;
    }
    if (
      isInventoryDetailStationActionBlocked(
        resolveInventoryDetailSecondaryLoadState({
          loadError: storageLocationsLoadError,
          count: storageLocations.length
        })
      )
    ) {
      setNotice(mutationNotice("locationsUnavailable"));
      return;
    }

    const transferFieldError = validateWasteQuantity(
      transferQuantity,
      t("inventory.detail.field.transferQuantity"),
      parseNumber,
      formatNumber,
      t
    );
    if (transferFieldError || !fromStorageLocationId || !toStorageLocationId) {
      setFieldErrors((current) => ({
        ...current,
        transferQuantity: transferFieldError,
        transferFrom: !fromStorageLocationId ? t("inventory.detail.fieldRequired", { field: t("inventory.detail.transferFrom") }) : undefined,
        transferTo: !toStorageLocationId ? t("inventory.detail.fieldRequired", { field: t("inventory.detail.transferTo") }) : undefined
      }));
      setNotice(mutationNotice("reviewTransfer"));
      return;
    }
    if (transferNote.trim().length > 240) {
      setFieldErrors((current) => ({
        ...current,
        transferNote: t("inventory.detail.transferNoteTooLong")
      }));
      setNotice(mutationNotice("reviewTransfer"));
      return;
    }

    const restaurantId = restaurant.id;
    setFieldErrors((current) => ({
      ...current,
      transferQuantity: undefined,
      transferNote: undefined,
      transferFrom: undefined,
      transferTo: undefined
    }));
    setSaving(true);
    setNotice(null);
    try {
      await transferInventory(
        restaurantId,
        item.id,
        fromStorageLocationId,
        toStorageLocationId,
        parseNumber(transferQuantity) ?? 0,
        transferNote.trim() || null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setTransferQuantity("");
      setTransferNote("");
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("transferRecorded"));
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        captureMiseError(error, {
          flow: "inventory_detail",
          operation: "transfer_inventory",
          restaurant_id: restaurantId
        });
        setNotice(mutationNotice(resolveInventoryDetailTransferFailureReason(error)));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function addLocation() {
    if (!restaurant || !locationEditable) return;
    const restaurantId = restaurant.id;
    setSaving(true);
    setNotice(null);
    try {
      await createStorageLocation(restaurantId, newLocationName);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNewLocationName("");
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNotice(mutationNotice("locationAdded"));
    } catch (error) {
      if (activeRestaurantIdRef.current === restaurantId) {
        captureMiseError(error, {
          flow: "inventory_detail",
          operation: "create_storage_location",
          restaurant_id: restaurantId
        });
        setNotice(mutationNotice("locationFailed"));
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  return (
    <Screen
      title={item?.item_name ?? t("inventory.detail.title")}
      subtitle={item ? `${item.supplier_name} · ${item.category}` : t("inventory.detail.subtitle")}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={t("inventory.detail.back")} onPress={goBackToInventory}>
          <ArrowLeft size={20} color={colors.accentDark} strokeWidth={2.4} />
        </ActionIcon>
      }
    >
      {item && status && prediction && localizedPrediction ? (
        <View style={styles.stack}>
          {loadError ? (
            <RetryNotice
              title={t("inventory.detail.retry.title")}
              message={notice?.message ?? t("inventory.detail.loadError")}
              onRetry={() => void load(true)}
              retryLabel={t("common.retry")}
              accessibilityLabel={t("inventory.detail.retry.accessibility")}
            />
          ) : null}

          <OperationalHero
            eyebrow={t("inventory.detail.intelligence")}
            title={localizedPrediction.coverage}
            body={localizedPrediction.recommendation}
            meta={localizedPrediction.status}
            tone={
              status === "Good"
                ? "leaf"
                : status === "Watch"
                  ? "caution"
                  : status === "Low"
                    ? "warning"
                    : "danger"
            }
            icon={<PackageCheck size={21} color={inventoryStatusColors[status]} strokeWidth={2.6} />}
            stats={[
              {
                label: t("inventory.detail.projected"),
                value: `${formatNumber(prediction.projectedQuantity, { maximumFractionDigits: 1 })} ${item.unit}`,
                tone:
                  status === "Good"
                    ? "leaf"
                    : status === "Watch"
                      ? "caution"
                      : status === "Low"
                        ? "warning"
                        : "danger"
              },
              { label: t("inventory.detail.lastCount"), value: `${formatNumber(item.current_quantity, { maximumFractionDigits: 1 })} ${item.unit}`, tone: "neutral" },
              { label: t("inventory.detail.posUsed"), value: `${formatNumber(prediction.todayDepletion, { maximumFractionDigits: 1 })} ${item.unit}`, tone: "neutral" }
            ]}
          />

          {!canManage ? (
            <StatusNotice
              title={t(
                canRecordWaste
                  ? "inventory.detail.limitedAccess.title"
                  : "inventory.detail.viewOnly.title"
              )}
              message={t(
                canRecordWaste
                  ? "inventory.detail.limitedAccess.body"
                  : "inventory.detail.viewOnly.body"
              )}
            />
          ) : null}

          {!loadError && notice ? (
            <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
          ) : null}

          <Card>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, styles.flushTitle]}>{t("inventory.detail.stockEvidence")}</Text>
              <Badge label={localizedPrediction.status} tone={statusTone(status)} />
            </View>
            <View style={styles.countRail}>
              <View style={styles.countBlock}>
                <Text style={styles.countLabel}>{t("inventory.detail.lastCount")}</Text>
                <Text style={styles.countValue}>{formatNumber(item.current_quantity, { maximumFractionDigits: 1 })} {item.unit}</Text>
              </View>
              <View style={styles.countBlock}>
                <Text style={styles.countLabel}>{t("inventory.detail.posDepleted")}</Text>
                <Text style={[styles.countValue, prediction.todayDepletion > 0 && styles.depletionValue]}>
                  {prediction.todayDepletion > 0 ? "-" : ""}{formatNumber(prediction.todayDepletion, { maximumFractionDigits: 1 })} {item.unit}
                </Text>
              </View>
            </View>
            {prediction.todayDepletion > 0 && (
              <View style={styles.depletionRow}>
                <ArrowDownRight size={16} color={colors.accentDark} strokeWidth={2.5} />
                <Text style={styles.depletionText}>{localizedPrediction.depletion}</Text>
              </View>
            )}
            <View style={styles.coverageBox}>
              <Text style={styles.kicker}>{t("inventory.detail.predictedCoverage")}</Text>
              <Text style={styles.coverage}>{localizedPrediction.coverage}</Text>
              <Text style={styles.copy}>{localizedPrediction.basis}. {localizedPrediction.confidence}</Text>
            </View>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.detail.recentUsage")}</Text>
            <View style={styles.factGrid}>
              <View style={styles.fact}>
                <Text style={styles.factValue}>{formatNumber(prediction.averageDailyUsage, { maximumFractionDigits: 1 })}</Text>
                <Text style={styles.factLabel}>{t("inventory.detail.perDay", { unit: item.unit })}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factValue}>{prediction.daysCoverage === null ? "—" : formatNumber(prediction.daysCoverage, { maximumFractionDigits: 1 })}</Text>
                <Text style={styles.factLabel}>{t("inventory.detail.daysCoverage")}</Text>
              </View>
            </View>
            <View style={styles.recommendationBox}>
              <Text style={styles.kicker}>{t("inventory.detail.recommendation")}</Text>
              <Text style={styles.recommendation}>{localizedPrediction.recommendation}</Text>
              <Text style={styles.copy}>{localizedPrediction.whyItMatters}</Text>
            </View>
            {canManage ? (
              <Button
                title={t("inventory.detail.addToOrder")}
                accessibilityLabel={t("inventory.detail.addAccessibility", { item: item.item_name })}
                variant="secondary"
                icon={<ClipboardList size={17} color={colors.text} strokeWidth={2.5} />}
                onPress={addToOrder}
                disabled={!manageEditable}
                fullWidth
                style={styles.addButton}
              />
            ) : null}
          </Card>

          {showWasteBeforeCountSettings || canTransfer ? (
            locationsUnavailableCopy ? (
              <RetryNotice
                title={locationsUnavailableCopy.title}
                message={locationsUnavailableCopy.message}
                onRetry={() => void load(true)}
                accessibilityLabel={t("inventory.detail.locations.unavailable.retryAccessibility")}
              />
            ) : null
          ) : null}

          {showWasteBeforeCountSettings && !stationsBlocked ? (
            <WasteRecordingCard
              t={t}
              itemName={item.item_name}
              unit={item.unit}
              locations={visibleStorageLocations}
              wasteStorageLocationId={wasteStorageLocationId}
              wasteQuantity={wasteQuantity}
              wasteNote={wasteNote}
              fieldErrors={fieldErrors}
              saving={saving}
              editable={wasteEditable}
              setWasteStorageLocationId={setWasteStorageLocationId}
              setWasteQuantity={setWasteQuantity}
              setWasteNote={setWasteNote}
              setFieldErrors={setFieldErrors}
              onRecordWaste={recordWaste}
            />
          ) : null}

          {canTransfer && !stationsBlocked ? (
            <TransferStockCard
              t={t}
              formatNumber={formatNumber}
              itemName={item.item_name}
              unit={item.unit}
              locations={visibleStorageLocations}
              balanceView={balanceView}
              balancesUnavailableCopy={balancesUnavailableCopy}
              onRetryBalances={() => void load(true)}
              fromStorageLocationId={fromStorageLocationId}
              toStorageLocationId={toStorageLocationId}
              transferQuantity={transferQuantity}
              transferNote={transferNote}
              newLocationName={newLocationName}
              canManageLocations={canManageLocations}
              locationEditable={locationEditable}
              fieldErrors={fieldErrors}
              saving={saving}
              editable={transferEditable}
              setFromStorageLocationId={setFromStorageLocationId}
              setToStorageLocationId={setToStorageLocationId}
              setTransferQuantity={setTransferQuantity}
              setTransferNote={setTransferNote}
              setNewLocationName={setNewLocationName}
              setFieldErrors={setFieldErrors}
              onTransfer={submitTransfer}
              onAddLocation={addLocation}
            />
          ) : null}

          <Card>
            <Text style={styles.cardTitle}>{canManage ? t("inventory.detail.updateCount") : t("inventory.detail.countSettings")}</Text>
            <Field
              label={t("inventory.detail.currentQuantity", { unit: item.unit })}
              value={currentQuantity}
              onChangeText={(value) => {
                setCurrentQuantity(value);
                setFieldErrors((current) => ({ ...current, currentQuantity: undefined }));
              }}
              editable={manageEditable}
              error={fieldErrors.currentQuantity}
            />
            <Field
              label={t("inventory.detail.parLevel", { unit: item.unit })}
              value={parLevel}
              onChangeText={(value) => {
                setParLevel(value);
                setFieldErrors((current) => ({ ...current, parLevel: undefined }));
              }}
              editable={manageEditable}
              error={fieldErrors.parLevel}
            />
            <Field
              label={t("inventory.detail.reorderThreshold", { unit: item.unit })}
              value={reorderThreshold}
              onChangeText={(value) => {
                setReorderThreshold(value);
                setFieldErrors((current) => ({ ...current, reorderThreshold: undefined }));
              }}
              editable={manageEditable}
              error={fieldErrors.reorderThreshold}
            />
            {canManage ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t("inventory.detail.correctionNote")}</Text>
                <TextInput
                  accessibilityLabel={t("inventory.detail.correctionNote")}
                  accessibilityHint={fieldErrors.correctionNote}
                  value={correctionNote}
                  onChangeText={(value) => {
                    setCorrectionNote(value);
                    setFieldErrors((current) => ({ ...current, correctionNote: undefined }));
                  }}
                  editable={manageEditable}
                  multiline
                  style={[styles.input, styles.noteInput, fieldErrors.correctionNote && styles.inputError]}
                />
                {fieldErrors.correctionNote ? (
                  <Text style={styles.fieldError} accessibilityLiveRegion="polite">
                    {fieldErrors.correctionNote}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {canManage ? (
              <Button
                title={saving ? t("inventory.detail.saving") : t("inventory.detail.saveCount")}
                icon={<Save size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={save}
                disabled={!manageEditable}
                fullWidth
                style={styles.saveButton}
              />
            ) : null}
          </Card>

          {canRecordWaste && !showWasteBeforeCountSettings && !stationsBlocked ? (
            <WasteRecordingCard
              t={t}
              itemName={item.item_name}
              unit={item.unit}
              locations={visibleStorageLocations}
              wasteStorageLocationId={wasteStorageLocationId}
              wasteQuantity={wasteQuantity}
              wasteNote={wasteNote}
              fieldErrors={fieldErrors}
              saving={saving}
              editable={wasteEditable}
              setWasteStorageLocationId={setWasteStorageLocationId}
              setWasteQuantity={setWasteQuantity}
              setWasteNote={setWasteNote}
              setFieldErrors={setFieldErrors}
              onRecordWaste={recordWaste}
            />
          ) : null}

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.detail.movements.title")}</Text>
            {movementsUnavailableCopy ? (
              <RetryNotice
                title={movementsUnavailableCopy.title}
                message={movementsUnavailableCopy.message}
                onRetry={() => void load(true)}
                accessibilityLabel={t("inventory.detail.movements.unavailable.retryAccessibility")}
              />
            ) : visibleMovements.length === 0 ? (
              <Text style={styles.copy}>{t("inventory.detail.movements.empty")}</Text>
            ) : (
              <View style={styles.movementList}>
                {visibleMovements.map((movement) => {
                  const movementNote = movementNoteText(movement.metadata);
                  return (
                  <View key={movement.id} style={styles.movementRow}>
                    <View style={styles.movementCopy}>
                      <Text style={styles.movementReason}>{movementReasonLabel(t, movement.reason)}</Text>
                      <Text style={styles.movementDelta}>
                        {t("inventory.detail.movements.delta", {
                          before: formatNumber(movement.quantity_before, { maximumFractionDigits: 1 }),
                          after: formatNumber(movement.quantity_after, { maximumFractionDigits: 1 }),
                          unit: item.unit
                        })}
                      </Text>
                      {movementNote ? <Text style={styles.movementNote}>{movementNote}</Text> : null}
                    </View>
                    <Text style={styles.movementWhen} accessibilityLabel={formatDate(movement.created_at, { dateStyle: "medium", timeStyle: "short" })}>
                      {formatRelativeTime(movement.created_at)}
                    </Text>
                  </View>
                  );
                })}
              </View>
            )}
          </Card>
        </View>
      ) : loadError ? (
        <RetryNotice
          title={t("inventory.detail.retry.title")}
          message={notice?.message ?? t("inventory.detail.loadError")}
          onRetry={() => void load(true)}
          retryLabel={t("common.retry")}
          accessibilityLabel={t("inventory.detail.retry.accessibility")}
        />
      ) : notice ? (
        <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
      ) : (
        <Text style={styles.message}>{missingCopy}</Text>
      )}
    </Screen>
  );
}

interface InventoryFieldErrors {
  currentQuantity?: string;
  parLevel?: string;
  reorderThreshold?: string;
  correctionNote?: string;
  wasteQuantity?: string;
  wasteNote?: string;
  wasteLocation?: string;
  transferQuantity?: string;
  transferNote?: string;
  transferFrom?: string;
  transferTo?: string;
}

function WasteRecordingCard({
  t,
  itemName,
  unit,
  locations,
  wasteStorageLocationId,
  wasteQuantity,
  wasteNote,
  fieldErrors,
  saving,
  editable,
  setWasteStorageLocationId,
  setWasteQuantity,
  setWasteNote,
  setFieldErrors,
  onRecordWaste
}: {
  t: ReturnType<typeof useLocale>["t"];
  itemName: string;
  unit: string;
  locations: StorageLocation[];
  wasteStorageLocationId: string;
  wasteQuantity: string;
  wasteNote: string;
  fieldErrors: InventoryFieldErrors;
  saving: boolean;
  editable: boolean;
  setWasteStorageLocationId: (value: string) => void;
  setWasteQuantity: (value: string) => void;
  setWasteNote: (value: string) => void;
  setFieldErrors: Dispatch<SetStateAction<InventoryFieldErrors>>;
  onRecordWaste: () => void;
}) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{t("inventory.detail.recordWaste")}</Text>
      <Text style={styles.copy}>{t("inventory.detail.wasteHelp")}</Text>
      {locations.length > 0 ? (
        <LocationChooser
          label={t("inventory.detail.wasteLocation")}
          locations={locations}
          selectedId={wasteStorageLocationId}
          error={fieldErrors.wasteLocation}
          disabled={!editable}
          onSelect={(value) => {
            setWasteStorageLocationId(value);
            setFieldErrors((current) => ({ ...current, wasteLocation: undefined }));
          }}
        />
      ) : null}
      <Field
        label={t("inventory.detail.wasteQuantity", { unit })}
        value={wasteQuantity}
        onChangeText={(value) => {
          setWasteQuantity(value);
          setFieldErrors((current) => ({ ...current, wasteQuantity: undefined }));
        }}
        editable={editable}
        error={fieldErrors.wasteQuantity}
      />
      <View style={styles.field}>
        <Text style={styles.label}>{t("inventory.detail.wasteNote")}</Text>
        <TextInput
          accessibilityLabel={t("inventory.detail.wasteNote")}
          accessibilityHint={fieldErrors.wasteNote}
          value={wasteNote}
          onChangeText={(value) => {
            setWasteNote(value);
            setFieldErrors((current) => ({ ...current, wasteNote: undefined }));
          }}
          editable={editable}
          multiline
          style={[styles.input, styles.noteInput, fieldErrors.wasteNote && styles.inputError]}
        />
        {fieldErrors.wasteNote ? (
          <Text style={styles.fieldError} accessibilityLiveRegion="polite">
            {fieldErrors.wasteNote}
          </Text>
        ) : null}
      </View>
      <Button
        title={saving ? t("inventory.detail.saving") : t("inventory.detail.recordWasteAction")}
        accessibilityLabel={t("inventory.detail.wasteAccessibility", { item: itemName })}
        icon={<Trash2 size={17} color={colors.surface} strokeWidth={2.5} />}
        onPress={onRecordWaste}
        disabled={!editable}
        fullWidth
        style={styles.saveButton}
      />
    </Card>
  );
}

function TransferStockCard({
  t,
  formatNumber,
  itemName,
  unit,
  locations,
  balanceView,
  balancesUnavailableCopy,
  onRetryBalances,
  fromStorageLocationId,
  toStorageLocationId,
  transferQuantity,
  transferNote,
  newLocationName,
  canManageLocations,
  locationEditable,
  fieldErrors,
  saving,
  editable,
  setFromStorageLocationId,
  setToStorageLocationId,
  setTransferQuantity,
  setTransferNote,
  setNewLocationName,
  setFieldErrors,
  onTransfer,
  onAddLocation
}: {
  t: ReturnType<typeof useLocale>["t"];
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
  itemName: string;
  unit: string;
  locations: StorageLocation[];
  balanceView: ReturnType<typeof reconcileLocationBalancesForDisplay> | null;
  balancesUnavailableCopy: { title: string; message: string } | null;
  onRetryBalances: () => void;
  fromStorageLocationId: string;
  toStorageLocationId: string;
  transferQuantity: string;
  transferNote: string;
  newLocationName: string;
  canManageLocations: boolean;
  locationEditable: boolean;
  fieldErrors: InventoryFieldErrors;
  saving: boolean;
  editable: boolean;
  setFromStorageLocationId: (value: string) => void;
  setToStorageLocationId: (value: string) => void;
  setTransferQuantity: (value: string) => void;
  setTransferNote: (value: string) => void;
  setNewLocationName: (value: string) => void;
  setFieldErrors: Dispatch<SetStateAction<InventoryFieldErrors>>;
  onTransfer: () => void;
  onAddLocation: () => void;
}) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{t("inventory.detail.transfer")}</Text>
      <Text style={styles.copy}>{t("inventory.detail.transferHelp")}</Text>
      {balancesUnavailableCopy ? (
        <RetryNotice
          title={balancesUnavailableCopy.title}
          message={balancesUnavailableCopy.message}
          onRetry={onRetryBalances}
          accessibilityLabel={t("inventory.detail.balances.unavailable.retryAccessibility")}
        />
      ) : balanceView && balanceView.balances.length > 0 ? (
        <View style={styles.balanceList}>
          <Text style={styles.kicker}>{t("inventory.detail.transferBalances")}</Text>
          {balanceView.balances.map((balance) => (
            <Text key={balance.storageLocationId} style={styles.copy}>
              {balance.name}: {formatNumber(balance.quantity, { maximumFractionDigits: 1 })} {unit}
            </Text>
          ))}
          {balanceView.unallocatedQuantity > 0 ? (
            <Text style={styles.copy}>
              {t("inventory.detail.transferUnallocated", {
                quantity: formatNumber(balanceView.unallocatedQuantity, { maximumFractionDigits: 1 }),
                unit
              })}
            </Text>
          ) : null}
        </View>
      ) : null}
      <LocationChooser
        label={t("inventory.detail.transferFrom")}
        locations={locations}
        selectedId={fromStorageLocationId}
        error={fieldErrors.transferFrom}
        disabled={!editable}
        onSelect={(value) => {
          setFromStorageLocationId(value);
          setFieldErrors((current) => ({ ...current, transferFrom: undefined }));
        }}
      />
      <LocationChooser
        label={t("inventory.detail.transferTo")}
        locations={locations.filter((location) => location.id !== fromStorageLocationId)}
        selectedId={toStorageLocationId}
        error={fieldErrors.transferTo}
        disabled={!editable}
        onSelect={(value) => {
          setToStorageLocationId(value);
          setFieldErrors((current) => ({ ...current, transferTo: undefined }));
        }}
      />
      <Field
        label={t("inventory.detail.transferQuantity", { unit })}
        value={transferQuantity}
        onChangeText={(value) => {
          setTransferQuantity(value);
          setFieldErrors((current) => ({ ...current, transferQuantity: undefined }));
        }}
        editable={editable}
        error={fieldErrors.transferQuantity}
      />
      <View style={styles.field}>
        <Text style={styles.label}>{t("inventory.detail.transferNote")}</Text>
        <TextInput
          accessibilityLabel={t("inventory.detail.transferNote")}
          accessibilityHint={fieldErrors.transferNote}
          value={transferNote}
          onChangeText={(value) => {
            setTransferNote(value);
            setFieldErrors((current) => ({ ...current, transferNote: undefined }));
          }}
          editable={editable}
          multiline
          style={[styles.input, styles.noteInput, fieldErrors.transferNote && styles.inputError]}
        />
        {fieldErrors.transferNote ? (
          <Text style={styles.fieldError} accessibilityLiveRegion="polite">
            {fieldErrors.transferNote}
          </Text>
        ) : null}
      </View>
      <Button
        title={saving ? t("inventory.detail.saving") : t("inventory.detail.transferAction")}
        accessibilityLabel={t("inventory.detail.transferAccessibility", { item: itemName })}
        icon={<ArrowLeftRight size={17} color={colors.surface} strokeWidth={2.5} />}
        onPress={onTransfer}
        disabled={!editable || locations.length < 2}
        fullWidth
        style={styles.saveButton}
      />
      {canManageLocations ? (
        <View style={styles.locationCreate}>
          <View style={styles.field}>
            <Text style={styles.label}>{t("inventory.detail.newLocation")}</Text>
            <TextInput
              accessibilityLabel={t("inventory.detail.newLocation")}
              value={newLocationName}
              onChangeText={setNewLocationName}
              editable={locationEditable}
              style={styles.input}
            />
          </View>
          <Button
            title={t("inventory.detail.addLocation")}
            variant="secondary"
            onPress={onAddLocation}
            disabled={!locationEditable || !newLocationName.trim()}
            fullWidth
          />
        </View>
      ) : null}
    </Card>
  );
}

function LocationChooser({
  label,
  locations,
  selectedId,
  error,
  disabled,
  onSelect
}: {
  label: string;
  locations: StorageLocation[];
  selectedId: string;
  error?: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const { t } = useLocale();
  const [locationQuery, setLocationQuery] = useState("");
  const showSearch = locations.length >= STORAGE_LOCATION_CHIP_SEARCH_THRESHOLD;
  const matchedLocations = useMemo(
    () => (showSearch ? filterStorageLocationsBySearch(locations, locationQuery) : locations),
    [locationQuery, locations, showSearch]
  );
  const visibleLocations = useMemo(
    () =>
      showSearch
        ? filterStorageLocationsBySearch(locations, locationQuery, { selectedId })
        : locations,
    [locationQuery, locations, selectedId, showSearch]
  );
  const noMatches = showSearch && locationQuery.trim().length > 0 && matchedLocations.length === 0;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {showSearch ? (
        <View style={styles.locationSearchBox}>
          <Search size={18} color={colors.faint} strokeWidth={2.25} />
          <TextInput
            accessibilityLabel={t("inventory.detail.transferLocationSearch.accessibility", {
              field: label
            })}
            accessibilityHint={t("inventory.detail.transferLocationSearch.hint")}
            value={locationQuery}
            onChangeText={setLocationQuery}
            editable={!disabled}
            placeholder={t("inventory.detail.transferLocationSearch.placeholder")}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            style={styles.locationSearchInput}
          />
        </View>
      ) : null}
      <View style={styles.locationChips}>
        {visibleLocations.map((location) => {
          const selected = location.id === selectedId;
          return (
            <Pressable
              key={location.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={location.name}
              disabled={disabled}
              onPress={() => onSelect(location.id)}
              style={[styles.locationChip, selected && styles.locationChipSelected]}
            >
              <Text style={[styles.locationChipText, selected && styles.locationChipTextSelected]}>
                {location.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {noMatches ? (
        <Text style={styles.locationSearchEmpty} accessibilityLiveRegion="polite">
          {t("inventory.detail.transferLocationSearch.empty")}
        </Text>
      ) : null}
      {error ? <Text style={styles.fieldError} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  editable,
  error
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        accessibilityState={{ disabled: !editable }}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={[styles.input, !editable && styles.inputReadOnly, error && styles.inputError]}
      />
      {error ? <Text style={styles.fieldError} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const movementReasonKeys: Record<InventoryMovementReason, MessageKey> = {
  manual_count: "inventory.detail.movements.manualCount",
  manager_correction: "inventory.detail.movements.managerCorrection",
  receiving: "inventory.detail.movements.receiving",
  waste: "inventory.detail.movements.waste",
  transfer: "inventory.detail.movements.transfer",
  pos_consumption: "inventory.detail.movements.posConsumption",
  recipe_consumption: "inventory.detail.movements.recipeConsumption",
  system_adjustment: "inventory.detail.movements.systemAdjustment"
};

function movementReasonLabel(t: ReturnType<typeof useLocale>["t"], reason: InventoryMovementReason) {
  return t(movementReasonKeys[reason] ?? "inventory.detail.movements.systemAdjustment");
}

function movementNoteText(metadata: InventoryMovement["metadata"] | null | undefined) {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];
  const station = record.storage_location_name;
  if (typeof station === "string" && station.trim()) {
    parts.push(station.trim());
  }
  const note = record.note;
  if (typeof note === "string" && note.trim()) {
    parts.push(note.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function validateInventoryNumber(
  value: string,
  label: string,
  parseNumber: ReturnType<typeof useLocale>["parseNumber"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  if (!value.trim()) return t("inventory.detail.fieldRequired", { field: label });
  const parsed = parseNumber(value);
  if (parsed === null || parsed < 0 || parsed > operatingLimits.inventoryQuantity) {
    return t("inventory.detail.fieldRange", {
      field: label,
      maximum: formatNumber(operatingLimits.inventoryQuantity)
    });
  }
  return undefined;
}

function validateWasteQuantity(
  value: string,
  label: string,
  parseNumber: ReturnType<typeof useLocale>["parseNumber"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  if (!value.trim()) return t("inventory.detail.fieldRequired", { field: label });
  const parsed = parseNumber(value);
  if (parsed === null || parsed <= 0 || parsed > operatingLimits.inventoryQuantity) {
    return t("inventory.detail.wasteFieldRange", {
      field: label,
      maximum: formatNumber(operatingLimits.inventoryQuantity)
    });
  }
  return undefined;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  balanceList: {
    gap: 4,
    marginBottom: 10
  },
  locationChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  locationSearchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  locationSearchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 0
  },
  locationSearchEmpty: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6
  },
  locationChip: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center"
  },
  locationChipSelected: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentSoft ?? colors.surface
  },
  locationChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  locationChipTextSelected: {
    color: colors.accentDark
  },
  locationCreate: {
    gap: 10,
    marginTop: 8
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14
  },
  countRail: {
    flexDirection: "row",
    gap: 10,
    marginTop: 0
  },
  countBlock: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12
  },
  countLabel: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  countValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5
  },
  depletionValue: {
    color: colors.accentDark
  },
  depletionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 12
  },
  depletionText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  coverageBox: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: 12,
    padding: 12,
    marginTop: 16
  },
  kicker: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  coverage: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
    marginTop: 5
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14
  },
  flushTitle: {
    marginBottom: 0
  },
  factGrid: {
    flexDirection: "row",
    gap: 10
  },
  fact: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.background
  },
  factValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  factLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  },
  recommendationBox: {
    borderRadius: 12,
    backgroundColor: colors.surfaceWarm,
    padding: 12,
    marginTop: 12
  },
  recommendation: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 5
  },
  addButton: {
    marginTop: 14
  },
  field: {
    marginBottom: 14
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  noteInput: {
    minHeight: 84,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    textAlignVertical: "top"
  },
  inputReadOnly: {
    color: colors.muted,
    backgroundColor: colors.surfaceWarm
  },
  inputError: {
    borderColor: colors.danger
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5
  },
  saveButton: {
    marginTop: 2
  },
  movementList: {
    gap: 10,
    marginTop: 4
  },
  movementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  movementCopy: {
    flex: 1,
    gap: 3
  },
  movementReason: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  movementDelta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  movementNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 2
  },
  movementWhen: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    maxWidth: 96
  },
  message: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12
  }
});
