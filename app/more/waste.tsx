import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, PackageMinus, Plus } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchWasteAnalysis,
  type WasteAnalysisSummary
} from "../../services/miseService";
import type {
  WasteAnalysisAction,
  WasteAnalysisStatus,
  WasteAnalysisTrend
} from "../../services/domain/wasteAnalysis";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function WasteScreen() {
  const { formatCompactCurrency, formatDate, formatNumber, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [analysis, setAnalysis] = useState<WasteAnalysisSummary | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setAnalysis(null);
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
      const nextAnalysis = await fetchWasteAnalysis(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setAnalysis(nextAnalysis);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "waste_analysis",
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

  const visibleAnalysis = loadedRestaurantId === restaurant?.id ? analysis : null;

  if (!restaurant) {
    return (
      <Screen title={t("waste.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("waste.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("waste.title")}
      subtitle={
        visibleAnalysis
          ? t("waste.subtitleDated", {
              days: formatNumber(visibleAnalysis.windowDays),
              date: visibleAnalysis.operatingDate
            })
          : t("waste.subtitle")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("waste.retry.title")}
            message={t("waste.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("waste.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {visibleAnalysis ? (
          <>
            <Card>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryCopy}>
                  <Text style={styles.metricLabel}>{t("waste.metric.estimatedCost")}</Text>
                  <Text style={styles.metricValue}>
                    {visibleAnalysis.estimatedCost === null
                      ? t("common.notSet")
                      : formatCompactCurrency(
                          visibleAnalysis.estimatedCost,
                          restaurant.currency
                        )}
                  </Text>
                </View>
                <Badge
                  label={t(wasteStatusKey(visibleAnalysis.status))}
                  tone={wasteStatusTone(visibleAnalysis.status)}
                />
              </View>
              <Text style={styles.summaryBody}>
                {wasteActionCopy(visibleAnalysis, t)}
              </Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={t("waste.metric.entriesValue", {
                    count: formatNumber(visibleAnalysis.eventCount)
                  })}
                  tone="neutral"
                />
                <Badge
                  label={t("waste.metric.itemsValue", {
                    count: formatNumber(visibleAnalysis.itemCount)
                  })}
                  tone="neutral"
                />
                <Badge
                  label={t(wasteTrendKey(visibleAnalysis.trend))}
                  tone={visibleAnalysis.trend === "up" ? "warning" : "neutral"}
                />
              </View>
              {!visibleAnalysis.costComplete && visibleAnalysis.eventCount > 0 ? (
                <Text style={styles.dataNote}>
                  {t("waste.cost.incomplete", {
                    count: formatNumber(visibleAnalysis.unpricedEventCount)
                  })}
                </Text>
              ) : null}
              <Button
                title={t("waste.action.record")}
                variant="secondary"
                size="compact"
                icon={<Plus size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/inventory")}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("waste.section.topItems")} />
            {visibleAnalysis.topItems.length === 0 ? (
              <EmptyState title={t("waste.empty.title")} body={t("waste.empty.body")} />
            ) : (
              <Card style={styles.listCard}>
                {visibleAnalysis.topItems.map((item) => (
                  <OperationalRow
                    key={item.inventoryItemId}
                    density="operational"
                    title={item.itemName}
                    subtitle={
                      item.quantity === null || item.canonicalUnit === null
                        ? t("waste.item.quantityUnavailable")
                        : t(
                            item.eventCount === 1
                              ? "waste.item.quantity.one"
                              : "waste.item.quantity.other",
                            {
                            quantity: formatNumber(item.quantity, {
                              maximumFractionDigits: 2
                            }),
                            unit: t(`inventory.ops.unit.${item.canonicalUnit}` as MessageKey),
                            entries: formatNumber(item.eventCount)
                            }
                          )
                    }
                    value={
                      item.estimatedCost === null
                        ? t("common.notSet")
                        : formatCompactCurrency(item.estimatedCost, restaurant.currency)
                    }
                    badgeLabel={
                      item.distinctDayCount >= 2
                        ? t("waste.item.repeated", {
                            days: formatNumber(item.distinctDayCount)
                          })
                        : undefined
                    }
                    badgeTone={item.distinctDayCount >= 2 ? "warning" : "neutral"}
                    icon={<PackageMinus size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
                    iconTone={item.distinctDayCount >= 2 ? "warning" : "neutral"}
                    onPress={() => router.push(`/inventory/${item.inventoryItemId}` as never)}
                    accessibilityLabel={t("waste.action.reviewItem", { item: item.itemName })}
                  />
                ))}
              </Card>
            )}

            <SectionHeader title={t("waste.section.recent")} />
            {visibleAnalysis.recentEvents.length === 0 ? (
              <Text style={styles.emptyLine}>{t("waste.recent.empty")}</Text>
            ) : (
              <View style={styles.recentList}>
                {visibleAnalysis.recentEvents.map((event) => (
                  <View key={event.id} style={styles.recentRow}>
                    <View style={styles.recentHeader}>
                      <Text style={styles.recentTitle}>
                        {event.itemName ?? t("waste.event.unknownItem")}
                      </Text>
                      <Text style={styles.recentCost}>
                        {event.estimatedCost === null
                          ? t("common.notSet")
                          : formatCompactCurrency(event.estimatedCost, restaurant.currency)}
                      </Text>
                    </View>
                    <Text style={styles.recentMeta}>
                      {t("waste.event.meta", {
                        quantity: formatNumber(event.quantity, { maximumFractionDigits: 2 }),
                        unit: t(`inventory.ops.unit.${event.canonicalUnit}` as MessageKey),
                        date: formatDate(event.effectiveAt, {
                          month: "short",
                          day: "numeric"
                        })
                      })}
                    </Text>
                    {event.note ? <Text style={styles.recentNote}>{event.note}</Text> : null}
                  </View>
                ))}
              </View>
            )}
            {visibleAnalysis.historyTruncated ? (
              <Text style={styles.dataNote}>{t("waste.historyTruncated")}</Text>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function wasteStatusKey(status: WasteAnalysisStatus): MessageKey {
  return `waste.status.${status}` as MessageKey;
}

function wasteTrendKey(trend: WasteAnalysisTrend): MessageKey {
  return `waste.trend.${trend}` as MessageKey;
}

function wasteStatusTone(status: WasteAnalysisStatus): BadgeTone {
  if (status === "attention") return "danger";
  if (status === "monitoring") return "success";
  return "neutral";
}

function wasteActionCopy(
  analysis: WasteAnalysisSummary,
  t: ReturnType<typeof useLocale>["t"]
) {
  const item = analysis.topItems.find(
    (entry) => entry.inventoryItemId === analysis.primaryItemId
  );
  const actionKeys: Record<WasteAnalysisAction, MessageKey> = {
    start_logging: "waste.actionCopy.start_logging",
    review_repeat_item: "waste.actionCopy.review_repeat_item",
    complete_cost_setup: "waste.actionCopy.complete_cost_setup",
    keep_logging: "waste.actionCopy.keep_logging"
  };
  return t(actionKeys[analysis.recommendedAction], {
    item: item?.itemName ?? t("waste.event.unknownItem")
  });
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  summaryCopy: {
    flex: 1,
    gap: 2
  },
  metricLabel: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  metricValue: {
    color: colors.text,
    ...typography.metricValue
  },
  summaryBody: {
    marginTop: 10,
    color: colors.text,
    ...typography.body
  },
  badgeRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  dataNote: {
    marginTop: 8,
    color: colors.faint,
    ...conceptTypography.caption
  },
  inlineAction: {
    marginTop: 12,
    alignSelf: "flex-start"
  },
  listCard: {
    paddingVertical: 0
  },
  emptyLine: {
    color: colors.muted,
    ...typography.body
  },
  recentList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  recentRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 3
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  recentTitle: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  recentCost: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  recentMeta: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  recentNote: {
    color: colors.faint,
    ...typography.body
  }
});
