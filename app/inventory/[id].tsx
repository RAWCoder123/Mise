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
import { colors, inventoryStatusColors, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import type { InventoryOutboxEntry } from "../../services/domain/inventoryOutbox";
import {
  addInventoryItemToOrder,
  fetchInventoryItemOutlook,
  fetchQueuedInventoryEvents,
  flushQueuedInventoryEvents,
  queueInventoryOperation,
  updateInventoryItem
} from "../../services/miseService";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";
import type { InventoryItem, InventoryOutlookItem } from "../../types/mise";
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
    try {
      const [nextOutlook, nextQueue] = await Promise.all([
        fetchInventoryItemOutlook(restaurantId, itemId),
        fetchQueuedInventoryEvents(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlook(nextOutlook);
      setQueueEntries(nextQueue.filter((entry) => entry.event.inventoryItemId === itemId));
      setLoadedRestaurantId(restaurantId);
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
    setOutlook(null);
    setQueueEntries([]);
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

  const visibleOutlook = loadedRestaurantId === restaurant?.id ? outlook : null;
  const visibleQueue = loadedRestaurantId === restaurant?.id ? queueEntries : [];
  const item = visibleOutlook?.item ?? null;
  const prediction = visibleOutlook?.prediction ?? null;
  const localizedPrediction =
    item && prediction ? localizeInventoryPrediction(t, formatNumber, item, prediction) : null;
  const status = prediction?.projectedStatus ?? null;
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
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

  function goBackToInventory() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/inventory");
  }

  async function submitOperation() {
    if (!restaurant || !item) return;
    if (!canManage) {
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
    if (!canManage) {
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
    if (!canManage) {
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

  const busy = submittingOperation || savingSettings;

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

          {!canManage ? (
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
                <ArrowDownRight size={16} color={colors.accentDark} strokeWidth={2.5} />
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
            {canManage ? (
              <Button
                title={t("inventory.detail.addToOrder")}
                accessibilityLabel={t("inventory.detail.addAccessibility", { item: item.item_name })}
                variant="secondary"
                icon={<ClipboardList size={17} color={colors.text} strokeWidth={2.5} />}
                onPress={() => void addToOrder()}
                disabled={busy}
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
                {canManage ? (
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
                        editable={!busy}
                        error={quantityError}
                      />
                    )}
                    <Field
                      label={t("inventory.ops.note")}
                      value={noteText}
                      onChangeText={setNoteText}
                      editable={!busy}
                      keyboardType="default"
                    />
                    <Button
                      title={
                        submittingOperation ? t("inventory.ops.submitting") : t("inventory.ops.submit")
                      }
                      accessibilityHint={t("inventory.ops.submitHint")}
                      onPress={() => void submitOperation()}
                      disabled={busy}
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
              editable={canManage && !busy}
              error={settingErrors.parLevel}
            />
            <Field
              label={t("inventory.detail.reorderThreshold", { unit: item.unit })}
              value={reorderThreshold}
              onChangeText={(value) => {
                setReorderThreshold(value);
                setSettingErrors((current) => ({ ...current, reorderThreshold: undefined }));
              }}
              editable={canManage && !busy}
              error={settingErrors.reorderThreshold}
            />
            {canManage ? (
              <Button
                title={savingSettings ? t("inventory.detail.saving") : t("inventory.detail.saveSettings")}
                icon={<Save size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={() => void saveSettings()}
                disabled={busy}
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
    backgroundColor: colors.background,
    padding: 12
  },
  countLabel: {
    color: colors.faint,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  countValue: { color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 5 },
  depletionValue: { color: colors.accentDark },
  depletionRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12 },
  depletionText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  coverageBox: { backgroundColor: colors.surfaceWarm, borderRadius: 12, padding: 12, marginTop: 16 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  coverage: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "900", marginTop: 5 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  opsBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginTop: -6,
    marginBottom: 12
  },
  canonicalMeta: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginBottom: 12
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 14 },
  flushTitle: { marginBottom: 0 },
  factGrid: { flexDirection: "row", gap: 10 },
  fact: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.background
  },
  factValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  factLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
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
  addButton: { marginTop: 14 },
  field: { marginBottom: 14 },
  label: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: 7 },
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
    backgroundColor: colors.background,
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
