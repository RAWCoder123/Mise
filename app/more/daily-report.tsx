import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Minus,
  Package,
  PackageMinus,
  ShoppingBag,
  Sparkles,
  Truck
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import type { MessageKey } from "../../i18n/catalog";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { DailyCloseoutCelebration } from "../../components/operations/DailyCloseoutCelebration";
import { Badge } from "../../components/ui/Badge";
import type { BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import {
  fetchDailyOpsReport,
  type DailyOpsReport
} from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";
import type {
  SupplierReliabilityReason,
  SupplierReliabilityStatus
} from "../../services/domain/supplierReliability";
import type {
  WasteAnalysisAction,
  WasteAnalysisStatus
} from "../../services/domain/wasteAnalysis";
import { presentDailyReportMemory } from "../../services/presentation/dailyReportMemoryLabel";
import type { AppLocale } from "../../i18n/catalog";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function DailyReportScreen() {
  const { formatCompactCurrency, formatNumber, locale, t } = useLocale();
  const { restaurant } = useMiseSession();
  const [report, setReport] = useState<DailyOpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setReport(null);
    setLoadedRestaurantId(null);
    setError(false);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id, locale]);

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
      const nextReport = await fetchDailyOpsReport(restaurantId, { locale });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setReport(nextReport);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "daily_report",
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
  }, [restaurant?.id, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visibleReport = loadedRestaurantId === restaurant?.id ? report : null;

  if (!restaurant) {
    return (
      <Screen title={t("dailyReport.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("dailyReport.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("dailyReport.title")}
      subtitle={
        visibleReport
          ? t("dailyReport.subtitleDated", { date: visibleReport.day.operatingDate })
          : t("dailyReport.subtitle")
      }
      titleAlign="center"
      leadingAction={<BackAction />}
      loading={loading}
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("dailyReport.retry.title")}
            message={t("dailyReport.retry.body")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("dailyReport.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {visibleReport ? (
          <>
            <DailyCloseoutCelebration
              restaurantId={restaurant.id}
              summary={visibleReport.closeout}
            />
            <Card>
              <Text style={styles.closeoutEyebrow}>{t("dailyReport.closeout.eyebrow")}</Text>
              <Text style={styles.closeoutTitle}>{visibleReport.day.restaurantName}</Text>
              <Text style={styles.summaryCopy}>{visibleReport.day.operatingSummary}</Text>
              <View style={styles.badgeRow}>
                <Badge label={visibleReport.day.miseStatus} tone="warning" />
                <Badge
                  label={t("dailyReport.closeout.dateBadge", {
                    date: visibleReport.day.operatingDate
                  })}
                  tone="neutral"
                />
              </View>
            </Card>

            <SectionHeader title={t("dailyReport.section.sales")} />
            <Card>
              <View style={styles.metricGrid}>
                <Metric
                  label={t("dailyReport.metric.sales")}
                  value={formatCompactCurrency(
                    visibleReport.sales.salesToday,
                    visibleReport.day.restaurantCurrency
                  )}
                />
                <Metric
                  label={t("dailyReport.metric.netSales")}
                  value={formatCompactCurrency(
                    visibleReport.sales.netSalesToday,
                    visibleReport.day.restaurantCurrency
                  )}
                />
                <Metric
                  label={t("dailyReport.metric.itemsSold")}
                  value={formatNumber(visibleReport.sales.itemsSold)}
                />
                <Metric
                  label={t("dailyReport.metric.trend")}
                  value={
                    visibleReport.sales.salesTrendDirection == null
                      ? t("dailyReport.trend.unavailable")
                      : formatCompactCurrency(
                          Math.abs(visibleReport.sales.salesTrendDelta ?? 0),
                          visibleReport.day.restaurantCurrency
                        )
                  }
                  accessory={
                    visibleReport.sales.salesTrendDirection === "up" ? (
                      <ArrowUpRight size={icon.inline} color={colors.success} strokeWidth={iconStroke} />
                    ) : visibleReport.sales.salesTrendDirection === "down" ? (
                      <ArrowDownRight size={icon.inline} color={colors.danger} strokeWidth={iconStroke} />
                    ) : (
                      <Minus size={icon.inline} color={colors.muted} strokeWidth={iconStroke} />
                    )
                  }
                />
              </View>
              {visibleReport.sales.topItems.length > 0 ? (
                <View style={styles.topItems}>
                  <Text style={styles.blockLabel}>{t("dailyReport.sales.topItems")}</Text>
                  {visibleReport.sales.topItems.map((item) => (
                    <Text key={`${item.itemName}-${item.quantitySold}`} style={styles.topItemLine}>
                      {t("dailyReport.sales.topItemLine", {
                        item: item.itemName,
                        qty: formatNumber(item.quantitySold),
                        sales: formatCompactCurrency(
                          item.grossSales,
                          visibleReport.day.restaurantCurrency
                        )
                      })}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>

            <SectionHeader title={t("dailyReport.section.stock")} />
            <Card>
              <View style={styles.healthRow}>
                <Badge
                  label={`${t("inventory.health.critical")} ${visibleReport.inventoryRisk.health.critical}`}
                  tone="danger"
                />
                <Badge
                  label={`${t("inventory.health.low")} ${visibleReport.inventoryRisk.health.low}`}
                  tone="warning"
                />
                <Badge
                  label={`${t("inventory.health.watch")} ${visibleReport.inventoryRisk.health.watch}`}
                  tone="caution"
                />
                <Badge
                  label={`${t("inventory.health.good")} ${visibleReport.inventoryRisk.health.good}`}
                  tone="success"
                />
              </View>
              <Text style={styles.summaryCopy}>
                {visibleReport.inventoryRisk.alerts > 0
                  ? t("dailyReport.stock.attentionBody", {
                      count: formatNumber(visibleReport.inventoryRisk.alerts)
                    })
                  : t("dailyReport.stock.clearBody")}
              </Text>
              {visibleReport.inventoryRisk.estimatedDollarsAtRisk != null ? (
                <Text style={styles.riskLine}>
                  {t("dailyReport.stock.dollarsAtRisk", {
                    amount: formatCompactCurrency(
                      visibleReport.inventoryRisk.estimatedDollarsAtRisk,
                      visibleReport.day.restaurantCurrency
                    )
                  })}
                </Text>
              ) : null}
              <Button
                title={t("dailyReport.action.inventory")}
                variant="secondary"
                size="compact"
                icon={<Package size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/inventory")}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("dailyReport.section.waste")} />
            <Card>
              {visibleReport.wasteAnalysis ? (
                <>
                  <View style={styles.signalHeader}>
                    <Text style={styles.signalType}>
                      {t("dailyReport.waste.window", {
                        days: formatNumber(visibleReport.wasteAnalysis.windowDays)
                      })}
                    </Text>
                    <Badge
                      label={t(wasteStatusKey(visibleReport.wasteAnalysis.status))}
                      tone={wasteStatusTone(visibleReport.wasteAnalysis.status)}
                    />
                  </View>
                  <View style={styles.metricGrid}>
                    <Metric
                      label={t("waste.metric.estimatedCost")}
                      value={
                        visibleReport.wasteAnalysis.estimatedCost === null
                          ? t("common.notSet")
                          : formatCompactCurrency(
                              visibleReport.wasteAnalysis.estimatedCost,
                              visibleReport.day.restaurantCurrency
                            )
                      }
                    />
                    <Metric
                      label={t("waste.metric.entries")}
                      value={formatNumber(visibleReport.wasteAnalysis.eventCount)}
                    />
                  </View>
                  <Text style={styles.summaryCopy}>
                    {dailyWasteActionCopy(visibleReport.wasteAnalysis, t)}
                  </Text>
                  {visibleReport.wasteAnalysis.topItems[0] ? (
                    <Text style={styles.metaLine}>
                      {t("dailyReport.waste.topItem", {
                        item: visibleReport.wasteAnalysis.topItems[0].itemName,
                        entries: formatNumber(
                          visibleReport.wasteAnalysis.topItems[0].eventCount
                        )
                      })}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.summaryCopy}>{t("dailyReport.waste.unavailable")}</Text>
              )}
              <Button
                title={t("dailyReport.waste.action")}
                variant="secondary"
                size="compact"
                icon={<PackageMinus size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/more/waste" as never)}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("dailyReport.section.ordering")} />
            <Card>
              <Text style={styles.taskLine}>
                {t("dailyReport.ordering.pending", {
                  count: formatNumber(visibleReport.ordering.pendingRecommendations)
                })}
              </Text>
              <Button
                title={t("dailyReport.action.orders")}
                variant="secondary"
                size="compact"
                icon={<ShoppingBag size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/orders")}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("dailyReport.section.throughput")} />
            <Card>
              <Text style={styles.taskLine}>
                {t("dailyReport.throughput.openWorkflow", {
                  count: formatNumber(visibleReport.throughput.openTasks)
                })}
              </Text>
              <Text style={styles.taskLine}>
                {t("dailyReport.throughput.completed", {
                  count: formatNumber(visibleReport.throughput.completedTasks)
                })}
              </Text>
              <Text style={styles.taskLine}>
                {t("dailyReport.throughput.operatorOpen", {
                  count: formatNumber(visibleReport.throughput.operatorTasksOpen)
                })}
              </Text>
              <Button
                title={t("dailyReport.action.today")}
                variant="secondary"
                size="compact"
                icon={<ClipboardList size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/today")}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("dailyReport.section.deliveries")} />
            <Card>
              <View style={styles.deliveryHeader}>
                <Truck size={icon.row} color={colors.text} strokeWidth={iconStroke} />
                <Text style={styles.taskLine}>
                  {t("dailyReport.deliveries.count", {
                    count: formatNumber(visibleReport.deliveriesToday.count)
                  })}
                </Text>
              </View>
              {visibleReport.deliveriesToday.lines.length === 0 ? (
                <Text style={styles.summaryCopy}>{t("dailyReport.deliveries.empty")}</Text>
              ) : (
                visibleReport.deliveriesToday.lines.map((line) => (
                  <Text key={line.id} style={styles.topItemLine}>
                    {t("dailyReport.deliveries.line", {
                      item: line.itemName,
                      qty:
                        line.quantity != null
                          ? `${formatNumber(line.quantity)}${line.unit ? ` ${line.unit}` : ""}`
                          : t("common.notSet")
                    })}
                  </Text>
                ))
              )}
            </Card>

            <SectionHeader title={t("dailyReport.section.supplierReliability")} />
            <Card>
              {visibleReport.supplierReliability.suppliers.length === 0 ? (
                <Text style={styles.summaryCopy}>
                  {t("dailyReport.supplierReliability.empty")}
                </Text>
              ) : (
                <>
                  <Text style={styles.taskLine}>
                    {visibleReport.supplierReliability.attentionSupplierCount > 0
                      ? t(
                          visibleReport.supplierReliability.attentionSupplierCount === 1
                            ? "dailyReport.supplierReliability.attention.one"
                            : "dailyReport.supplierReliability.attention.other",
                          {
                            count: formatNumber(
                              visibleReport.supplierReliability.attentionSupplierCount
                            )
                          }
                        )
                      : t("dailyReport.supplierReliability.clear")}
                  </Text>
                  <View style={styles.healthRow}>
                    <Badge
                      label={t("dailyReport.supplierReliability.metric.deliveries", {
                        count: formatNumber(visibleReport.supplierReliability.totalDeliveries)
                      })}
                      tone="neutral"
                    />
                    {visibleReport.supplierReliability.overallOnTimeRate != null ? (
                      <Badge
                        label={t("dailyReport.supplierReliability.metric.onTime", {
                          percent: formatNumber(
                            visibleReport.supplierReliability.overallOnTimeRate * 100,
                            { maximumFractionDigits: 0 }
                          )
                        })}
                        tone={
                          visibleReport.supplierReliability.overallOnTimeRate >= 0.9
                            ? "success"
                            : "warning"
                        }
                      />
                    ) : null}
                    {visibleReport.supplierReliability.overallMatchedDeliveryRate != null ? (
                      <Badge
                        label={t("dailyReport.supplierReliability.metric.matched", {
                          percent: formatNumber(
                            visibleReport.supplierReliability.overallMatchedDeliveryRate * 100,
                            { maximumFractionDigits: 0 }
                          )
                        })}
                        tone={
                          visibleReport.supplierReliability.overallMatchedDeliveryRate >= 0.9
                            ? "success"
                            : "warning"
                        }
                      />
                    ) : null}
                  </View>
                  <View style={styles.reliabilityList}>
                    {visibleReport.supplierReliability.suppliers.map((supplier) => (
                      <View key={supplier.supplierId} style={styles.reliabilityRow}>
                        <View style={styles.signalHeader}>
                          <Text style={styles.signalType}>{supplier.supplierName}</Text>
                          <Badge
                            label={t(reliabilityStatusKey(supplier.status))}
                            tone={reliabilityTone(supplier.status)}
                          />
                        </View>
                        <Text style={styles.topItemLine}>
                          {t("dailyReport.supplierReliability.row", {
                            deliveries: formatNumber(supplier.deliveryCount),
                            onTime:
                              supplier.onTimeRate == null
                                ? t("common.notSet")
                                : `${formatNumber(supplier.onTimeRate * 100, {
                                    maximumFractionDigits: 0
                                  })}%`,
                            matched: `${formatNumber(supplier.matchedDeliveryRate * 100, {
                              maximumFractionDigits: 0
                            })}%`
                          })}
                        </Text>
                        <Text style={styles.metaLine}>
                          {t(reliabilityReasonKey(supplier.reasons[0] ?? "limited_history"))}
                        </Text>
                        {(supplier.status === "at_risk" || supplier.status === "watch") &&
                        supplier.relatedOrderIds[0] ? (
                          <Button
                            title={t("dailyReport.supplierReliability.reviewOrder")}
                            variant="secondary"
                            size="compact"
                            icon={<ArrowRight size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                            onPress={() =>
                              router.push(`/orders/${supplier.relatedOrderIds[0]}` as never)
                            }
                            style={styles.reliabilityAction}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </>
              )}
              <Button
                title={t("dailyReport.supplierReliability.action")}
                variant="secondary"
                size="compact"
                icon={<ShoppingBag size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                onPress={() => router.push("/orders")}
                style={styles.inlineAction}
              />
            </Card>

            <SectionHeader title={t("dailyReport.section.signals")} />
            <Card>
              {visibleReport.signalsByType.map((signal) => (
                <View key={signal.type} style={styles.signalRow}>
                  <View style={styles.signalHeader}>
                    <Text style={styles.signalType}>
                      {t(`dailyReport.signal.${signal.type}` as MessageKey)}
                    </Text>
                    {signal.severity ? (
                      <Badge
                        label={t(
                          signal.severity === "urgent"
                            ? "dailyReport.severity.urgent"
                            : signal.severity === "warning"
                              ? "dailyReport.severity.warning"
                              : "dailyReport.severity.info"
                        )}
                        tone={
                          signal.severity === "urgent"
                            ? "danger"
                            : signal.severity === "warning"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    ) : null}
                  </View>
                  <Text style={styles.signalLine}>{signal.line}</Text>
                </View>
              ))}
            </Card>

            <SectionHeader title={t("dailyReport.section.learning")} />
            <LearningMemoryCard learning={visibleReport.learning} locale={locale} t={t} formatNumber={formatNumber} />

            <SectionHeader title={t("dailyReport.section.advice")} />
            <Card>
              {visibleReport.managerAdvice.askBriefingText ? (
                <View style={styles.briefingBlock}>
                  <Sparkles size={icon.inline} color={colors.accent} strokeWidth={iconStroke} />
                  <Text style={styles.briefingText}>{visibleReport.managerAdvice.askBriefingText}</Text>
                </View>
              ) : null}
              {visibleReport.managerAdvice.actions.map((action) => (
                <View key={action.id} style={styles.adviceRow}>
                  <View style={styles.adviceCopy}>
                    <Text style={styles.adviceTitle}>{action.title}</Text>
                    <Text style={styles.summaryCopy}>{action.detail}</Text>
                  </View>
                  <Button
                    title={t("dailyReport.advice.open")}
                    variant="secondary"
                    size="compact"
                    icon={<ArrowRight size={icon.inline} color={colors.text} strokeWidth={iconStroke} />}
                    onPress={() => router.push(action.route)}
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function LearningMemoryCard({
  learning,
  locale,
  t,
  formatNumber
}: {
  learning: DailyOpsReport["learning"];
  locale: AppLocale;
  t: ReturnType<typeof useLocale>["t"];
  formatNumber: ReturnType<typeof useLocale>["formatNumber"];
}) {
  const presented = presentDailyReportMemory(locale, learning);
  return (
    <Card>
      <Text style={styles.blockLabel}>{learning.credibilityLabel}</Text>
      <Text style={styles.summaryCopy}>
        {t("dailyReport.learning.score", {
          score: formatNumber(learning.credibilityScore)
        })}
      </Text>
      {presented.memoryCopy ? <Text style={styles.summaryCopy}>{presented.memoryCopy}</Text> : null}
      <Text style={styles.metaLine}>
        {presented.memoryNextStep ?? learning.credibilityNextStep}
      </Text>
    </Card>
  );
}

function reliabilityStatusKey(status: SupplierReliabilityStatus): MessageKey {
  return `dailyReport.supplierReliability.status.${status}` as MessageKey;
}

function reliabilityReasonKey(reason: SupplierReliabilityReason): MessageKey {
  return `dailyReport.supplierReliability.reason.${reason}` as MessageKey;
}

function reliabilityTone(status: SupplierReliabilityStatus): BadgeTone {
  if (status === "at_risk") return "danger";
  if (status === "watch") return "warning";
  if (status === "reliable") return "success";
  return "neutral";
}

function wasteStatusKey(status: WasteAnalysisStatus): MessageKey {
  return `waste.status.${status}` as MessageKey;
}

function wasteStatusTone(status: WasteAnalysisStatus): BadgeTone {
  if (status === "attention") return "danger";
  if (status === "monitoring") return "success";
  return "neutral";
}

function dailyWasteActionCopy(
  analysis: NonNullable<DailyOpsReport["wasteAnalysis"]>,
  t: ReturnType<typeof useLocale>["t"]
) {
  const item = analysis.topItems.find(
    (entry) => entry.inventoryItemId === analysis.primaryItemId
  );
  const keys: Record<WasteAnalysisAction, MessageKey> = {
    start_logging: "waste.actionCopy.start_logging",
    review_repeat_item: "waste.actionCopy.review_repeat_item",
    complete_cost_setup: "waste.actionCopy.complete_cost_setup",
    keep_logging: "waste.actionCopy.keep_logging"
  };
  return t(keys[analysis.recommendedAction], {
    item: item?.itemName ?? t("waste.event.unknownItem")
  });
}

function Metric({
  label,
  value,
  accessory
}: {
  label: string;
  value: string;
  accessory?: ReactNode;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {accessory}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  closeoutEyebrow: {
    color: colors.accent,
    ...conceptTypography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4
  },
  closeoutTitle: {
    color: colors.text,
    ...typography.screenTitle
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  metric: {
    width: "47%",
    gap: 4
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metricValue: {
    color: colors.text,
    ...typography.metricValue
  },
  metricLabel: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  summaryCopy: {
    marginTop: 10,
    color: colors.muted,
    ...typography.body
  },
  healthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  riskLine: {
    marginTop: 8,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  inlineAction: {
    marginTop: 12,
    alignSelf: "flex-start"
  },
  taskLine: {
    color: colors.text,
    ...typography.body,
    marginBottom: 6
  },
  topItems: {
    marginTop: 12,
    gap: 4
  },
  blockLabel: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginBottom: 4
  },
  topItemLine: {
    color: colors.muted,
    ...typography.body
  },
  deliveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  reliabilityList: {
    marginTop: 10
  },
  reliabilityRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  reliabilityAction: {
    marginTop: 8,
    alignSelf: "flex-start"
  },
  signalRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4
  },
  signalType: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    textTransform: "capitalize"
  },
  signalLine: {
    color: colors.muted,
    ...typography.body
  },
  metaLine: {
    marginTop: 8,
    color: colors.faint,
    ...conceptTypography.caption
  },
  briefingBlock: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "flex-start"
  },
  briefingText: {
    flex: 1,
    color: colors.text,
    ...typography.body
  },
  adviceRow: {
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  adviceCopy: {
    gap: 2
  },
  adviceTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  }
});
