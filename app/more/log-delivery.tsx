import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Package, Truck } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  fetchDeliveryHistory,
  fetchInventoryItems,
  flushQueuedInventoryEvents,
  queueInventoryOperation,
  type DeliveryHistoryEntry
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { InventoryItem } from "../../types/mise";

type Tab = "history" | "log";

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
  if (summary.accepted > 0) return t("inventory.ops.result.accepted");
  return t("inventory.ops.result.queued");
}

function formatWhen(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  try {
    return new Date(parsed).toLocaleString();
  } catch {
    return iso;
  }
}

export default function LogDeliveryScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [tab, setTab] = useState<Tab>("history");
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [lastLoggedItemId, setLastLoggedItemId] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const tabOptions = useMemo<readonly SegmentOption<Tab>[]>(
    () => [
      { value: "history", label: t("logDelivery.tab.history"), tone: "neutral" },
      { value: "log", label: t("logDelivery.tab.log"), tone: "brand" }
    ],
    [t]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setHistory([]);
    setItems([]);
    setQuery("");
    setSelected(null);
    setQuantityText("");
    setNoteText("");
    setMessage(null);
    setMessageIsError(false);
    setLastLoggedItemId(null);
    setLoadedRestaurantId(null);
    setError(false);
    setTab("history");
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
      const [nextItems, nextHistory] = await Promise.all([
        fetchInventoryItems(restaurantId),
        fetchDeliveryHistory(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setItems(nextItems);
      setHistory(nextHistory);
      setLoadedRestaurantId(restaurantId);
    } catch {
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

  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: error
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManage,
    hubReady,
    busy: submitting
  });
  const visibleItems = hubReady ? items : [];
  const visibleHistory = hubReady ? history : [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleItems.slice(0, 40);
    return visibleItems
      .filter((item) => {
        const haystack = [item.item_name, item.id, item.category, item.supplier_name]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 40);
  }, [query, visibleItems]);

  function resetForm(keepSelection = false) {
    if (!keepSelection) setSelected(null);
    setQuantityText("");
    setNoteText("");
    setMessage(null);
    setMessageIsError(false);
  }

  async function submitReceipt() {
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
      setMessage(t("logDelivery.error.quantity"));
      setMessageIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    const itemId = selected.id;
    setSubmitting(true);
    setMessage(null);
    setMessageIsError(false);
    try {
      await queueInventoryOperation({
        restaurantId,
        inventoryItemId: itemId,
        eventType: "receipt",
        quantity,
        canonicalUnit: selected.canonical_unit!,
        effectiveAt: new Date().toISOString(),
        note: noteText.trim() || undefined
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;

      const flushSummary = await flushQueuedInventoryEvents(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;

      setMessage(describeFlushResult(flushSummary, t));
      setMessageIsError(flushSummary.conflicted > 0 || flushSummary.rejected > 0);
      setLastLoggedItemId(itemId);
      setQuantityText("");
      setNoteText("");
      setSelected(null);

      const nextHistory = await fetchDeliveryHistory(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setHistory(nextHistory);
      setLoadedRestaurantId(restaurantId);
      if (!(flushSummary.conflicted > 0 || flushSummary.rejected > 0)) {
        setTab("history");
      }
    } catch (submitError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(submitError, {
        flow: "log_delivery",
        operation: "receipt",
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
      <Screen title={t("logDelivery.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("logDelivery.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("logDelivery.title")}
      subtitle={
        tab === "history"
          ? t("logDelivery.history.subtitle")
          : selected
            ? selected.item_name
            : t("logDelivery.subtitle")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading && tab === "log" && !selected}
      keyboardAware
    >
      <View style={styles.stack}>
        <SegmentedControl
          accessibilityLabel={t("logDelivery.tabs.accessibility")}
          options={tabOptions}
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            if (next === "history") {
              setSelected(null);
              setMessage(null);
              setMessageIsError(false);
            }
          }}
          variant="pills"
        />

        {error ? (
          <RetryNotice
            title={t("logDelivery.retry.title")}
            message={t("logDelivery.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("logDelivery.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {message ? (
          <StatusNotice
            tone={messageIsError ? "danger" : "success"}
            title={messageIsError ? t("common.error") : t("logDelivery.successTitle")}
            message={message}
          />
        ) : null}

        {tab === "history" ? (
          <>
            <SectionHeader
              title={t("logDelivery.history.title")}
              subtitle={t("logDelivery.history.count", {
                count: formatNumber(visibleHistory.length)
              })}
            />
            {visibleHistory.length === 0 && !loading ? (
              <EmptyState
                title={t("logDelivery.history.emptyTitle")}
                body={t("logDelivery.history.emptyBody")}
              />
            ) : (
              <View style={styles.historyList}>
                {visibleHistory.map((entry) => (
                  <View key={entry.id} style={styles.historyCard}>
                    <View style={styles.historyMain}>
                      <Text style={styles.historyTitle}>{entry.itemName}</Text>
                      <Text style={styles.historyMeta}>
                        {t("logDelivery.history.quantity", {
                          qty: formatNumber(entry.quantity, { maximumFractionDigits: 2 }),
                          unit: t(
                            `inventory.ops.unit.${entry.canonicalUnit}` as
                              | "inventory.ops.unit.g"
                              | "inventory.ops.unit.ml"
                              | "inventory.ops.unit.each"
                          )
                        })}
                      </Text>
                      <Text style={styles.historyWhen}>
                        {formatWhen(entry.effectiveAt)}
                      </Text>
                      {entry.note ? (
                        <Text numberOfLines={2} style={styles.historyNote}>
                          {entry.note}
                        </Text>
                      ) : null}
                    </View>
                    {entry.syncing ? (
                      <Badge label={t("logDelivery.history.syncing")} tone="warning" />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            <Button
              title={t("logDelivery.history.logNew")}
              icon={<Truck size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
              onPress={() => setTab("log")}
              fullWidth
            />
          </>
        ) : !selected ? (
          <>
            <SectionHeader title={t("logDelivery.pickItem")} />
            <TextInput
              accessibilityLabel={t("logDelivery.search.accessibility")}
              placeholder={t("logDelivery.search.placeholder")}
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {filtered.length === 0 ? (
              <EmptyState title={t("logDelivery.empty.title")} body={t("logDelivery.empty.body")} />
            ) : (
              <View style={styles.list}>
                {filtered.map((item) => (
                  <OperationalRow
                    key={item.id}
                    density="operational"
                    title={item.item_name}
                    subtitle={
                      isCanonicalUnitReady(item)
                        ? t("logDelivery.row.ready", {
                            qty: formatNumber(item.current_quantity, { maximumFractionDigits: 1 }),
                            unit: item.unit
                          })
                        : t("logDelivery.row.unverified")
                    }
                    icon={<Package size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                    onPress={() => {
                      setSelected(item);
                      setMessage(null);
                      setMessageIsError(false);
                      setLastLoggedItemId(null);
                      setQuantityText("");
                      setNoteText("");
                    }}
                    accessibilityLabel={t("logDelivery.row.accessibility", { item: item.item_name })}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <StatusNotice
              tone={isCanonicalUnitReady(selected) ? "neutral" : "warning"}
              title={selected.item_name}
              message={
                isCanonicalUnitReady(selected)
                  ? t("logDelivery.form.helper", {
                      qty: formatNumber(selected.current_quantity, { maximumFractionDigits: 1 }),
                      displayUnit: selected.unit,
                      unit: t(
                        `inventory.ops.unit.${selected.canonical_unit}` as
                          | "inventory.ops.unit.g"
                          | "inventory.ops.unit.ml"
                          | "inventory.ops.unit.each"
                      )
                    })
                  : t("inventory.ops.unverified.body")
              }
            />

            <SectionHeader
              title={
                isCanonicalUnitReady(selected)
                  ? t("logDelivery.field.quantityWithUnit", {
                      unit: t(
                        `inventory.ops.unit.${selected.canonical_unit}` as
                          | "inventory.ops.unit.g"
                          | "inventory.ops.unit.ml"
                          | "inventory.ops.unit.each"
                      )
                    })
                  : t("logDelivery.field.quantity")
              }
            />
            <TextInput
              accessibilityLabel={
                isCanonicalUnitReady(selected)
                  ? t("logDelivery.field.quantityWithUnit", {
                      unit: t(
                        `inventory.ops.unit.${selected.canonical_unit}` as
                          | "inventory.ops.unit.g"
                          | "inventory.ops.unit.ml"
                          | "inventory.ops.unit.each"
                      )
                    })
                  : t("logDelivery.field.quantity")
              }
              placeholder={t("logDelivery.field.quantityPlaceholder")}
              placeholderTextColor={colors.faint}
              value={quantityText}
              onChangeText={setQuantityText}
              keyboardType="decimal-pad"
              style={styles.input}
              editable={actionsEditable && isCanonicalUnitReady(selected)}
            />

            <SectionHeader title={t("logDelivery.field.note")} />
            <TextInput
              accessibilityLabel={t("logDelivery.field.note")}
              placeholder={t("logDelivery.field.notePlaceholder")}
              placeholderTextColor={colors.faint}
              value={noteText}
              onChangeText={setNoteText}
              style={[styles.input, styles.noteInput]}
              multiline
              textAlignVertical="top"
              editable={actionsEditable}
            />

            <Button
              title={submitting ? t("common.saving") : t("logDelivery.submit")}
              icon={<Truck size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
              onPress={() => void submitReceipt()}
              disabled={!actionsEditable || !isCanonicalUnitReady(selected)}
              fullWidth
            />

            <View style={styles.afterSave}>
              {lastLoggedItemId && !messageIsError ? (
                <>
                  <Button
                    title={t("logDelivery.logAnother")}
                    variant="secondary"
                    onPress={() => resetForm(false)}
                    fullWidth
                  />
                  <Button
                    title={t("logDelivery.openItem")}
                    variant="ghost"
                    onPress={() => router.push(`/inventory/${lastLoggedItemId}`)}
                    fullWidth
                  />
                </>
              ) : (
                <Button
                  title={t("logDelivery.changeItem")}
                  variant="secondary"
                  onPress={() => resetForm(false)}
                  fullWidth
                />
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    ...typography.body
  },
  noteInput: {
    minHeight: 88
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: "hidden"
  },
  historyList: {
    gap: 10
  },
  historyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  historyMain: {
    flex: 1,
    gap: 3
  },
  historyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600"
  },
  historyMeta: {
    ...typography.caption,
    color: colors.muted
  },
  historyWhen: {
    ...typography.caption,
    color: colors.faint
  },
  historyNote: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2
  },
  afterSave: {
    gap: 8
  }
});
