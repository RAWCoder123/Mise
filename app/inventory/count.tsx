import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { CheckCircle2, Circle, ClipboardList, Diff } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  isCountSessionEligibleInventoryItem,
  summarizeCountSessionProgress
} from "../../services/domain/inventoryCountSessions";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import {
  approveInventoryCountSession,
  beginInventoryCountSession,
  cancelInventoryCountSession,
  fetchInventoryItems,
  fetchOpenInventoryCountSession,
  saveInventoryCountLines,
  submitInventoryCountSession
} from "../../services/miseService";
import { canApproveInventoryCount, canDraftInventoryCount } from "../../services/tenantAccess";
import type { InventoryCountSessionDetail, InventoryItem } from "../../types/mise";

export default function InventoryCountSessionScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant, memberships } = useMiseSession();
  const canDraft = canDraftInventoryCount(memberships, restaurant?.id ?? "");
  const canApprove = canApproveInventoryCount(memberships, restaurant?.id ?? "");
  const [detail, setDetail] = useState<InventoryCountSessionDetail | null>(null);
  const [eligibleItems, setEligibleItems] = useState<InventoryItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});
  const [scopeQuery, setScopeQuery] = useState("");
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [open, inventoryItems] = await Promise.all([
        fetchOpenInventoryCountSession(restaurantId),
        fetchInventoryItems(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      const eligible = inventoryItems
        .filter(isCountSessionEligibleInventoryItem)
        .sort((left, right) => {
          const byName = left.item_name.localeCompare(right.item_name);
          return byName !== 0 ? byName : left.id.localeCompare(right.id);
        });
      setEligibleItems(eligible);
      setSelectedItemIds(Object.fromEntries(eligible.map((item) => [item.id, true])));
      setDetail(open);
      setDraftCounts(
        Object.fromEntries(
          (open?.lines ?? []).map((line) => [
            line.inventory_item_id,
            line.counted_quantity == null ? "" : String(line.counted_quantity)
          ])
        )
      );
      setDraftNotes(
        Object.fromEntries((open?.lines ?? []).map((line) => [line.inventory_item_id, line.note ?? ""]))
      );
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(t("inventory.count.loadError"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    setLoadedRestaurantId(null);
    setDetail(null);
    setEligibleItems([]);
    setSelectedItemIds({});
    setScopeQuery("");
    setDraftCounts({});
    setDraftNotes({});
    setSaving(false);
    setError(null);
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleDetail = loadedRestaurantId === restaurant?.id ? detail : null;
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: Boolean(error)
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canDraft,
    hubReady,
    busy: saving
  });

  const progress = useMemo(
    () => summarizeCountSessionProgress(visibleDetail?.lines ?? []),
    [visibleDetail?.lines]
  );

  const selectedCount = useMemo(
    () => eligibleItems.reduce((count, item) => count + (selectedItemIds[item.id] ? 1 : 0), 0),
    [eligibleItems, selectedItemIds]
  );

  const filteredEligibleItems = useMemo(() => {
    const needle = scopeQuery.trim().toLowerCase();
    if (!needle) return eligibleItems;
    return eligibleItems.filter((item) => {
      const haystack = `${item.item_name} ${item.category} ${item.supplier_name}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [eligibleItems, scopeQuery]);

  async function startSession() {
    if (!restaurant || !actionsEditable) return;
    const restaurantId = restaurant.id;
    const selectedIds = eligibleItems
      .filter((item) => selectedItemIds[item.id])
      .map((item) => item.id);
    if (selectedIds.length < 1) {
      setError(t("inventory.count.scopeNoneSelected"));
      return;
    }
    const scopedIds =
      selectedIds.length === eligibleItems.length ? null : selectedIds;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await beginInventoryCountSession(restaurantId, null, scopedIds);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      setDraftCounts(
        Object.fromEntries(next.lines.map((line) => [line.inventory_item_id, ""]))
      );
      setDraftNotes(Object.fromEntries(next.lines.map((line) => [line.inventory_item_id, ""])));
      setLoadedRestaurantId(restaurantId);
      setNotice(t("inventory.count.started"));
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setError(caught instanceof Error ? caught.message : t("inventory.count.startError"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  function syncDraftsFromDetail(next: InventoryCountSessionDetail) {
    setDraftCounts(
      Object.fromEntries(
        next.lines.map((line) => [
          line.inventory_item_id,
          line.counted_quantity == null ? "" : String(line.counted_quantity)
        ])
      )
    );
    setDraftNotes(Object.fromEntries(next.lines.map((line) => [line.inventory_item_id, line.note ?? ""])));
  }

  function buildCountLinePayload(
    sessionDetail: InventoryCountSessionDetail,
    requireComplete: boolean
  ) {
    const lines = sessionDetail.lines
      .map((line) => {
        const raw = draftCounts[line.inventory_item_id]?.trim() ?? "";
        if (!raw) return null;
        const countedQuantity = Number(raw);
        if (!Number.isFinite(countedQuantity)) return null;
        const noteRaw = draftNotes[line.inventory_item_id] ?? "";
        if (noteRaw.trim().length > 240) {
          throw new Error(t("inventory.count.noteTooLong"));
        }
        return {
          inventoryItemId: line.inventory_item_id,
          countedQuantity,
          note: noteRaw.trim() || null
        };
      })
      .filter(
        (
          line
        ): line is { inventoryItemId: string; countedQuantity: number; note: string | null } =>
          Boolean(line)
      );
    if (requireComplete && lines.length !== sessionDetail.lines.length) {
      throw new Error(t("inventory.count.incomplete"));
    }
    return lines;
  }

  async function saveProgress() {
    if (!restaurant || !visibleDetail || !actionsEditable) return;
    const restaurantId = restaurant.id;
    let lines: Array<{ inventoryItemId: string; countedQuantity: number; note: string | null }>;
    try {
      lines = buildCountLinePayload(visibleDetail, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inventory.count.saveError"));
      return;
    }
    if (lines.length < 1) {
      setError(t("inventory.count.saveEmpty"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await saveInventoryCountLines(restaurantId, visibleDetail.session.id, lines);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      syncDraftsFromDetail(next);
      setLoadedRestaurantId(restaurantId);
      setNotice(t("inventory.count.saved"));
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setError(caught instanceof Error ? caught.message : t("inventory.count.saveError"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function submitSession() {
    if (!restaurant || !visibleDetail || !actionsEditable) return;
    const restaurantId = restaurant.id;
    setSaving(true);
    setError(null);
    try {
      const lines = buildCountLinePayload(visibleDetail, true);
      await saveInventoryCountLines(restaurantId, visibleDetail.session.id, lines);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const next = await submitInventoryCountSession(restaurantId, visibleDetail.session.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      syncDraftsFromDetail(next);
      setLoadedRestaurantId(restaurantId);
      setNotice(t("inventory.count.submitted"));
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setError(caught instanceof Error ? caught.message : t("inventory.count.submitError"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function approveSession() {
    if (!restaurant || !visibleDetail || !canApprove) return;
    const restaurantId = restaurant.id;
    setSaving(true);
    setError(null);
    try {
      const next = await approveInventoryCountSession(restaurantId, visibleDetail.session.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      setLoadedRestaurantId(restaurantId);
      setNotice(t("inventory.count.approved"));
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setError(caught instanceof Error ? caught.message : t("inventory.count.approveError"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  function confirmCancel() {
    if (!restaurant || !visibleDetail || !canApprove) return;
    const restaurantId = restaurant.id;
    const sessionId = visibleDetail.session.id;
    Alert.alert(t("inventory.count.cancelTitle"), t("inventory.count.cancelBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("inventory.count.cancelAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError(null);
            try {
              const next = await cancelInventoryCountSession(restaurantId, sessionId);
              if (activeRestaurantIdRef.current !== restaurantId) return;
              setDetail(next);
              setLoadedRestaurantId(restaurantId);
              setNotice(t("inventory.count.cancelled"));
            } catch (caught) {
              if (activeRestaurantIdRef.current !== restaurantId) return;
              setError(caught instanceof Error ? caught.message : t("inventory.count.cancelError"));
            } finally {
              if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
            }
          })();
        }
      }
    ]);
  }

  if (!restaurant) {
    return (
      <Screen title={t("inventory.count.title")} subtitle={t("inventory.count.subtitle")}>
        <EmptyState
          title={t("inventory.noWorkspace.title")}
          body={t("inventory.noWorkspace.body")}
          illustration={<ClipboardList size={28} color={colors.faint} strokeWidth={2.25} />}
        />
      </Screen>
    );
  }

  const statusLabel =
    visibleDetail?.session.status === "submitted"
      ? t("inventory.count.status.submitted")
      : visibleDetail?.session.status === "approved"
        ? t("inventory.count.status.approved")
        : visibleDetail?.session.status === "cancelled"
          ? t("inventory.count.status.cancelled")
          : t("inventory.count.status.inProgress");

  return (
    <Screen
      title={t("inventory.count.title")}
      subtitle={t("inventory.count.subtitleRestaurant", { restaurant: restaurant.name })}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("inventory.count.retryTitle")}
            message={error}
            onRetry={() => void load()}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("inventory.count.retryAccessibility")}
          />
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!visibleDetail ||
        visibleDetail.session.status === "approved" ||
        visibleDetail.session.status === "cancelled" ? (
          <MotionView distance={3} duration={240}>
            <SectionSurface
              title={t("inventory.count.startTitle")}
              subtitle={t("inventory.count.startBody")}
            >
              {canDraft ? (
                <View style={styles.scopeBlock}>
                  <Text style={styles.scopeTitle}>{t("inventory.count.scopeTitle")}</Text>
                  <Text style={styles.scopeBody}>{t("inventory.count.scopeBody")}</Text>
                  <Text style={styles.scopeMeta}>
                    {t("inventory.count.scopeSelected", {
                      selected: formatNumber(selectedCount),
                      total: formatNumber(eligibleItems.length)
                    })}
                  </Text>
                  {eligibleItems.length > 0 ? (
                    <>
                      <TextInput
                        accessibilityLabel={t("inventory.count.scopeSearchAccessibility")}
                        editable={!saving}
                        value={scopeQuery}
                        onChangeText={setScopeQuery}
                        placeholder={t("inventory.count.scopeSearchPlaceholder")}
                        placeholderTextColor={colors.faint}
                        style={styles.scopeSearch}
                      />
                      <View style={styles.scopeActions}>
                        <Button
                          title={t("inventory.count.scopeSelectAll")}
                          variant="secondary"
                          size="compact"
                          disabled={saving}
                          onPress={() =>
                            setSelectedItemIds(
                              Object.fromEntries(eligibleItems.map((item) => [item.id, true]))
                            )
                          }
                        />
                        <Button
                          title={t("inventory.count.scopeClear")}
                          variant="secondary"
                          size="compact"
                          disabled={saving}
                          onPress={() => setSelectedItemIds({})}
                        />
                      </View>
                      <View style={styles.scopeList}>
                        {filteredEligibleItems.map((item, index) => {
                          const checked = Boolean(selectedItemIds[item.id]);
                          return (
                            <Pressable
                              key={item.id}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked }}
                              accessibilityLabel={t("inventory.count.scopeItemAccessibility", {
                                item: item.item_name
                              })}
                              disabled={saving}
                              onPress={() =>
                                setSelectedItemIds((current) => ({
                                  ...current,
                                  [item.id]: !current[item.id]
                                }))
                              }
                              style={[
                                styles.scopeRow,
                                index > 0 ? styles.scopeRowDivided : null
                              ]}
                            >
                              {checked ? (
                                <CheckCircle2
                                  size={icon.inline}
                                  color={colors.success}
                                  strokeWidth={iconStroke}
                                />
                              ) : (
                                <Circle
                                  size={icon.inline}
                                  color={colors.borderStrong}
                                  strokeWidth={iconStroke}
                                />
                              )}
                              <View style={styles.scopeCopy}>
                                <Text style={styles.scopeItemName}>{item.item_name}</Text>
                                <Text style={styles.scopeItemMeta}>
                                  {item.category} · {item.unit}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                        {filteredEligibleItems.length < 1 ? (
                          <Text style={styles.help}>{t("inventory.count.scopeEmpty")}</Text>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.help}>{t("inventory.count.scopeNoEligible")}</Text>
                  )}
                </View>
              ) : null}
              <Button
                title={t("inventory.count.startAction")}
                onPress={() => void startSession()}
                disabled={!canDraft || saving || eligibleItems.length < 1}
                fullWidth
                accessibilityLabel={t("inventory.count.startAccessibility")}
              />
              {!canDraft ? (
                <Text style={styles.help}>{t("inventory.count.staffReadonly")}</Text>
              ) : null}
              <Button
                title={t("inventory.count.backToList")}
                variant="secondary"
                onPress={() => router.replace("/inventory")}
                fullWidth
                style={styles.secondaryAction}
              />
            </SectionSurface>
          </MotionView>
        ) : (
          <>
            <MotionView distance={3} duration={240}>
              <SectionSurface title={t("inventory.count.progressTitle")} subtitle={statusLabel}>
                <Text style={styles.progressCopy}>
                  {t("inventory.count.progressBody", {
                    counted: formatNumber(progress.countedLines),
                    total: formatNumber(progress.totalLines),
                    variance: formatNumber(progress.varianceLines)
                  })}
                </Text>
              </SectionSurface>
            </MotionView>

            <MotionView delay={40} distance={3} duration={240}>
              <SectionSurface
                title={t("inventory.count.linesTitle")}
                subtitle={t("inventory.count.linesSubtitle")}
                padding="none"
              >
                <View style={styles.lineList}>
                  {visibleDetail.lines.map((line, index) => {
                    const countedRaw = draftCounts[line.inventory_item_id] ?? "";
                    const noteRaw = draftNotes[line.inventory_item_id] ?? "";
                    const counted = countedRaw.trim() === "" ? null : Number(countedRaw);
                    const variance =
                      counted == null || !Number.isFinite(counted)
                        ? null
                        : counted - line.system_quantity_at_start;
                    const editable =
                      actionsEditable && visibleDetail.session.status === "in_progress";
                    const showNoteField =
                      editable || noteRaw.trim().length > 0 || (variance != null && variance !== 0);
                    return (
                      <View
                        key={line.id}
                        style={[styles.lineRow, index > 0 ? styles.lineRowDivided : null]}
                      >
                        <View style={styles.lineHeader}>
                          <View style={styles.lineCopy}>
                            <Text style={styles.lineName}>{line.item_name}</Text>
                            <Text style={styles.lineMeta}>
                              {t("inventory.count.systemQty", {
                                quantity: formatNumber(line.system_quantity_at_start),
                                unit: line.unit
                              })}
                            </Text>
                            {variance != null && variance !== 0 ? (
                              <View style={styles.varianceRow}>
                                <Diff size={14} color={colors.accent} strokeWidth={2.25} />
                                <Text style={styles.varianceText}>
                                  {t("inventory.count.variance", {
                                    quantity: formatNumber(variance),
                                    unit: line.unit
                                  })}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <TextInput
                            accessibilityLabel={t("inventory.count.countedAccessibility", {
                              item: line.item_name
                            })}
                            editable={editable}
                            keyboardType="decimal-pad"
                            value={countedRaw}
                            onChangeText={(value) =>
                              setDraftCounts((current) => ({
                                ...current,
                                [line.inventory_item_id]: value
                              }))
                            }
                            placeholder="0"
                            placeholderTextColor={colors.faint}
                            style={styles.countInput}
                          />
                        </View>
                        {showNoteField ? (
                          <TextInput
                            accessibilityLabel={t("inventory.count.noteAccessibility", {
                              item: line.item_name
                            })}
                            editable={editable}
                            value={noteRaw}
                            onChangeText={(value) =>
                              setDraftNotes((current) => ({
                                ...current,
                                [line.inventory_item_id]: value
                              }))
                            }
                            placeholder={t("inventory.count.notePlaceholder")}
                            placeholderTextColor={colors.faint}
                            style={styles.noteInput}
                            multiline
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </SectionSurface>
            </MotionView>

            <View style={styles.actions}>
              {visibleDetail.session.status === "in_progress" && actionsEditable ? (
                <>
                  <Button
                    title={t("inventory.count.saveAction")}
                    onPress={() => void saveProgress()}
                    disabled={saving}
                    fullWidth
                  />
                  <Button
                    title={t("inventory.count.submitAction")}
                    onPress={() => void submitSession()}
                    disabled={saving}
                    fullWidth
                    style={styles.secondaryAction}
                  />
                </>
              ) : null}
              {visibleDetail.session.status === "submitted" && canApprove ? (
                <Button
                  title={t("inventory.count.approveAction")}
                  onPress={() => void approveSession()}
                  disabled={saving}
                  fullWidth
                />
              ) : null}
              {visibleDetail.session.status === "submitted" && !canApprove ? (
                <Text style={styles.help}>{t("inventory.count.staffAwaitingApproval")}</Text>
              ) : null}
              {canApprove ? (
                <Button
                  title={t("inventory.count.cancelAction")}
                  variant="secondary"
                  onPress={confirmCancel}
                  disabled={saving}
                  fullWidth
                  style={styles.secondaryAction}
                />
              ) : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md
  },
  notice: {
    ...typography.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  help: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 10
  },
  scopeBlock: {
    gap: 8,
    marginBottom: 12
  },
  scopeTitle: {
    ...typography.cardTitle,
    color: colors.ink
  },
  scopeBody: {
    ...typography.caption,
    color: colors.muted
  },
  scopeMeta: {
    ...typography.caption,
    color: colors.ink
  },
  scopeSearch: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    ...typography.body,
    color: colors.ink
  },
  scopeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  scopeList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingVertical: 10
  },
  scopeRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  scopeCopy: {
    flex: 1,
    gap: 2
  },
  scopeItemName: {
    ...typography.cardTitle,
    color: colors.ink
  },
  scopeItemMeta: {
    ...typography.caption,
    color: colors.muted
  },
  progressCopy: {
    ...typography.body,
    color: colors.ink
  },
  lineList: {
    paddingHorizontal: 14,
    paddingBottom: 8
  },
  lineRow: {
    gap: 8,
    paddingVertical: 12
  },
  lineRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  lineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  lineCopy: {
    flex: 1,
    gap: 4
  },
  lineName: {
    ...typography.cardTitle,
    color: colors.ink
  },
  lineMeta: {
    ...typography.caption,
    color: colors.muted
  },
  varianceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  varianceText: {
    ...typography.caption,
    color: colors.accent
  },
  countInput: {
    width: 88,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    ...typography.cardTitle,
    color: colors.ink,
    textAlign: "right"
  },
  noteInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...typography.caption,
    color: colors.ink
  },
  actions: {
    gap: 10
  },
  secondaryAction: {
    marginTop: 0
  }
});
