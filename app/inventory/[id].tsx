import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowDownRight, ArrowLeft, ClipboardList, PackageCheck, Save, Trash2 } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { OperationalHero } from "../../components/ui/OperationalHero";
import { Screen } from "../../components/ui/Screen";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { localizeInventoryPrediction } from "../../i18n/inventoryPresentation";
import {
  addInventoryItemToOrder,
  fetchInventoryItemOutlook,
  fetchInventoryMovements,
  recordInventoryWaste,
  updateInventoryItem
} from "../../services/miseService";
import { canManageRestaurantData, canRecordInventoryWaste } from "../../services/tenantAccess";
import { operatingLimits } from "../../services/miseValidation";
import type { MessageKey } from "../../i18n/catalog";
import type { InventoryMovement, InventoryMovementReason, InventoryOutlookItem } from "../../types/mise";
import { statusTone } from "../../utils/inventory";

export default function InventoryDetailScreen() {
  const { formatDate, formatNumber, formatRelativeTime, parseNumber, t } = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { memberships, restaurant } = useMiseSession();
  const [outlook, setOutlook] = useState<InventoryOutlookItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [wasteNote, setWasteNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<InventoryFieldErrors>({});
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
      const [nextOutlook, nextMovements] = await Promise.all([
        fetchInventoryItemOutlook(restaurantId, itemId),
        fetchInventoryMovements(restaurantId, itemId, 6).catch(() => [] as InventoryMovement[])
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlook(nextOutlook);
      setMovements(nextMovements);
      setLoadedRestaurantId(restaurantId);
      if (nextOutlook) {
        setCurrentQuantity(formatNumber(nextOutlook.item.current_quantity, { maximumFractionDigits: 2, useGrouping: false }));
        setParLevel(formatNumber(nextOutlook.item.par_level, { maximumFractionDigits: 2, useGrouping: false }));
        setReorderThreshold(formatNumber(nextOutlook.item.reorder_threshold, { maximumFractionDigits: 2, useGrouping: false }));
        setFieldErrors({});
      }
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setOutlook(null);
      setMovements([]);
      setMessage(t("inventory.detail.loadError"));
      setMessageIsError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [formatNumber, id, restaurant?.id, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setOutlook(null);
    setCurrentQuantity("");
    setParLevel("");
    setReorderThreshold("");
    setWasteQuantity("");
    setWasteNote("");
    setSaving(false);
    setFieldErrors({});
    setMessage(null);
    setMessageIsError(false);
    setLoading(Boolean(restaurant && id));
    void load();
  }, [id, load, restaurant?.id]);

  const visibleOutlook = loadedRestaurantId === restaurant?.id ? outlook : null;
  const item = visibleOutlook?.item ?? null;
  const prediction = visibleOutlook?.prediction ?? null;
  const localizedPrediction = item && prediction
    ? localizeInventoryPrediction(t, formatNumber, item, prediction)
    : null;
  const status = prediction?.projectedStatus ?? null;
  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const canRecordWaste = canRecordInventoryWaste(memberships, restaurant?.id);

  function goBackToInventory() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace("/inventory");
  }

  async function save() {
    if (!restaurant || !item) return;
    if (!canManage) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }

    const nextFieldErrors: InventoryFieldErrors = {
      currentQuantity: validateInventoryNumber(currentQuantity, t("inventory.detail.field.currentQuantity"), parseNumber, formatNumber, t),
      parLevel: validateInventoryNumber(parLevel, t("inventory.detail.field.parLevel"), parseNumber, formatNumber, t),
      reorderThreshold: validateInventoryNumber(reorderThreshold, t("inventory.detail.field.reorderThreshold"), parseNumber, formatNumber, t)
    };
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      setMessage(t("inventory.detail.reviewFields"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setFieldErrors({});
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await updateInventoryItem(restaurantId, item.id, {
        current_quantity: parseNumber(currentQuantity) ?? 0,
        par_level: parseNumber(parLevel) ?? 0,
        reorder_threshold: parseNumber(reorderThreshold) ?? 0
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.updated"));
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setMessage(t("inventory.detail.saveError"));
        setMessageIsError(true);
      }
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
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
    setSaving(true);
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
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function recordWaste() {
    if (!restaurant || !item) return;
    if (!canRecordWaste) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
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
      setMessage(t("inventory.detail.reviewWaste"));
      setMessageIsError(true);
      return;
    }
    if (wasteNote.trim().length > 240) {
      setFieldErrors((current) => ({
        ...current,
        wasteNote: t("inventory.detail.wasteNoteTooLong")
      }));
      setMessage(t("inventory.detail.reviewWaste"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setFieldErrors((current) => ({ ...current, wasteQuantity: undefined, wasteNote: undefined }));
    setSaving(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await recordInventoryWaste(
        restaurantId,
        item.id,
        parseNumber(wasteQuantity) ?? 0,
        wasteNote.trim() || null
      );
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setWasteQuantity("");
      setWasteNote("");
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setMessage(t("inventory.detail.wasteRecorded"));
    } catch {
      if (activeRestaurantIdRef.current === restaurantId) {
        setMessage(t("inventory.detail.wasteError"));
        setMessageIsError(true);
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

          {message ? (
            <Text style={[styles.message, messageIsError && styles.error]} accessibilityLiveRegion="polite">
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
                disabled={saving}
                fullWidth
                style={styles.addButton}
              />
            ) : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{canManage ? t("inventory.detail.updateCount") : t("inventory.detail.countSettings")}</Text>
            <Field
              label={t("inventory.detail.currentQuantity", { unit: item.unit })}
              value={currentQuantity}
              onChangeText={(value) => {
                setCurrentQuantity(value);
                setFieldErrors((current) => ({ ...current, currentQuantity: undefined }));
              }}
              editable={canManage && !saving}
              error={fieldErrors.currentQuantity}
            />
            <Field
              label={t("inventory.detail.parLevel", { unit: item.unit })}
              value={parLevel}
              onChangeText={(value) => {
                setParLevel(value);
                setFieldErrors((current) => ({ ...current, parLevel: undefined }));
              }}
              editable={canManage && !saving}
              error={fieldErrors.parLevel}
            />
            <Field
              label={t("inventory.detail.reorderThreshold", { unit: item.unit })}
              value={reorderThreshold}
              onChangeText={(value) => {
                setReorderThreshold(value);
                setFieldErrors((current) => ({ ...current, reorderThreshold: undefined }));
              }}
              editable={canManage && !saving}
              error={fieldErrors.reorderThreshold}
            />
            {canManage ? (
              <Button
                title={saving ? t("inventory.detail.saving") : t("inventory.detail.saveCount")}
                icon={<Save size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={save}
                disabled={saving}
                fullWidth
                style={styles.saveButton}
              />
            ) : null}
          </Card>

          {canRecordWaste ? (
            <Card>
              <Text style={styles.cardTitle}>{t("inventory.detail.recordWaste")}</Text>
              <Text style={styles.copy}>{t("inventory.detail.wasteHelp")}</Text>
              <Field
                label={t("inventory.detail.wasteQuantity", { unit: item.unit })}
                value={wasteQuantity}
                onChangeText={(value) => {
                  setWasteQuantity(value);
                  setFieldErrors((current) => ({ ...current, wasteQuantity: undefined }));
                }}
                editable={!saving}
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
                  editable={!saving}
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
                accessibilityLabel={t("inventory.detail.wasteAccessibility", { item: item.item_name })}
                icon={<Trash2 size={17} color={colors.surface} strokeWidth={2.5} />}
                onPress={recordWaste}
                disabled={saving}
                fullWidth
                style={styles.saveButton}
              />
            </Card>
          ) : null}

          <Card>
            <Text style={styles.cardTitle}>{t("inventory.detail.movements.title")}</Text>
            {movements.length === 0 ? (
              <Text style={styles.copy}>{t("inventory.detail.movements.empty")}</Text>
            ) : (
              <View style={styles.movementList}>
                {movements.map((movement) => (
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
                    </View>
                    <Text style={styles.movementWhen} accessibilityLabel={formatDate(movement.created_at, { dateStyle: "medium", timeStyle: "short" })}>
                      {formatRelativeTime(movement.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      ) : (
        <Text style={[styles.message, messageIsError && styles.error]}>{message ?? t("inventory.detail.notFound")}</Text>
      )}
    </Screen>
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

interface InventoryFieldErrors {
  currentQuantity?: string;
  parLevel?: string;
  reorderThreshold?: string;
  wasteQuantity?: string;
  wasteNote?: string;
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
  },
  error: {
    color: colors.danger
  }
});
