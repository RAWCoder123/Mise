import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ClipboardList, Diff, Package, Search } from "lucide-react-native";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
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
import {
  buildInventoryCountLinePayload,
  presentInventoryCountFailureCopy,
  presentInventoryCountStartCopy,
  presentInventoryCountSuccessCopy,
  resolveInventoryCountFailureReason,
  resolveInventoryCountLoadState,
  type InventoryCountFailureReason,
  type InventoryCountMutation
} from "../../services/presentation/inventoryCountPresentation";
import { canApproveInventoryCount, canDraftInventoryCount } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { InventoryCountLine, InventoryCountSessionDetail } from "../../types/mise";

type CountNotice = {
  tone: StatusNoticeTone;
  title: string;
  message?: string;
};

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
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<CountNotice | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedRestaurantRef = useRef<string | null>(null);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  const failureCopy = useCallback(
    (fallbackMessage: string): Record<InventoryCountFailureReason, { title: string; message: string }> => ({
      alreadyOpen: {
        title: t("inventory.count.notice.alreadyOpenTitle"),
        message: t("inventory.count.notice.alreadyOpenBody")
      },
      noItems: {
        title: t("inventory.count.notice.noItemsTitle"),
        message: t("inventory.count.notice.noItemsBody")
      },
      capacity: {
        title: t("inventory.count.notice.capacityTitle"),
        message: t("inventory.count.notice.capacityBody")
      },
      notInProgress: {
        title: t("inventory.count.notice.notInProgressTitle"),
        message: t("inventory.count.notice.notInProgressBody")
      },
      notSubmitted: {
        title: t("inventory.count.notice.notSubmittedTitle"),
        message: t("inventory.count.notice.notSubmittedBody")
      },
      alreadyClosed: {
        title: t("inventory.count.notice.alreadyClosedTitle"),
        message: t("inventory.count.notice.alreadyClosedBody")
      },
      notFound: {
        title: t("inventory.count.notice.notFoundTitle"),
        message: t("inventory.count.notice.notFoundBody")
      },
      invalidLines: {
        title: t("inventory.count.notice.invalidLinesTitle"),
        message: t("inventory.count.notice.invalidLinesBody")
      },
      unknownLine: {
        title: t("inventory.count.notice.unknownLineTitle"),
        message: t("inventory.count.notice.unknownLineBody")
      },
      quantityBounds: {
        title: t("inventory.count.notice.quantityBoundsTitle"),
        message: t("inventory.count.notice.quantityBoundsBody")
      },
      noteBounds: {
        title: t("inventory.count.notice.noteBoundsTitle"),
        message: t("inventory.count.notice.noteBoundsBody")
      },
      incomplete: {
        title: t("inventory.count.notice.incompleteTitle"),
        message: t("inventory.count.incomplete")
      },
      saveEmpty: {
        title: t("inventory.count.notice.saveEmptyTitle"),
        message: t("inventory.count.saveEmpty")
      },
      invalidQuantity: {
        title: t("inventory.count.notice.invalidQuantityTitle"),
        message: t("inventory.count.notice.quantityBoundsBody")
      },
      permission: {
        title: t("inventory.count.notice.permissionTitle"),
        message: t("inventory.count.notice.permissionBody")
      },
      unknown: {
        title: t("inventory.count.notice.actionTitle"),
        message: fallbackMessage
      }
    }),
    [t]
  );

  const mutationFallback = useCallback(
    (mutation: InventoryCountMutation) => {
      switch (mutation) {
        case "start":
          return t("inventory.count.startError");
        case "save":
          return t("inventory.count.saveError");
        case "submit":
          return t("inventory.count.submitError");
        case "approve":
          return t("inventory.count.approveError");
        case "cancel":
          return t("inventory.count.cancelError");
      }
    },
    [t]
  );

  const setFailureNotice = useCallback(
    (reason: InventoryCountFailureReason, mutation: InventoryCountMutation, itemName?: string) => {
      if (reason === "invalidQuantity" && itemName) {
        setNotice({
          tone: "danger",
          title: t("inventory.count.notice.invalidQuantityTitle"),
          message: t("inventory.count.invalidQuantity", { item: itemName })
        });
        return;
      }
      setNotice(
        presentInventoryCountFailureCopy(reason, failureCopy(mutationFallback(mutation)))
      );
    },
    [failureCopy, mutationFallback, t]
  );

  const setSuccessNotice = useCallback(
    (mutation: InventoryCountMutation) => {
      setNotice(
        presentInventoryCountSuccessCopy(mutation, {
          start: t("inventory.count.started"),
          save: t("inventory.count.saved"),
          submit: t("inventory.count.submitted"),
          approve: t("inventory.count.approved"),
          cancel: t("inventory.count.cancelled")
        })
      );
    },
    [t]
  );

  const load = useCallback(async (showLoading = false) => {
    if (!restaurant) {
      setLoading(false);
      setLoadError(false);
      return;
    }
    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (showLoading || loadedRestaurantRef.current !== restaurantId) {
      setLoading(true);
    }
    setLoadError(false);
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
      loadedRestaurantRef.current = restaurantId;
      setLoadedRestaurantId(restaurantId);
    } catch (loadCaught) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadCaught, {
        flow: "inventory_count",
        operation: "load_open_session",
        restaurant_id: restaurantId
      });
      setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadedRestaurantRef.current = null;
    setLoadedRestaurantId(null);
    setDetail(null);
    setDraftCounts({});
    setDraftNotes({});
    setLineQuery("");
    setSaving(false);
    setLoadError(false);
    setNotice(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const hubLoadState = resolveInventoryCountLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError
  });
  const hubReady = hubLoadState === "ready";
  const visibleDetail = hubReady ? detail : null;
  const startPresentation = presentInventoryCountStartCopy(hubLoadState, {
    loadingTitle: t("inventory.count.startLoadingTitle"),
    loadingBody: t("inventory.count.startLoadingBody"),
    unavailableTitle: t("inventory.count.startUnavailableTitle"),
    unavailableBody: t("inventory.count.startUnavailableBody"),
    startTitle: t("inventory.count.startTitle"),
    startBody: t("inventory.count.startBody")
  });

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
      setSuccessNotice("start");
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(caught, {
        flow: "inventory_count",
        operation: "begin_count_session",
        restaurant_id: restaurantId
      });
      setFailureNotice(resolveInventoryCountFailureReason(caught), "start");
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

  async function saveProgress() {
    if (!restaurant || !visibleDetail || !canDraft) return;
    const restaurantId = restaurant.id;
    const payload = buildInventoryCountLinePayload({
      lines: visibleDetail.lines,
      draftCounts,
      draftNotes,
      parseNumber,
      requireComplete: false
    });
    if (!payload.ok) {
      if (payload.reason === "invalidQuantity") {
        setFailureNotice("invalidQuantity", "save", payload.item);
      } else if (payload.reason === "noteTooLong") {
        setFailureNotice("noteBounds", "save");
      } else {
        setFailureNotice(payload.reason, "save");
      }
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const next = await saveInventoryCountLines(restaurantId, visibleDetail.session.id, payload.lines);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      syncDraftsFromDetail(next);
      setLoadedRestaurantId(restaurantId);
      setSuccessNotice("save");
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(caught, {
        flow: "inventory_count",
        operation: "save_count_lines",
        restaurant_id: restaurantId
      });
      setFailureNotice(resolveInventoryCountFailureReason(caught), "save");
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function submitSession() {
    if (!restaurant || !visibleDetail || !canDraft) return;
    const restaurantId = restaurant.id;
    const payload = buildInventoryCountLinePayload({
      lines: visibleDetail.lines,
      draftCounts,
      draftNotes,
      parseNumber,
      requireComplete: true
    });
    if (!payload.ok) {
      if (payload.reason === "invalidQuantity") {
        setFailureNotice("invalidQuantity", "submit", payload.item);
      } else if (payload.reason === "noteTooLong") {
        setFailureNotice("noteBounds", "submit");
      } else {
        setFailureNotice(payload.reason === "saveEmpty" ? "incomplete" : payload.reason, "submit");
      }
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await saveInventoryCountLines(restaurantId, visibleDetail.session.id, payload.lines);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const next = await submitInventoryCountSession(restaurantId, visibleDetail.session.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      syncDraftsFromDetail(next);
      setLoadedRestaurantId(restaurantId);
      setSuccessNotice("submit");
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(caught, {
        flow: "inventory_count",
        operation: "submit_count_session",
        restaurant_id: restaurantId
      });
      setFailureNotice(resolveInventoryCountFailureReason(caught), "submit");
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setSaving(false);
    }
  }

  async function approveSession() {
    if (!restaurant || !visibleDetail || !canApprove) return;
    const restaurantId = restaurant.id;
    setSaving(true);
    setNotice(null);
    try {
      const next = await approveInventoryCountSession(restaurantId, visibleDetail.session.id);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setDetail(next);
      setLoadedRestaurantId(restaurantId);
      setSuccessNotice("approve");
    } catch (caught) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(caught, {
        flow: "inventory_count",
        operation: "approve_count_session",
        restaurant_id: restaurantId
      });
      setFailureNotice(resolveInventoryCountFailureReason(caught), "approve");
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
            setNotice(null);
            try {
              const next = await cancelInventoryCountSession(restaurantId, sessionId);
              if (activeRestaurantIdRef.current !== restaurantId) return;
              setDetail(next);
              setLoadedRestaurantId(restaurantId);
              setSuccessNotice("cancel");
            } catch (caught) {
              if (activeRestaurantIdRef.current !== restaurantId) return;
              captureMiseError(caught, {
                flow: "inventory_count",
                operation: "cancel_count_session",
                restaurant_id: restaurantId
              });
              setFailureNotice(resolveInventoryCountFailureReason(caught), "cancel");
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
        {loadError ? (
          <RetryNotice
            title={t("inventory.count.retryTitle")}
            message={t("inventory.count.loadError")}
            onRetry={() => void load(true)}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("inventory.count.retryAccessibility")}
          />
        ) : null}
        {!loadError && notice ? (
          <StatusNotice tone={notice.tone} title={notice.title} message={notice.message} />
        ) : null}

        {!hubReady ||
        !visibleDetail ||
        visibleDetail.session.status === "approved" ||
        visibleDetail.session.status === "cancelled" ? (
          <MotionView distance={3} duration={240}>
            <SectionSurface
              title={startPresentation.title}
              subtitle={startPresentation.body}
            >
              {startPresentation.canStart ? (
                <Button
                  title={t("inventory.count.startAction")}
                  onPress={() => void startSession()}
                  disabled={!canDraft || saving}
                  fullWidth
                  accessibilityLabel={t("inventory.count.startAccessibility")}
                />
              ) : null}
              {startPresentation.canStart && !canDraft ? (
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
