import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ClipboardList, Diff, Package, Search } from "lucide-react-native";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { summarizeCountSessionProgress } from "../../services/domain/inventoryCountSessions";
import { filterInventoryItemsBySearch } from "../../services/domain/inventoryItemSearch";
import {
  approveInventoryCountSession,
  beginInventoryCountSession,
  cancelInventoryCountSession,
  fetchOpenInventoryCountSession,
  saveInventoryCountLines,
  submitInventoryCountSession
} from "../../services/miseService";
import { canApproveInventoryCount, canDraftInventoryCount } from "../../services/tenantAccess";
import type { InventoryCountLine, InventoryCountSessionDetail } from "../../types/mise";

export default function InventoryCountSessionScreen() {
  const { formatNumber, parseNumber, t } = useLocale();
  const { restaurant, memberships } = useMiseSession();
  const canDraft = canDraftInventoryCount(memberships, restaurant?.id ?? "");
  const canApprove = canApproveInventoryCount(memberships, restaurant?.id ?? "");
  const [detail, setDetail] = useState<InventoryCountSessionDetail | null>(null);
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [lineQuery, setLineQuery] = useState("");
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
      const open = await fetchOpenInventoryCountSession(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
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
    setDraftCounts({});
    setDraftNotes({});
    setLineQuery("");
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

  const progress = useMemo(
    () => summarizeCountSessionProgress(visibleDetail?.lines ?? []),
    [visibleDetail?.lines]
  );

  const visibleLines = useMemo(() => {
    const lines = visibleDetail?.lines ?? [];
    if (!lines.length) return [] as InventoryCountLine[];
    const lineByItemId = new Map(lines.map((line) => [line.inventory_item_id, line]));
    const ranked = filterInventoryItemsBySearch(
      lines.map((line) => ({
        id: line.inventory_item_id,
        item_name: line.item_name,
        unit: line.unit
      })),
      lineQuery
    );
    return ranked
      .map((item) => lineByItemId.get(item.id))
      .filter((line): line is InventoryCountLine => line != null);
  }, [lineQuery, visibleDetail?.lines]);

  async function startSession() {
    if (!restaurant || !canDraft) return;
    const restaurantId = restaurant.id;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await beginInventoryCountSession(restaurantId);
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
          line.counted_quantity == null
            ? ""
            : formatNumber(line.counted_quantity, { useGrouping: false })
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
        const countedQuantity = parseNumber(raw);
        if (countedQuantity == null || !Number.isFinite(countedQuantity) || countedQuantity < 0) {
          throw new Error(
            t("inventory.count.invalidQuantity", {
              item: line.item_name
            })
          );
        }
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
    if (!restaurant || !visibleDetail || !canDraft) return;
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
    if (!restaurant || !visibleDetail || !canDraft) return;
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
              <Button
                title={t("inventory.count.startAction")}
                onPress={() => void startSession()}
                disabled={!canDraft || saving}
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
                action={t(
                  visibleLines.length === 1
                    ? "inventory.count.lineCount.one"
                    : "inventory.count.lineCount.other",
                  { count: formatNumber(visibleLines.length) }
                )}
                padding="none"
              >
                <View style={styles.lineControls}>
                  <View style={styles.searchBox}>
                    <Search size={20} color={colors.faint} strokeWidth={2.25} />
                    <TextInput
                      accessibilityLabel={t("inventory.count.search.accessibility")}
                      accessibilityHint={t("inventory.count.search.hint")}
                      value={lineQuery}
                      onChangeText={setLineQuery}
                      placeholder={t("inventory.count.search.placeholder")}
                      placeholderTextColor={colors.faint}
                      returnKeyType="search"
                      style={styles.searchInput}
                    />
                  </View>
                </View>
                {visibleLines.length === 0 ? (
                  <View style={styles.emptyLines}>
                    <Package size={24} color={colors.faint} strokeWidth={2.25} />
                    <Text style={styles.emptyLinesTitle}>{t("inventory.count.emptyMatches.title")}</Text>
                    <Text style={styles.emptyLinesCopy}>{t("inventory.count.emptyMatches.body")}</Text>
                  </View>
                ) : (
                  <View style={styles.lineList}>
                    {visibleLines.map((line, index) => {
                      const countedRaw = draftCounts[line.inventory_item_id] ?? "";
                      const noteRaw = draftNotes[line.inventory_item_id] ?? "";
                      const counted =
                        countedRaw.trim() === "" ? null : parseNumber(countedRaw);
                      const variance =
                        counted == null || !Number.isFinite(counted)
                          ? null
                          : counted - line.system_quantity_at_start;
                      const editable =
                        canDraft && visibleDetail.session.status === "in_progress" && !saving;
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
                              placeholder={formatNumber(0, { useGrouping: false })}
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
                )}
              </SectionSurface>
            </MotionView>

            <View style={styles.actions}>
              {visibleDetail.session.status === "in_progress" && canDraft ? (
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
  progressCopy: {
    ...typography.body,
    color: colors.ink
  },
  lineControls: {
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  searchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0
  },
  emptyLines: {
    minHeight: 150,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },
  emptyLinesTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8
  },
  emptyLinesCopy: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: "center"
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
