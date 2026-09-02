import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, PackageMinus, Truck } from "lucide-react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  correctReceiptEvent,
  fetchCorrectableOperatorReceipts,
  type CorrectableOperatorReceipt
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { captureMiseError } from "../../services/telemetry";
import { canManageRestaurantData } from "../../services/tenantAccess";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function ReceiptCorrectScreen() {
  const { formatDate, formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [receipts, setReceipts] = useState<CorrectableOperatorReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [correctingEventId, setCorrectingEventId] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
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
    busy: submittingCorrection
  });

  useEffect(() => {
    requestIdRef.current += 1;
    setReceipts([]);
    setCorrectingEventId(null);
    setCorrectionNote("");
    setStatusMessage(null);
    setStatusIsError(false);
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
      const next = await fetchCorrectableOperatorReceipts(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
      setReceipts(next);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "receipt_correction",
        operation: "load",
        restaurant_id: restaurantId
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) {
        return;
      }
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

  const visibleReceipts = hubReady ? receipts : [];

  async function submitCorrection(receiptEventId: string) {
    if (!restaurant || !actionsEditable) return;
    if (!canManage || !hubReady) {
      setStatusMessage(t("receiptCorrect.readOnly"));
      setStatusIsError(true);
      return;
    }
    const note = correctionNote.trim();
    if (!note) {
      setStatusMessage(t("receiptCorrect.noteRequired"));
      setStatusIsError(true);
      return;
    }

    const restaurantId = restaurant.id;
    setSubmittingCorrection(true);
    setStatusMessage(null);
    setStatusIsError(false);
    try {
      const flushSummary = await correctReceiptEvent({
        restaurantId,
        receiptEventId,
        note,
        effectiveAt: new Date().toISOString()
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;

      if (flushSummary.conflicted > 0) {
        setStatusMessage(t("receiptCorrect.conflict"));
        setStatusIsError(true);
      } else if (flushSummary.rejected > 0) {
        setStatusMessage(t("receiptCorrect.rejected"));
        setStatusIsError(true);
      } else if (flushSummary.deferred > 0) {
        setStatusMessage(t("receiptCorrect.deferred"));
        setStatusIsError(false);
      } else if (flushSummary.accepted > 0) {
        setStatusMessage(t("receiptCorrect.success"));
        setStatusIsError(false);
      } else {
        setStatusMessage(t("receiptCorrect.queued"));
        setStatusIsError(false);
      }
      setCorrectingEventId(null);
      setCorrectionNote("");
      await load();
    } catch (submitError) {
      captureMiseError(submitError, {
        flow: "receipt_correction",
        operation: "correct",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setStatusMessage(
        submitError instanceof Error && submitError.message.trim()
          ? submitError.message.slice(0, 220)
          : t("receiptCorrect.error")
      );
      setStatusIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setSubmittingCorrection(false);
      }
    }
  }

  return (
    <Screen
      title={t("receiptCorrect.title")}
      subtitle={
        restaurant
          ? t("receiptCorrect.subtitle", { restaurant: restaurant.name })
          : t("receiptCorrect.subtitle.none")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("receiptCorrect.retry.title")}
            message={t("receiptCorrect.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("receiptCorrect.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {statusMessage ? (
          <StatusNotice title={statusMessage} tone={statusIsError ? "danger" : "success"} />
        ) : null}

        {!canManage && hubReady ? (
          <StatusNotice title={t("receiptCorrect.readOnly")} tone="neutral" />
        ) : null}

        <SectionHeader title={t("receiptCorrect.section.recent")} />
        {hubReady && visibleReceipts.length === 0 ? (
          <View style={styles.emptyBlock}>
            <EmptyState
              title={t("receiptCorrect.empty.title")}
              body={t("receiptCorrect.empty.body")}
            />
            <Button
              title={t("receiptCorrect.empty.action")}
              variant="secondary"
              size="compact"
              onPress={() => router.push("/more/log-delivery" as never)}
            />
          </View>
        ) : null}

        {visibleReceipts.length > 0 ? (
          <View style={styles.list}>
            {visibleReceipts.map((entry) => {
              const isCorrecting = correctingEventId === entry.event.id;
              const unitKey = `inventory.ops.unit.${entry.event.canonicalUnit}` as MessageKey;
              return (
                <View key={entry.event.id} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <View style={styles.iconWrap}>
                      <Truck size={icon.row} color={colors.text} strokeWidth={iconStroke} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{entry.itemName}</Text>
                      <Text style={styles.rowMeta}>
                        {t("receiptCorrect.event.meta", {
                          quantity: formatNumber(entry.event.quantity, {
                            maximumFractionDigits: 2
                          }),
                          unit: t(unitKey),
                          date: formatDate(entry.event.effectiveAt, {
                            month: "short",
                            day: "numeric"
                          })
                        })}
                      </Text>
                      {entry.note ? <Text style={styles.rowNote}>{entry.note}</Text> : null}
                    </View>
                  </View>

                  {canManage ? (
                    isCorrecting ? (
                      <View style={styles.correctPanel}>
                        <Text style={styles.correctLabel}>{t("receiptCorrect.noteLabel")}</Text>
                        <TextInput
                          value={correctionNote}
                          onChangeText={setCorrectionNote}
                          placeholder={t("receiptCorrect.notePlaceholder")}
                          placeholderTextColor={colors.faint}
                          editable={actionsEditable}
                          multiline
                          style={styles.correctInput}
                          accessibilityLabel={t("receiptCorrect.noteLabel")}
                        />
                        <View style={styles.correctActions}>
                          <Button
                            title={t("receiptCorrect.action.cancel")}
                            variant="ghost"
                            size="compact"
                            disabled={submittingCorrection}
                            onPress={() => {
                              setCorrectingEventId(null);
                              setCorrectionNote("");
                            }}
                          />
                          <Button
                            title={t("receiptCorrect.action.confirm")}
                            variant="secondary"
                            size="compact"
                            disabled={!actionsEditable}
                            onPress={() => void submitCorrection(entry.event.id)}
                          />
                        </View>
                      </View>
                    ) : (
                      <Button
                        title={t("receiptCorrect.action.correct")}
                        variant="ghost"
                        size="compact"
                        disabled={!actionsEditable || Boolean(correctingEventId)}
                        icon={
                          <PackageMinus
                            size={icon.inline}
                            color={colors.text}
                            strokeWidth={iconStroke}
                          />
                        }
                        onPress={() => {
                          setCorrectingEventId(entry.event.id);
                          setCorrectionNote("");
                          setStatusMessage(null);
                          setStatusIsError(false);
                        }}
                        style={styles.correctTrigger}
                        accessibilityLabel={t("receiptCorrect.action.correctAccessibility", {
                          item: entry.itemName
                        })}
                      />
                    )
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  emptyBlock: {
    gap: 10
  },
  list: {
    gap: 8
  },
  row: {
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  rowHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rowTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  rowMeta: {
    color: colors.muted,
    ...typography.caption
  },
  rowNote: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2
  },
  correctPanel: {
    gap: 8,
    paddingTop: 4
  },
  correctLabel: {
    color: colors.text,
    ...typography.caption
  },
  correctInput: {
    minHeight: 72,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    ...typography.body,
    textAlignVertical: "top"
  },
  correctActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  correctTrigger: {
    alignSelf: "flex-start"
  }
});
