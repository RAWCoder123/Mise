import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ClipboardList, Diff } from "lucide-react-native";
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
import {
  approveInventoryCountSession,
  beginInventoryCountSession,
  cancelInventoryCountSession,
  fetchOpenInventoryCountSession,
  saveInventoryCountLines,
  submitInventoryCountSession
} from "../../services/miseService";
import { canApproveInventoryCount, canDraftInventoryCount } from "../../services/tenantAccess";
import type { InventoryCountSessionDetail } from "../../types/mise";

export default function InventoryCountSessionScreen() {
  const { formatNumber, t } = useLocale();
  const { restaurant, memberships } = useMiseSession();
  const canDraft = canDraftInventoryCount(memberships, restaurant?.id ?? "");
  const canApprove = canApproveInventoryCount(memberships, restaurant?.id ?? "");
  const [detail, setDetail] = useState<InventoryCountSessionDetail | null>(null);
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const open = await fetchOpenInventoryCountSession(restaurant.id);
      if (requestId !== requestIdRef.current) return;
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
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError(t("inventory.count.loadError"));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [restaurant?.id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    setNotice(null);
  }, [restaurant?.id]);

  const progress = useMemo(
    () => summarizeCountSessionProgress(detail?.lines ?? []),
    [detail?.lines]
  );

  async function startSession() {
    if (!restaurant || !canDraft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await beginInventoryCountSession(restaurant.id);
      setDetail(next);
      setDraftCounts(
        Object.fromEntries(next.lines.map((line) => [line.inventory_item_id, ""]))
      );
      setDraftNotes(Object.fromEntries(next.lines.map((line) => [line.inventory_item_id, ""])));
      setNotice(t("inventory.count.started"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inventory.count.startError"));
    } finally {
      setSaving(false);
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

  function buildCountLinePayload(requireComplete: boolean) {
    if (!detail) return [];
    const lines = detail.lines
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
    if (requireComplete && lines.length !== detail.lines.length) {
      throw new Error(t("inventory.count.incomplete"));
    }
    return lines;
  }

  async function saveProgress() {
    if (!restaurant || !detail || !canDraft) return;
    let lines: Array<{ inventoryItemId: string; countedQuantity: number; note: string | null }>;
    try {
      lines = buildCountLinePayload(false);
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
      const next = await saveInventoryCountLines(restaurant.id, detail.session.id, lines);
      setDetail(next);
      syncDraftsFromDetail(next);
      setNotice(t("inventory.count.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inventory.count.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function submitSession() {
    if (!restaurant || !detail || !canDraft) return;
    setSaving(true);
    setError(null);
    try {
      const lines = buildCountLinePayload(true);
      await saveInventoryCountLines(restaurant.id, detail.session.id, lines);
      const next = await submitInventoryCountSession(restaurant.id, detail.session.id);
      setDetail(next);
      syncDraftsFromDetail(next);
      setNotice(t("inventory.count.submitted"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inventory.count.submitError"));
    } finally {
      setSaving(false);
    }
  }

  async function approveSession() {
    if (!restaurant || !detail || !canApprove) return;
    setSaving(true);
    setError(null);
    try {
      const next = await approveInventoryCountSession(restaurant.id, detail.session.id);
      setDetail(next);
      setNotice(t("inventory.count.approved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("inventory.count.approveError"));
    } finally {
      setSaving(false);
    }
  }

  function confirmCancel() {
    if (!restaurant || !detail || !canApprove) return;
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
              const next = await cancelInventoryCountSession(restaurant.id, detail.session.id);
              setDetail(next);
              setNotice(t("inventory.count.cancelled"));
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : t("inventory.count.cancelError"));
            } finally {
              setSaving(false);
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
    detail?.session.status === "submitted"
      ? t("inventory.count.status.submitted")
      : detail?.session.status === "approved"
        ? t("inventory.count.status.approved")
        : detail?.session.status === "cancelled"
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

        {!detail || detail.session.status === "approved" || detail.session.status === "cancelled" ? (
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
                padding="none"
              >
                <View style={styles.lineList}>
                  {detail.lines.map((line, index) => {
                    const countedRaw = draftCounts[line.inventory_item_id] ?? "";
                    const noteRaw = draftNotes[line.inventory_item_id] ?? "";
                    const counted = countedRaw.trim() === "" ? null : Number(countedRaw);
                    const variance =
                      counted == null || !Number.isFinite(counted)
                        ? null
                        : counted - line.system_quantity_at_start;
                    const editable =
                      canDraft && detail.session.status === "in_progress" && !saving;
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
              {detail.session.status === "in_progress" && canDraft ? (
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
              {detail.session.status === "submitted" && canApprove ? (
                <Button
                  title={t("inventory.count.approveAction")}
                  onPress={() => void approveSession()}
                  disabled={saving}
                  fullWidth
                />
              ) : null}
              {detail.session.status === "submitted" && !canApprove ? (
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
