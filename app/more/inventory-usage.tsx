import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Package, Utensils } from "lucide-react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  INVENTORY_USAGE_REASON_CODES,
  type InventoryUsageReasonCode
} from "../../services/domain/inventoryUsage";
import {
  fetchInventoryItems,
  flushQueuedInventoryEvents,
  queueInventoryUsage
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { InventoryItem } from "../../types/mise";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

function isCanonicalUnitReady(item: InventoryItem) {
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each")
  );
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
  if (summary.accepted > 0) return t("inventoryUsage.result.accepted");
  return t("inventory.ops.result.queued");
}

function unitLabel(
  item: InventoryItem,
  t: ReturnType<typeof useLocale>["t"]
): string {
  if (!isCanonicalUnitReady(item) || !item.canonical_unit) return item.unit;
  return t(`inventory.ops.unit.${item.canonical_unit}` as MessageKey);
}

export default function InventoryUsageScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [reasonCode, setReasonCode] = useState<InventoryUsageReasonCode>("prep");
  const [quantityText, setQuantityText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageRestaurantData(memberships, restaurant?.id);
  const hubState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: submitting
  });

  const reasonOptions = useMemo<readonly SegmentOption<InventoryUsageReasonCode>[]>(
    () =>
      INVENTORY_USAGE_REASON_CODES.map((value) => ({
        value,
        label: t(`inventoryUsage.reason.${value}` as MessageKey),
        tone: "neutral",
        accessibilityLabel: t(`inventoryUsage.reason.${value}Accessibility` as MessageKey)
      })),
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setItems([]);
    setQuery("");
    setSelected(null);
    setReasonCode("prep");
    setQuantityText("");
    setNoteText("");
    setMessage(null);
    setMessageIsError(false);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const nextItems = await fetchInventoryItems(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setItems(nextItems);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "inventory_usage",
        operation: "load",
        restaurant_id: restaurantId
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleItems = hubReady ? items : [];
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visibleItems
      .filter((item) => {
        if (!needle) return true;
        const haystack = [item.item_name, item.category, item.supplier_name, item.unit, item.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 40);
  }, [query, visibleItems]);

  async function submitUsage() {
    if (!restaurant || !selected || !actionsEditable) return;
    if (!canManage || !hubReady) {
      setMessage(t("inventory.detail.viewOnlyInventory"));
      setMessageIsError(true);
      return;
    }
    if (!isCanonicalUnitReady(selected)) {
      setMessage(t("inventory.ops.unverified.body"));
      setMessageIsError(true);
      return;
    }

    const quantity = parseNumber(quantityText);
    if (quantity === null || quantity <= 0) {
      setMessage(t("inventoryUsage.error.quantity"));
      setMessageIsError(true);
      return;
    }

    const note = noteText.trim();
    if (!note) {
      setMessage(t("inventoryUsage.error.note"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSubmitting(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await queueInventoryUsage({
        restaurantId,
        inventoryItemId: selected.id,
        quantity,
        canonicalUnit: selected.canonical_unit!,
        effectiveAt: new Date().toISOString(),
        note,
        reasonCode
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;

      const flushSummary = await flushQueuedInventoryEvents(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;

      setMessage(describeFlushResult(flushSummary, t));
      setMessageIsError(flushSummary.conflicted > 0 || flushSummary.rejected > 0);
      if (!(flushSummary.conflicted > 0 || flushSummary.rejected > 0)) {
        setQuantityText("");
        setNoteText("");
        setSelected(null);
        setReasonCode("prep");
        const nextItems = await fetchInventoryItems(restaurantId);
        if (activeRestaurantIdRef.current !== restaurantId) return;
        setItems(nextItems);
        setLoadedRestaurantId(restaurantId);
      }
    } catch (submitError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(submitError, {
        flow: "inventory_usage",
        operation: "submit",
        restaurant_id: restaurantId
      });
      setMessage(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message.slice(0, 220)
          : t("inventory.ops.submitError")
      );
      setMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSubmitting(false);
    }
  }

  if (!restaurant) {
    return (
      <Screen title={t("inventoryUsage.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("inventoryUsage.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("inventoryUsage.title")}
      subtitle={t("inventoryUsage.subtitle")}
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
      keyboardAware
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("inventoryUsage.error.title")}
            message={t("inventoryUsage.error.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("inventoryUsage.error.retry")}
            onRetry={() => void load()}
          />
        ) : null}

        {message ? (
          <StatusNotice
            tone={messageIsError ? "danger" : "success"}
            title={messageIsError ? t("common.error") : t("common.saved")}
            message={message}
          />
        ) : null}

        {!canManage ? (
          <StatusNotice
            tone="warning"
            title={t("inventoryUsage.viewOnly.title")}
            message={t("inventoryUsage.viewOnly.body")}
          />
        ) : null}

        {selected ? (
          <>
            <StatusNotice
              tone={isCanonicalUnitReady(selected) ? "neutral" : "warning"}
              title={selected.item_name}
              message={
                isCanonicalUnitReady(selected)
                  ? t("inventoryUsage.form.helper", {
                      qty: formatNumber(selected.current_quantity, { maximumFractionDigits: 1 }),
                      displayUnit: selected.unit,
                      unit: unitLabel(selected, t)
                    })
                  : t("inventory.ops.unverified.body")
              }
            />

            <SectionHeader title={t("inventoryUsage.reason.title")} />
            <SegmentedControl
              accessibilityLabel={t("inventoryUsage.reason.accessibility")}
              options={reasonOptions}
              value={reasonCode}
              onValueChange={setReasonCode}
              scrollable
              variant="pills"
            />

            <SectionHeader
              title={t("inventoryUsage.field.quantityWithUnit", {
                unit: unitLabel(selected, t)
              })}
            />
            <TextInput
              accessibilityLabel={t("inventoryUsage.field.quantityWithUnit", {
                unit: unitLabel(selected, t)
              })}
              placeholder={t("inventoryUsage.field.quantityPlaceholder")}
              placeholderTextColor={colors.faint}
              value={quantityText}
              onChangeText={setQuantityText}
              keyboardType="decimal-pad"
              style={styles.input}
              editable={actionsEditable && isCanonicalUnitReady(selected)}
            />

            <SectionHeader title={t("inventoryUsage.field.note")} />
            <TextInput
              accessibilityLabel={t("inventoryUsage.field.note")}
              placeholder={t("inventoryUsage.field.notePlaceholder")}
              placeholderTextColor={colors.faint}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              style={[styles.input, styles.noteInput]}
              editable={actionsEditable && isCanonicalUnitReady(selected)}
            />

            <Button
              title={submitting ? t("inventory.ops.submitting") : t("inventoryUsage.submit")}
              onPress={() => void submitUsage()}
              disabled={!actionsEditable || !isCanonicalUnitReady(selected)}
              accessibilityLabel={t("inventoryUsage.submitHint")}
              icon={<Utensils size={icon.inline} color={colors.surface} strokeWidth={iconStroke} />}
            />
            <Button
              title={t("inventoryUsage.changeItem")}
              variant="secondary"
              onPress={() => {
                setSelected(null);
                setQuantityText("");
                setNoteText("");
                setMessage(null);
                setMessageIsError(false);
              }}
              disabled={submitting}
            />
          </>
        ) : (
          <>
            <SectionHeader title={t("inventoryUsage.pick.title")} />
            <TextInput
              accessibilityLabel={t("inventoryUsage.pick.search")}
              placeholder={t("inventoryUsage.pick.searchPlaceholder")}
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              editable={hubReady}
            />
            {!error && hubReady && filteredItems.length === 0 ? (
              <EmptyState
                title={t("inventoryUsage.pick.emptyTitle")}
                body={
                  visibleItems.length === 0
                    ? t("inventoryUsage.pick.emptyBody")
                    : t("inventoryUsage.pick.noMatch")
                }
              />
            ) : null}
            {filteredItems.length > 0 ? (
              <View style={styles.list}>
                {filteredItems.map((item) => (
                  <OperationalRow
                    key={item.id}
                    density="menu"
                    title={item.item_name}
                    subtitle={
                      isCanonicalUnitReady(item)
                        ? t("inventoryUsage.row.ready", {
                            qty: formatNumber(item.current_quantity, { maximumFractionDigits: 1 }),
                            unit: item.unit
                          })
                        : t("inventoryUsage.row.unverified")
                    }
                    icon={<Package size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                    onPress={() => {
                      setSelected(item);
                      setMessage(null);
                      setMessageIsError(false);
                      setQuantityText("");
                      setNoteText("");
                      setReasonCode("prep");
                    }}
                    accessibilityLabel={t("inventoryUsage.row.accessibility", {
                      item: item.item_name
                    })}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.surface,
    ...typography.body
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: "top",
    ...conceptTypography.body
  }
});
