import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import {
  ArrowDownRight,
  ArrowLeft,
  ClipboardList,
  PackageCheck,
  Save
} from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { FilterRow, type SegmentOption } from "../../components/ui/SegmentedControl";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, inventoryStatusColors, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import type { InventoryOutboxEntry } from "../../services/domain/inventoryOutbox";
import {
  addInventoryItemToOrder,
  createStorageLocation,
  fetchInventoryItemOutlook,
  fetchInventoryLocationBalances,
  fetchQueuedInventoryEvents,
  fetchStorageLocations,
  flushQueuedInventoryEvents,
  queueInventoryOperation,
  transferInventory,
  updateInventoryItem
} from "../../services/miseService";
import { reconcileLocationBalancesForDisplay } from "../../services/domain/inventoryTransfer";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import {
  canManageRestaurantData,
  canManageStorageLocations,
  canTransferInventory
} from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";
import type {
  InventoryItem,
  InventoryLocationBalance,
  InventoryOutlookItem,
  StorageLocation
} from "../../types/mise";
import { statusTone } from "../../utils/inventory";

type InventoryOperatorAction = "count" | "receipt" | "waste" | "stockout";

export default function InventoryDetailScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { memberships, restaurant } = useMiseSession();
  const [outlook, setOutlook] = useState<InventoryOutlookItem | null>(null);
  const [queueEntries, setQueueEntries] = useState<InventoryOutboxEntry[]>([]);
  const [operation, setOperation] = useState<InventoryOperatorAction>("count");
  const [quantityText, setQuantityText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [quantityError, setQuantityError] = useState<string | undefined>();
  const [settingErrors, setSettingErrors] = useState<InventorySettingErrors>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [submittingOperation, setSubmittingOperation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [hubLoadError, setHubLoadError] = useState(false);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [locationBalances, setLocationBalances] = useState<InventoryLocationBalance[]>([]);
  const [fromStorageLocationId, setFromStorageLocationId] = useState("");
  const [toStorageLocationId, setToStorageLocationId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [transferErrors, setTransferErrors] = useState<TransferFieldErrors>({});
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const load = useCallback(async () => {
    if (!restaurant || !id) {
      setLoading(false);
      setMessage(t("inventory.detail.noWorkspace"));
      setMessageIsError(true);
      return;
    }
    const restaurantId = restaurant.id;
    const itemId = id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setMessage(null);
    setMessageIsError(false);
    setHubLoadError(false);
    try {
      const [nextOutlook, nextQueue, nextLocations, nextBalances] = await Promise.all([
        fetchInventoryItemOutlook(restaurantId, itemId),
        fetchQueuedInventoryEvents(restaurantId),
        fetchStorageLocations(restaurantId),
        fetchInventoryLocationBalances(restaurantId, itemId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlook(nextOutlook);
      setQueueEntries(nextQueue.filter((entry) => entry.event.inventoryItemId === itemId));
      setStorageLocations(nextLocations);
      setLocationBalances(nextBalances);
      const main =
        nextLocations.find((location) => location.name.toLowerCase() === "main") ?? nextLocations[0];
      const secondary =
        nextLocations.find((location) => location.id !== main?.id) ?? nextLocations[1] ?? null;
      setFromStorageLocationId((current) =>
        current && nextLocations.some((location) => location.id === current)
          ? current
          : main?.id ?? ""
      );
      setToStorageLocationId((current) =>
        current &&
        nextLocations.some((location) => location.id === current) &&
        current !== (main?.id ?? "")
          ? current
          : secondary?.id ?? ""
      );
      setLoadedRestaurantId(restaurantId);
      setHubLoadError(false);
      if (nextOutlook) {
        setParLevel(
          formatNumber(nextOutlook.item.par_level, { maximumFractionDigits: 2, useGrouping: false })
        );
        setReorderThreshold(
          formatNumber(nextOutlook.item.reorder_threshold, {
            maximumFractionDigits: 2,
            useGrouping: false
          })
        );
        setSettingErrors({});
      }
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlook(null);
      setQueueEntries([]);
      setStorageLocations([]);
      setLocationBalances([]);
      setHubLoadError(true);
      setMessage(t("inventory.detail.loadError"));
      setMessageIsError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [formatNumber, id, restaurant?.id, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setHubLoadError(false);
    setOutlook(null);
    setQueueEntries([]);
    setStorageLocations([]);
    setLocationBalances([]);
    setFromStorageLocationId("");
    setToStorageLocationId("");
    setTransferQuantity("");
    setTransferNote("");
    setNewLocationName("");
    setTransferErrors({});
    setSubmittingTransfer(false);
    setAddingLocation(false);
    setOperation("count");
    setQuantityText("");
    setNoteText("");
    setParLevel("");
    setReorderThreshold("");
    setQuantityError(undefined);
    setSettingErrors({});
    setSavingSettings(false);
    setSubmittingOperation(false);
    setMessage(null);
    setMessageIsError(false);
    setLoading(Boolean(restaurant && id));
    void load();
  }, [id, load, restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canTransfer = canTransferInventory(memberships, restaurant?.id);
  const canManageLocations = canManageStorageLocations(memberships, restaurant?.id);
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: hubLoadError
  });
  const hubReady = hubLoadState === "ready";
  const mutationAllowed = canManage && hubReady;
  const transferAllowed = canTransfer && hubReady;
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: submittingOperation || savingSettings || submittingTransfer || addingLocation
  });
  const transferEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canTransfer,
    hubReady,
    busy: submittingTransfer || addingLocation
  });
  const visibleOutlook = hubReady ? outlook : null;
  const visibleQueue = hubReady ? queueEntries : [];
  const item = visibleOutlook?.item ?? null;
  const balanceView =
    item &&
    reconcileLocationBalancesForDisplay({
      onHandQuantity: item.current_quantity,
      balances: locationBalances.map((balance) => {
        const location = storageLocations.find((entry) => entry.id === balance.storage_location_id);
        return {
          storageLocationId: balance.storage_location_id,
          name: location?.name ?? balance.storage_location_id,
          quantity: balance.quantity
        };
      })
    });
  const prediction = visibleOutlook?.prediction ?? null;
  const localizedPrediction =
    item && prediction ? localizeInventoryPrediction(t, formatNumber, item, prediction) : null;
  const status = prediction?.projectedStatus ?? null;
  const canonicalReady = item ? isCanonicalUnitReady(item) : false;
  const canonicalUnit = canonicalReady ? item!.canonical_unit! : null;

  const operationOptions = useMemo<readonly SegmentOption<InventoryOperatorAction>[]>(
    () => [
      {
        value: "count",
        label: t("inventory.ops.action.count"),
        accessibilityLabel: t("inventory.ops.action.countAccessibility")
      },
      {
        value: "receipt",
        label: t("inventory.ops.action.receive"),
        accessibilityLabel: t("inventory.ops.action.receiveAccessibility")
      },
      {
        value: "waste",
        label: t("inventory.ops.action.waste"),
        accessibilityLabel: t("inventory.ops.action.wasteAccessibility")
      },
      {
        value: "stockout",
        label: t("inventory.ops.action.stockout"),
        accessibilityLabel: t("inventory.ops.action.stockoutAccessibility")
      }
    ],
    [t]
  );


  async function submitTransfer() {
    if (!restaurant || !item || !transferEditable) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }
    const quantityError =
      !transferQuantity.trim()
        ? t("inventory.detail.fieldRequired", { field: t("inventory.detail.transferQuantity", { unit: item.unit }) })
        : validateTransferQuantity(transferQuantity, parseNumber, formatNumber, t);
    const nextErrors: TransferFieldErrors = {
      transferQuantity: quantityError,
      transferFrom: !fromStorageLocationId
        ? t("inventory.detail.fieldRequired", { field: t("inventory.detail.transferFrom") })
        : undefined,
      transferTo: !toStorageLocationId
        ? t("inventory.detail.fieldRequired", { field: t("inventory.detail.transferTo") })
        : undefined,
      transferNote:
        transferNote.trim().length > 240 ? t("inventory.detail.transferNoteTooLong") : undefined
    };
    if (
      nextErrors.transferQuantity ||
      nextErrors.transferFrom ||
      nextErrors.transferTo ||
      nextErrors.transferNote
    ) {
      setTransferErrors(nextErrors);
      setMessage(t("inventory.detail.reviewTransfer"));
      setMessageIsError(true);
      return;
    }
    const restaurantId = restaurant.id;
    setTransferErrors({});
    setSubmittingTransfer(true);
    setMessage(null);
    setMessageIsError(false);
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
      setMessage(t("inventory.detail.transferRecorded"));
      setMessageIsError(false);
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.transferError"));
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSubmittingTransfer(false);
    }
  }

  async function addLocation() {
    if (!restaurant || !canManageLocations || !hubReady) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }
    const name = newLocationName.trim();
    if (!name) {
      setTransferErrors((current) => ({
        ...current,
        newLocation: t("inventory.detail.fieldRequired", { field: t("inventory.detail.newLocation") })
      }));
      setMessage(t("inventory.detail.reviewTransfer"));
      setMessageIsError(true);
      return;
    }
    const restaurantId = restaurant.id;
    setAddingLocation(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      const created = await createStorageLocation(restaurantId, name);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setNewLocationName("");
      setTransferErrors((current) => ({ ...current, newLocation: undefined }));
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setToStorageLocationId(created.id);
      setMessage(t("inventory.detail.locationAdded"));
      setMessageIsError(false);
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.locationError"));
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setAddingLocation(false);
    }
  }

  function goBackToInventory() {

    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/inventory");
  }

  async function submitOperation() {
    if (!restaurant || !item) return;
    if (!actionsEditable) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }
    if (!isCanonicalUnitReady(item)) {
      setMessage(t("inventory.ops.unverified.body"));
      setMessageIsError(true);
      return;
    }

    const quantity = operation === "stockout" ? 0 : parseNumber(quantityText);
    const nextQuantityError =
      operation === "stockout"
        ? undefined
        : validateOperationQuantity(quantityText, operation, parseNumber, formatNumber, t);
    if (nextQuantityError || quantity === null) {
      setQuantityError(nextQuantityError ?? t("inventory.ops.quantityInvalid"));
      setMessage(t("inventory.ops.reviewQuantity"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setQuantityError(undefined);
    setSubmittingOperation(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await queueInventoryOperation({
        restaurantId,
        inventoryItemId: item.id,
        eventType: operation,
        quantity,
        canonicalUnit: item.canonical_unit,
        effectiveAt: new Date().toISOString(),
        note: noteText.trim() || undefined
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;

      const flushSummary = await flushQueuedInventoryEvents(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;

      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;

      setQuantityText(operation === "stockout" ? "0" : "");
      setNoteText("");
      setMessage(describeFlushResult(flushSummary, t));
      setMessageIsError(flushSummary.conflicted > 0 || flushSummary.rejected > 0);
    } catch (submitError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message.slice(0, 220)
          : t("inventory.ops.submitError")
      );
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSubmittingOperation(false);
    }
  }

  async function saveSettings() {
    if (!restaurant || !item) return;
    if (!actionsEditable) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }

    const nextSettingErrors: InventorySettingErrors = {
      parLevel: validateInventoryNumber(
        parLevel,
        t("inventory.detail.field.parLevel"),
        parseNumber,
        formatNumber,
        t
      ),
      reorderThreshold: validateInventoryNumber(
        reorderThreshold,
        t("inventory.detail.field.reorderThreshold"),
        parseNumber,
        formatNumber,
        t
      )
    };
    if (Object.values(nextSettingErrors).some(Boolean)) {
      setSettingErrors(nextSettingErrors);
      setMessage(t("inventory.detail.reviewFields"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSettingErrors({});
    setSavingSettings(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await updateInventoryItem(restaurantId, item.id, {
        par_level: parseNumber(parLevel) ?? 0,
        reorder_threshold: parseNumber(reorderThreshold) ?? 0
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.settingsUpdated"));
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setMessage(t("inventory.detail.settingsSaveError"));
        setMessageIsError(true);
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingSettings(false);
    }
  }

  async function addToOrder() {
    if (!restaurant || !item) return;
    if (!actionsEditable) {
      setMessage(t("inventory.detail.viewOnlyOrdering"));
      setMessageIsError(true);
      return;
    }
    const restaurantId = restaurant.id;
    setSavingSettings(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await addInventoryItemToOrder(restaurantId, item.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.added"));
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setMessage(t("inventory.detail.addError"));
        setMessageIsError(true);
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSavingSettings(false);
    }
  }

  const busy = submittingOperation || savingSettings || submittingTransfer || addingLocation;

  return (
    <Screen
      title={item?.item_name ?? t("inventory.detail.title")}
      subtitle={item ? `${item.supplier_name} · ${item.category}` : t("inventory.detail.subtitle")}
      loading={loading}
      keyboardAware
      action={
        <ActionIcon accessibilityLabel={t("inventory.detail.back")} onPress={goBackToInventory}>
          <ArrowLeft size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
        </ActionIcon>
      }
    >
      {item && status && prediction && localizedPrediction ? (
        <View style={styles.stack}>
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
            icon={<PackageCheck size={icon.emphasis} color={inventoryStatusColors[status]} strokeWidth={iconStroke} />}
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
              {
                label: t("inventory.detail.lastCount"),
                value: `${formatNumber(item.current_quantity, { maximumFractionDigits: 1 })} ${item.unit}`,
                tone: "neutral"
              },
              {
                label: t("inventory.detail.posUsed"),
                value: `${formatNumber(prediction.todayDepletion, { maximumFractionDigits: 1 })} ${item.unit}`,
                tone: "neutral"
              }
            ]}
          />

          {!canManage && !canTransfer ? (
            <StatusNotice
              title={t("inventory.detail.viewOnly.title")}
              message={t("inventory.detail.viewOnly.body")}
            />
          ) : null}

          {message ? (
            <Text
              style={[styles.message, messageIsError && styles.error]}
              accessibilityLiveRegion="polite"
            >
              {message}
            </Text>
          ) : null}

          <Card>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, styles.flushTitle]}>{t("inventory.detail.stockEvidence")}</Text>
              <Badge label={localizedPrediction.status} tone={statusTone(status)} />
            </View>
            <View style={styles.countRail}>
              <View style={styles.countBlock}>
                <Text style={styles.countLabel}>{t("inventory.detail.lastCount")}</Text>
                <Text style={styles.countValue}>
                  {formatNumber(item.current_quantity, { maximumFractionDigits: 1 })} {item.unit}
                </Text>
              </View>
              <View style={styles.countBlock}>
                <Text style={styles.countLabel}>{t("inventory.detail.posDepleted")}</Text>
                <Text style={[styles.countValue, prediction.todayDepletion > 0 && styles.depletionValue]}>
                  {prediction.todayDepletion > 0 ? "-" : ""}
                  {formatNumber(prediction.todayDepletion, { maximumFractionDigits: 1 })} {item.unit}
                </Text>
              </View>
            </View>
            {prediction.todayDepletion > 0 ? (
              <View style={styles.depletionRow}>
                <ArrowDownRight size={icon.inline} color={colors.accentDark} strokeWidth={iconStroke} />
                <Text style={styles.depletionText}>{localizedPrediction.depletion}</Text>
              </View>
            ) : null}
            <View style={styles.coverageBox}>
              <Text style={styles.kicker}>{t("inventory.detail.predictedCoverage")}</Text>
              <Text style={styles.coverage}>{localizedPrediction.coverage}</Text>
              <Text style={styles.copy}>
                {localizedPrediction.basis}. {localizedPrediction.confidence}
              </Text>
            </View>
          </Card>

          {transferAllowed ? (
            <Card>
              <Text style={styles.cardTitle}>{t("inventory.detail.transfer")}</Text>
              <Text style={styles.copy}>{t("inventory.detail.transferHelp")}</Text>
              {balanceView && balanceView.balances.length > 0 ? (
                <View style={styles.balanceList}>
                  <Text style={styles.kicker}>{t("inventory.detail.transferBalances")}</Text>
                  {balanceView.balances.map((balance) => (
                    <Text key={balance.storageLocationId} style={styles.copy}>
                      {balance.name}:{" "}
                      {formatNumber(balance.quantity, { maximumFractionDigits: 1 })} {item.unit}
                    </Text>
                  ))}
                  {balanceView.unallocatedQuantity > 0 ? (
                    <Text style={styles.copy}>
                      {t("inventory.detail.transferUnallocated", {
                        quantity: formatNumber(balanceView.unallocatedQuantity, {
                          maximumFractionDigits: 1
                        }),
                        unit: item.unit
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.label}>{t("inventory.detail.transferFrom")}</Text>
              <FilterRow
                accessibilityLabel={t("inventory.detail.locationChooser")}
                options={storageLocations.map((location) => ({
                  value: location.id,
                  label: location.name
                }))}
                value={fromStorageLocationId}
                onValueChange={(value) => {
                  setFromStorageLocationId(value);
                  setTransferErrors((current) => ({ ...current, transferFrom: undefined }));
                }}
              />
              {transferErrors.transferFrom ? (
                <Text style={styles.fieldError}>{transferErrors.transferFrom}</Text>
              ) : null}
              <Text style={styles.label}>{t("inventory.detail.transferTo")}</Text>
              <FilterRow
                accessibilityLabel={t("inventory.detail.locationChooser")}
                options={storageLocations
                  .filter((location) => location.id !== fromStorageLocationId)
                  .map((location) => ({
                    value: location.id,
                    label: location.name
                  }))}
                value={toStorageLocationId}
                onValueChange={(value) => {
                  setToStorageLocationId(value);
                  setTransferErrors((current) => ({ ...current, transferTo: undefined }));
                }}
              />
              {transferErrors.transferTo ? (
                <Text style={styles.fieldError}>{transferErrors.transferTo}</Text>
              ) : null}
              <Text style={styles.label}>
                {t("inventory.detail.transferQuantity", { unit: item.unit })}
              </Text>
              <TextInput
                accessibilityLabel={t("inventory.detail.transferQuantity", { unit: item.unit })}
                value={transferQuantity}
                onChangeText={(value) => {
                  setTransferQuantity(value);
                  setTransferErrors((current) => ({ ...current, transferQuantity: undefined }));
                }}
                editable={transferEditable}
                keyboardType="decimal-pad"
                style={[styles.input, transferErrors.transferQuantity && styles.inputError]}
              />
              {transferErrors.transferQuantity ? (
                <Text style={styles.fieldError}>{transferErrors.transferQuantity}</Text>
              ) : null}
              <Text style={styles.label}>{t("inventory.detail.transferNote")}</Text>
              <TextInput
                accessibilityLabel={t("inventory.detail.transferNote")}
                value={transferNote}
                onChangeText={(value) => {
                  setTransferNote(value);
                  setTransferErrors((current) => ({ ...current, transferNote: undefined }));
                }}
                editable={transferEditable}
                multiline
                style={[styles.input, styles.noteInput, transferErrors.transferNote && styles.inputError]}
              />
              {transferErrors.transferNote ? (
                <Text style={styles.fieldError}>{transferErrors.transferNote}</Text>
              ) : null}
              <Button
                title={
                  submittingTransfer
                    ? t("inventory.detail.transferring")
                    : t("inventory.detail.transferAction")
                }
                onPress={() => void submitTransfer()}
                disabled={!transferEditable || !canonicalReady}
                fullWidth
                style={styles.addButton}
              />
              {canManageLocations ? (
                <View style={styles.locationCreate}>
                  <Text style={styles.label}>{t("inventory.detail.newLocation")}</Text>
                  <TextInput
                    accessibilityLabel={t("inventory.detail.newLocation")}
                    value={newLocationName}
                    onChangeText={(value) => {
                      setNewLocationName(value);
                      setTransferErrors((current) => ({ ...current, newLocation: undefined }));
                    }}
                    editable={!addingLocation}
                    style={[styles.input, transferErrors.newLocation && styles.inputError]}
                  />
                  {transferErrors.newLocation ? (
                    <Text style={styles.fieldError}>{transferErrors.newLocation}</Text>
                  ) : null}
                  <Button
                    title={
                      addingLocation
                        ? t("inventory.detail.addingLocation")
                        : t("inventory.detail.addLocation")
                    }
                    variant="secondary"
                    onPress={() => void addLocation()}
                    disabled={addingLocation || !hubReady}
                    fullWidth
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.detail.recentUsage")}</Text>
            <View style={styles.factGrid}>
              <View style={styles.fact}>
                <Text style={styles.factValue}>
                  {formatNumber(prediction.averageDailyUsage, { maximumFractionDigits: 1 })}
                </Text>
                <Text style={styles.factLabel}>{t("inventory.detail.perDay", { unit: item.unit })}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factValue}>
                  {prediction.daysCoverage === null
                    ? "—"
                    : formatNumber(prediction.daysCoverage, { maximumFractionDigits: 1 })}
                </Text>
                <Text style={styles.factLabel}>{t("inventory.detail.daysCoverage")}</Text>
              </View>
            </View>
            <View style={styles.recommendationBox}>
              <Text style={styles.kicker}>{t("inventory.detail.recommendation")}</Text>
              <Text style={styles.recommendation}>{localizedPrediction.recommendation}</Text>
              <Text style={styles.copy}>{localizedPrediction.whyItMatters}</Text>
            </View>
            {mutationAllowed ? (
              <Button
                title={t("inventory.detail.addToOrder")}
                accessibilityLabel={t("inventory.detail.addAccessibility", { item: item.item_name })}
                variant="secondary"
                icon={<ClipboardList size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => void addToOrder()}
                disabled={!actionsEditable || busy}
                fullWidth
                style={styles.addButton}
              />
            ) : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.ops.title")}</Text>
            <Text style={styles.opsBody}>{t("inventory.ops.body")}</Text>
            {!canonicalReady ? (
              <StatusNotice
                tone="warning"
                title={t("inventory.ops.unverified.title")}
                message={t("inventory.ops.unverified.body")}
              />
            ) : (
              <>
                <Text style={styles.canonicalMeta}>
                  {t("inventory.ops.canonicalUnit", {
                    unit: t(`inventory.ops.unit.${canonicalUnit}` as "inventory.ops.unit.g")
                  })}
                </Text>
                {mutationAllowed ? (
                  <>
                    <FilterRow
                      accessibilityLabel={t("inventory.ops.action.accessibility")}
                      options={operationOptions}
                      value={operation}
                      onValueChange={(value) => {
                        setOperation(value);
                        setQuantityError(undefined);
                        if (value === "stockout") setQuantityText("0");
                      }}
                    />
                    {operation === "stockout" ? (
                      <StatusNotice
                        tone="caution"
                        title={t("inventory.ops.stockoutNotice.title")}
                        message={t("inventory.ops.stockoutNotice.body")}
                      />
                    ) : (
                      <Field
                        label={t("inventory.ops.quantity", {
                          unit: t(`inventory.ops.unit.${canonicalUnit}` as "inventory.ops.unit.g")
                        })}
                        value={quantityText}
                        onChangeText={(value) => {
                          setQuantityText(value);
                          setQuantityError(undefined);
                        }}
                        editable={actionsEditable && !busy}
                        error={quantityError}
                      />
                    )}
                    <Field
                      label={t("inventory.ops.note")}
                      value={noteText}
                      onChangeText={setNoteText}
                      editable={actionsEditable && !busy}
                      keyboardType="default"
                    />
                    <Button
                      title={
                        submittingOperation ? t("inventory.ops.submitting") : t("inventory.ops.submit")
                      }
                      accessibilityHint={t("inventory.ops.submitHint")}
                      onPress={() => void submitOperation()}
                      disabled={!actionsEditable || busy}
                      fullWidth
                      style={styles.saveButton}
                    />
                  </>
                ) : null}
              </>
            )}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.ops.queue.title")}</Text>
            {visibleQueue.length === 0 ? (
              <Text style={styles.copy}>{t("inventory.ops.queue.empty")}</Text>
            ) : (
              <View style={styles.queueList}>
                {visibleQueue.map((entry) => (
                  <QueueEvidenceRow key={entry.id} entry={entry} formatNumber={formatNumber} t={t} />
                ))}
              </View>
            )}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>
              {canManage ? t("inventory.detail.parSettings") : t("inventory.detail.countSettings")}
            </Text>
            <Field
              label={t("inventory.detail.parLevel", { unit: item.unit })}
              value={parLevel}
              onChangeText={(value) => {
                setParLevel(value);
                setSettingErrors((current) => ({ ...current, parLevel: undefined }));
              }}
              editable={actionsEditable && !busy}
              error={settingErrors.parLevel}
            />
            <Field
              label={t("inventory.detail.reorderThreshold", { unit: item.unit })}
              value={reorderThreshold}
              onChangeText={(value) => {
                setReorderThreshold(value);
                setSettingErrors((current) => ({ ...current, reorderThreshold: undefined }));
              }}
              editable={actionsEditable && !busy}
              error={settingErrors.reorderThreshold}
            />
            {mutationAllowed ? (
              <Button
                title={savingSettings ? t("inventory.detail.saving") : t("inventory.detail.saveSettings")}
                icon={<Save size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
                onPress={() => void saveSettings()}
                disabled={!actionsEditable || busy}
                fullWidth
                style={styles.saveButton}
              />
            ) : null}
          </Card>
        </View>
      ) : (
        <Text style={[styles.message, messageIsError && styles.error]}>
          {message ?? t("inventory.detail.notFound")}
        </Text>
      )}
    </Screen>
  );
}

function QueueEvidenceRow({
  entry,
  formatNumber,
  t
}: {
  entry: InventoryOutboxEntry;
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
  t: ReturnType<typeof useLocale>["t"];
}) {
  const tone = queueTone(entry);
  const statusKey = queueStatusKey(entry);
  const statusLabel = t(`inventory.ops.queue.status.${statusKey}` as "inventory.ops.queue.status.pending");
  return (
    <View
      style={styles.queueRow}
      accessible
      accessibilityLabel={t("inventory.ops.queue.rowAccessibility", {
        action: t(`inventory.ops.event.${entry.event.eventType}` as "inventory.ops.event.count"),
        status: statusLabel,
        quantity: formatNumber(entry.event.quantity, { maximumFractionDigits: 2 })
      })}
    >
      <View style={styles.queueCopy}>
        <Text style={styles.queueTitle}>
          {t(`inventory.ops.event.${entry.event.eventType}` as "inventory.ops.event.count")} ·{" "}
          {formatNumber(entry.event.quantity, { maximumFractionDigits: 2 })}{" "}
          {t(`inventory.ops.unit.${entry.event.canonicalUnit}` as "inventory.ops.unit.g")}
        </Text>
        <Text style={styles.queueMeta}>
          {entry.resolutionReason
            ? t("inventory.ops.queue.reason", { reason: entry.resolutionReason })
            : t("inventory.ops.queue.attempts", { count: formatNumber(entry.attemptCount) })}
        </Text>
      </View>
      <Badge label={statusLabel} tone={tone} />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  editable,
  error,
  keyboardType = "decimal-pad"
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  error?: string;
  keyboardType?: "decimal-pad" | "default";
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
        keyboardType={keyboardType}
        selectTextOnFocus={keyboardType === "decimal-pad"}
        style={[styles.input, !editable && styles.inputReadOnly, error && styles.inputError]}
      />
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface InventorySettingErrors {
  parLevel?: string;
  reorderThreshold?: string;
}


type TransferFieldErrors = {
  transferQuantity?: string;
  transferFrom?: string;
  transferTo?: string;
  transferNote?: string;
  newLocation?: string;
};

function validateTransferQuantity(
  value: string,
  parseNumber: ReturnType<typeof useLocale>["parseNumber"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  const parsed = parseNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) {
    return t("inventory.ops.quantityPositive", {
      maximum: formatNumber(operatingLimits.inventoryQuantity)
    });
  }
  if (parsed > operatingLimits.inventoryQuantity) {
    return t("inventory.ops.quantityPositive", {
      maximum: formatNumber(operatingLimits.inventoryQuantity)
    });
  }
  return undefined;
}

function isCanonicalUnitReady(item: InventoryItem) {
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each")
  );
}

function queueStatusKey(entry: InventoryOutboxEntry) {
  if (entry.status === "pending" && entry.resolutionReason === "network_retry") return "retryable";
  return entry.status;
}

function queueTone(
  entry: InventoryOutboxEntry
): "neutral" | "success" | "caution" | "warning" | "danger" {
  const key = queueStatusKey(entry);
  if (key === "accepted") return "success";
  if (key === "submitting") return "caution";
  if (key === "retryable" || key === "pending") return "warning";
  if (key === "conflict" || key === "rejected") return "danger";
  return "neutral";
}

function describeFlushResult(
  summary: {
    considered: number;
    accepted: number;
    conflicted: number;
    rejected: number;
    deferred: number;
  },
  t: ReturnType<typeof useLocale>["t"]
) {
  if (summary.conflicted > 0) return t("inventory.ops.result.conflict");
  if (summary.rejected > 0) return t("inventory.ops.result.rejected");
  if (summary.deferred > 0) return t("inventory.ops.result.deferred");
  if (summary.accepted > 0) return t("inventory.ops.result.accepted");
  return t("inventory.ops.result.queued");
}

function validateOperationQuantity(
  value: string,
  operation: InventoryOperatorAction,
  parseNumber: ReturnType<typeof useLocale>["parseNumber"],
  formatNumber: ReturnType<typeof useLocale>["formatNumber"],
  t: ReturnType<typeof useLocale>["t"]
) {
  if (!value.trim()) {
    return t("inventory.detail.fieldRequired", { field: t("inventory.ops.quantityLabel") });
  }
  const parsed = parseNumber(value);
  if (parsed === null || !Number.isFinite(parsed)) return t("inventory.ops.quantityInvalid");
  if (operation === "count") {
    if (parsed < 0 || parsed > operatingLimits.inventoryQuantity) {
      return t("inventory.detail.fieldRange", {
        field: t("inventory.ops.quantityLabel"),
        maximum: formatNumber(operatingLimits.inventoryQuantity)
      });
    }
    return undefined;
  }
  if (parsed <= 0 || parsed > operatingLimits.inventoryQuantity) {
    return t("inventory.ops.quantityPositive", {
      maximum: formatNumber(operatingLimits.inventoryQuantity)
    });
  }
  return undefined;
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

const styles = StyleSheet.create({
  stack: { gap: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14
  },
  countRail: { flexDirection: "row", gap: 10, marginTop: 0 },
  countBlock: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  countLabel: {
    color: colors.faint,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  countValue: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 6 },
  depletionValue: { color: colors.accentDark },
  depletionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 14 },
  depletionText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  coverageBox: { backgroundColor: colors.surfaceWarm, borderRadius: 14, padding: 14, marginTop: 16 },
  kicker: { color: colors.faint, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  coverage: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700", marginTop: 6 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  opsBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: -6,
    marginBottom: 14
  },
  canonicalMeta: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 14
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 14 },
  flushTitle: { marginBottom: 0 },
  factGrid: { flexDirection: "row", gap: 10 },
  fact: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.surface
  },
  factValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
  factLabel: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  recommendationBox: {
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    padding: 14,
    marginTop: 12
  },
  recommendation: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 5
  },
  balanceList: {
    gap: 4,
    marginBottom: 8
  },
  locationCreate: {
    gap: 8,
    marginTop: 12
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  addButton: { marginTop: 14 },
  field: { marginBottom: 14 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  inputReadOnly: { color: colors.muted, backgroundColor: colors.surfaceWarm },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 5 },
  saveButton: { marginTop: 2 },
  queueList: { gap: 10 },
  queueRow: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  queueCopy: { flex: 1, minWidth: 0, gap: 3 },
  queueTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  queueMeta: { color: colors.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  message: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  error: { color: colors.danger }
});
