import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { AlertTriangle, BarChart3, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, RefreshCw } from "lucide-react-native";

import { DailyBriefBoard } from "../../components/dailyBrief/DailyBriefBoard";
import { ActionIcon } from "../../components/ui/ActionIcon";
import { DonutChart, donutPaletteColor } from "../../components/ui/DonutChart";
import { MotionView, StateChangeView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { TrendLineChart } from "../../components/ui/TrendLineChart";
import { colors, conceptTypography, fontFamilies, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type { DailyOperationalBrief, OperationalFinding } from "../../services/domain/operationalFindings";
import type { OperationalFindingDecisionType } from "../../services/domain/operationalFindingDecisions";
import type { InsightsSalesAnalytics } from "../../services/domain/insightsSalesAnalytics";
import {
  fetchDailyOperationalBrief,
  fetchInsights,
  fetchInsightsSalesAnalytics,
  fetchInsightsSalesTrend,
  fetchLearningMemorySummary,
  fetchQueuedOperationalFindingDecisions,
  flushQueuedOperationalFindingDecisions,
  generateInsightsFromSalesAndInventory,
  queueOperationalFindingDecision,
  summarizeInsights
} from "../../services/miseService";
import {
  presentInsight,
  presentLearningMemory,
  presentLearningMemorySignal
} from "../../services/presentation/operationsPresentation";
import { buildConciseTrendDateLabels } from "../../services/presentation/salesTrendLabels";
import { canManageRestaurantData } from "../../services/tenantAccess";
import type { InsightsSalesTrendPoint } from "../../services/miseService";
import type {
  Insight,
  InsightSeverity,
  LearningMemorySignal,
  LearningMemorySummary,
  RestaurantServiceStyle
} from "../../types/mise";

type InsightFilter = "all" | InsightSeverity;
type InsightsSurface = "sales" | "signals";

export default function InsightsScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [brief, setBrief] = useState<DailyOperationalBrief | null>(null);
  const [findingQueue, setFindingQueue] = useState<FindingDecisionOutboxEntry[]>([]);
  const [memory, setMemory] = useState<LearningMemorySummary | null>(null);
  const [salesTrend, setSalesTrend] = useState<InsightsSalesTrendPoint[]>([]);
  const [salesAnalytics, setSalesAnalytics] = useState<InsightsSalesAnalytics | null>(null);
  const [surface, setSurface] = useState<InsightsSurface>("signals");
  const [filter, setFilter] = useState<InsightFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const [briefMessageIsError, setBriefMessageIsError] = useState(false);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    hasLoaded.current = false;
    setLoadedRestaurantId(null);
    setInsights([]);
    setBrief(null);
    setFindingQueue([]);
    setMemory(null);
    setSalesTrend([]);
    setSalesAnalytics(null);
    setSurface("signals");
    setFilter("all");
    setError(false);
    setBriefMessage(null);
    setBriefMessageIsError(false);
    setBusyFindingId(null);
    setLoading(Boolean(restaurant));
    setRefreshing(false);
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    if (!hasLoaded.current) setLoading(true);
    setError(false);
    try {
      await flushQueuedOperationalFindingDecisions(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

      const [nextInsights, nextMemory, nextSalesTrend, nextAnalytics, nextBrief, nextQueue] =
        await Promise.all([
          fetchInsights(restaurantId),
          fetchLearningMemorySummary(restaurantId),
          fetchInsightsSalesTrend(restaurantId),
          fetchInsightsSalesAnalytics(restaurantId),
          fetchDailyOperationalBrief(restaurantId),
          fetchQueuedOperationalFindingDecisions(restaurantId)
        ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setInsights(nextInsights);
      setMemory(nextMemory);
      setSalesTrend(nextSalesTrend);
      setSalesAnalytics(nextAnalytics);
      setBrief(nextBrief);
      setFindingQueue(nextQueue);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) {
        hasLoaded.current = true;
        setLoading(false);
      }
    }
  }, [restaurant?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => subscription.remove();
  }, [load]);

  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  async function submitFindingFeedback(
    finding: OperationalFinding,
    decisionType: OperationalFindingDecisionType,
    editedRecommendedAction?: string
  ) {
    if (!restaurant || !canManage || busyFindingId) return;
    const restaurantId = restaurant.id;
    setBusyFindingId(finding.id);
    setBriefMessage(null);
    setBriefMessageIsError(false);
    try {
      await queueOperationalFindingDecision({
        finding,
        decisionType,
        editedRecommendedAction: decisionType === "edited" ? editedRecommendedAction : null
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const flushSummary = await flushQueuedOperationalFindingDecisions(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      await load();
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setBriefMessage(describeFindingFlush(flushSummary, t));
      setBriefMessageIsError(flushSummary.conflicted > 0 || flushSummary.rejected > 0);
    } catch {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setBriefMessage(t("dailyBrief.result.error"));
      setBriefMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyFindingId(null);
    }
  }

  const refreshInsights = useCallback(async () => {
    if (!restaurant || refreshing || !canManage) return;

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setError(false);
    try {
      await generateInsightsFromSalesAndInventory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      const [nextInsights, nextMemory, nextSalesTrend, nextAnalytics, nextBrief, nextQueue] =
        await Promise.all([
          fetchInsights(restaurantId),
          fetchLearningMemorySummary(restaurantId),
          fetchInsightsSalesTrend(restaurantId),
          fetchInsightsSalesAnalytics(restaurantId),
          fetchDailyOperationalBrief(restaurantId),
          fetchQueuedOperationalFindingDecisions(restaurantId)
        ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setInsights(nextInsights);
      setMemory(nextMemory);
      setSalesTrend(nextSalesTrend);
      setSalesAnalytics(nextAnalytics);
      setBrief(nextBrief);
      setFindingQueue(nextQueue);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setRefreshing(false);
    }
  }, [canManage, refreshing, restaurant?.id]);

  const visibleInsights = loadedRestaurantId === restaurant?.id ? insights : [];
  const visibleBrief = loadedRestaurantId === restaurant?.id ? brief : null;
  const visibleFindingQueue = loadedRestaurantId === restaurant?.id ? findingQueue : [];
  const visibleMemory = loadedRestaurantId === restaurant?.id ? memory : null;
  const visibleSalesTrend = loadedRestaurantId === restaurant?.id ? salesTrend : [];
  const visibleSalesAnalytics =
    loadedRestaurantId === restaurant?.id ? salesAnalytics : null;

  const summary = useMemo(() => {
    if (!restaurant) return null;
    return summarizeInsights(restaurant.id, visibleInsights);
  }, [restaurant, visibleInsights]);

  const filteredInsights = useMemo(
    () => (filter === "all" ? visibleInsights : visibleInsights.filter((insight) => insight.severity === filter)),
    [filter, visibleInsights]
  );

  const insightFilters = useMemo(
    () => [
      { value: "all" as const, label: t("insights.filter.all"), accessibilityLabel: t("insights.filter.allAccessibility"), tone: "brand" as const },
      { value: "urgent" as const, label: t("insights.filter.urgent"), accessibilityLabel: t("insights.filter.urgentAccessibility"), tone: "danger" as const },
      { value: "warning" as const, label: t("insights.filter.watch"), accessibilityLabel: t("insights.filter.watchAccessibility"), tone: "caution" as const },
      { value: "info" as const, label: t("insights.filter.info"), accessibilityLabel: t("insights.filter.infoAccessibility"), tone: "neutral" as const }
    ],
    [t]
  );

  const surfaceOptions = useMemo(
    () => [
      {
        value: "signals" as const,
        label: t("insights.surface.signals"),
        accessibilityLabel: t("insights.surface.signalsAccessibility"),
        tone: "brand" as const
      },
      {
        value: "sales" as const,
        label: t("insights.surface.sales"),
        accessibilityLabel: t("insights.surface.salesAccessibility"),
        tone: "brand" as const
      }
    ],
    [t]
  );

  const summaryTitle = summary
    ? summary.urgentCount > 0
      ? t("insights.summary.urgent")
      : summary.warningCount > 0
        ? t("insights.summary.watch")
        : summary.signalCount > 0
          ? t("insights.summary.learning")
          : t("insights.summary.waiting")
    : t("insights.summary.waiting");
  const summaryBody = summary && summary.signalCount > 0
    ? t(summary.signalCount === 1 ? "insights.summary.withSignals.one" : "insights.summary.withSignals.other", {
        count: formatNumber(summary.signalCount)
      })
    : t("insights.summary.empty");
  const infoCount = visibleInsights.filter((insight) => insight.severity === "info").length;
  const nextStep = summary
    ? summary.urgentCount > 0
      ? t("insights.nextStep.urgent")
      : summary.warningCount > 0
        ? t("insights.nextStep.watch")
        : summary.signalCount > 0
          ? t("insights.nextStep.signals")
          : t("insights.nextStep.empty")
    : t("insights.nextStep.empty");
  const serviceLabel = restaurant ? serviceStyleLabel(restaurant.service_style, t) : null;
  const subtitle = restaurant
    ? t("insights.subtitleRestaurantStyle", {
        restaurant: restaurant.name,
        style: serviceLabel ?? restaurant.cuisine_type ?? t("settings.profile.cuisineFallback")
      })
    : t("insights.subtitle");

  return (
    <Screen
      title={t("insights.title")}
      subtitle={subtitle}
      loading={loading}
      action={
        restaurant && canManage ? (
          <ActionIcon
            accessibilityLabel={refreshing ? t("insights.refreshing") : t("insights.refresh")}
            accessibilityHint={t("insights.refreshHint")}
            accessibilityState={{ disabled: refreshing }}
            disabled={refreshing}
            onPress={() => void refreshInsights()}
            tone="brand"
          >
            <RefreshCw size={icon.emphasis} color={colors.accentDark} strokeWidth={iconStroke} />
          </ActionIcon>
        ) : undefined
      }
    >
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("insights.refreshError")}
            message={t("insights.loadError")}
            onRetry={() => void load()}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("insights.retry.accessibility")}
          />
        ) : null}

        <SegmentedControl
          accessibilityLabel={t("insights.surface.accessibility")}
          options={surfaceOptions}
          value={surface}
          onValueChange={setSurface}
          variant="pills"
        />

        {surface === "sales" ? (
          <MotionView key="sales" delay={20} distance={4}>
            <View style={styles.stack}>
              <SalesTrend points={visibleSalesTrend} currency={restaurant?.currency} />
              <SalesAnalyticsBoard
                analytics={visibleSalesAnalytics}
                currency={restaurant?.currency}
                serviceStyle={restaurant?.service_style ?? null}
                cuisineType={restaurant?.cuisine_type ?? null}
                restaurantName={restaurant?.name ?? null}
              />
            </View>
          </MotionView>
        ) : (
          <>
            <MotionView delay={20} distance={4}>
              <DailyBriefBoard
                brief={visibleBrief}
                queue={visibleFindingQueue}
                canManage={canManage}
                busyFindingId={busyFindingId}
                message={briefMessage}
                messageIsError={briefMessageIsError}
                onSubmitFeedback={submitFindingFeedback}
              />
            </MotionView>

            <MotionView delay={30} distance={4}>
              <InsightsSummary
                title={summaryTitle}
                body={summaryBody}
                nextStep={nextStep}
                urgent={summary?.urgentCount ?? 0}
                watch={summary?.warningCount ?? 0}
                info={infoCount}
              />
            </MotionView>

            <SegmentedControl
              accessibilityLabel={t("insights.filter.accessibility")}
              options={insightFilters}
              value={filter}
              onValueChange={setFilter}
            />

            <MotionView key={filter} distance={4} duration={220}>
              <SectionSurface
                title={t("insights.brief.title")}
                subtitle={
                  serviceLabel
                    ? t("insights.brief.subtitleStyle", { style: serviceLabel })
                    : t("insights.brief.subtitle")
                }
                action={t(filteredInsights.length === 1 ? "insights.signalCount.one" : "insights.signalCount.other", {
                  count: formatNumber(filteredInsights.length)
                })}
                padding="none"
              >
                {filteredInsights.length === 0 ? (
                  <View style={styles.briefEmpty}>
                    <BarChart3 size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />
                    <Text style={styles.briefEmptyTitle}>
                      {visibleInsights.length === 0
                        ? t("insights.brief.emptyLearning.title")
                        : t("insights.brief.emptyFilter.title", { filter: labelForFilter(t, filter).toLocaleLowerCase() })}
                    </Text>
                    <Text style={styles.briefEmptyBody}>
                      {visibleInsights.length === 0
                        ? t("insights.brief.emptyLearning.body")
                        : t("insights.brief.emptyFilter.body")}
                    </Text>
                  </View>
                ) : (
                  <View>
                    {filteredInsights.map((insight, index) => (
                      <InsightListRow key={insight.id} insight={insight} divided={index > 0} />
                    ))}
                  </View>
                )}
              </SectionSurface>
            </MotionView>

            {visibleMemory ? <HowMiseKnows memory={visibleMemory} /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function InsightsSummary({
  title,
  body,
  nextStep,
  urgent,
  watch,
  info
}: {
  title: string;
  body: string;
  nextStep: string;
  urgent: number;
  watch: number;
  info: number;
}) {
  const { t } = useLocale();
  const tone = urgent > 0 ? "danger" : watch > 0 ? "caution" : info > 0 ? "neutral" : "neutral";
  const palette = summaryToneColors[tone === "danger" || tone === "caution" ? tone : info > 0 ? "success" : "neutral"];
  return (
    <SectionSurface padding="none">
      <View style={styles.summaryHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: palette.soft }]}>
          {tone === "danger" ? (
            <AlertTriangle size={icon.emphasis} color={palette.strong} strokeWidth={iconStroke} />
          ) : urgent === 0 && watch === 0 && info === 0 ? (
            <CheckCircle2 size={icon.emphasis} color={palette.strong} strokeWidth={iconStroke} />
          ) : (
            <Lightbulb size={icon.emphasis} color={palette.strong} strokeWidth={iconStroke} />
          )}
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{title}</Text>
          <Text style={styles.summaryBody}>{body}</Text>
          <Text style={styles.summaryNextStep}>{nextStep}</Text>
        </View>
      </View>
      <View style={styles.summaryMetrics}>
        <SummaryMetric
          label={t("insights.metric.urgent")}
          value={urgent}
          tone="danger"
          icon={<AlertTriangle size={icon.row} color={urgent > 0 ? colors.danger : colors.muted} strokeWidth={iconStroke} />}
        />
        <SummaryMetric
          label={t("insights.metric.watch")}
          value={watch}
          tone="caution"
          icon={<Lightbulb size={icon.row} color={watch > 0 ? colors.caution : colors.muted} strokeWidth={iconStroke} />}
          divided
        />
        <SummaryMetric
          label={t("insights.metric.info")}
          value={info}
          tone="default"
          icon={<BookOpen size={icon.row} color={info > 0 ? colors.text : colors.muted} strokeWidth={iconStroke} />}
          divided
        />
      </View>
    </SectionSurface>
  );
}

function SalesAnalyticsBoard({
  analytics,
  currency,
  serviceStyle,
  cuisineType,
  restaurantName
}: {
  analytics: InsightsSalesAnalytics | null;
  currency?: string;
  serviceStyle: RestaurantServiceStyle | null;
  cuisineType: string | null;
  restaurantName: string | null;
}) {
  const { formatCompactCurrency, formatNumber, t } = useLocale();
  const hasSales = Boolean(analytics && analytics.saleCount > 0);
  const maxSellerGross = Math.max(1, ...(analytics?.bestSellers.map((item) => item.grossSales) ?? [1]));
  const maxWeekday = Math.max(1, ...(analytics?.weekdayMix.map((slice) => slice.value) ?? [1]));
  const categorySlices =
    analytics?.categoryMix.map((slice, index) => ({
      label: localizeMixLabel(slice.label, t),
      value: slice.value,
      color: donutPaletteColor(index)
    })) ?? [];
  const sourceSlices =
    analytics?.sourceMix.map((slice, index) => ({
      label: localizeMixLabel(slice.label, t),
      value: slice.value,
      color: donutPaletteColor(index + 2)
    })) ?? [];
  const unitsLabels =
    analytics?.unitsTrend.map((point) =>
      point.date.slice(5).replace("-", "/")
    ) ?? [];
  const serviceLabel = serviceStyle ? serviceStyleLabel(serviceStyle, t) : null;

  return (
    <View style={styles.analyticsStack}>
      <SectionSurface
        title={t("insights.analytics.profile.title")}
        subtitle={t("insights.analytics.profile.subtitle")}
      >
        <View style={styles.profileGrid}>
          <ProfileChip
            label={t("insights.analytics.profile.restaurant")}
            value={restaurantName?.trim() || t("insights.analytics.profile.unknown")}
          />
          <ProfileChip
            label={t("insights.analytics.profile.service")}
            value={serviceLabel ?? t("insights.analytics.profile.unknown")}
          />
          <ProfileChip
            label={t("insights.analytics.profile.cuisine")}
            value={cuisineType?.trim() || t("insights.analytics.profile.unknown")}
          />
          <ProfileChip
            label={t("insights.analytics.profile.window")}
            value={
              analytics?.windowStart && analytics.throughDate
                ? t("insights.analytics.profile.windowValue", {
                    start: analytics.windowStart.slice(5),
                    end: analytics.throughDate.slice(5)
                  })
                : t("insights.analytics.profile.unknown")
            }
          />
        </View>
        <Text style={styles.profileNote}>{t("insights.analytics.profile.note")}</Text>
      </SectionSurface>

      {!hasSales ? (
        <SectionSurface title={t("insights.analytics.empty.title")}>
          <Text style={styles.analyticsEmptyBody}>{t("insights.analytics.empty.body")}</Text>
        </SectionSurface>
      ) : (
        <>
          <SectionSurface
            title={t("insights.analytics.bestSellers.title")}
            subtitle={t("insights.analytics.bestSellers.subtitle", {
              count: formatNumber(analytics!.bestSellers.length)
            })}
            action={formatCompactCurrency(analytics!.totalGross, currency)}
          >
            <View style={styles.sellerList}>
              {analytics!.bestSellers.map((item, index) => (
                <View
                  key={item.itemName}
                  style={[styles.sellerRow, index > 0 && styles.dividedRow]}
                >
                  <View style={styles.sellerRank}>
                    <Text style={styles.sellerRankText}>{formatNumber(index + 1)}</Text>
                  </View>
                  <View style={styles.sellerCopy}>
                    <Text style={styles.sellerName} numberOfLines={1}>
                      {item.itemName}
                    </Text>
                    <Text style={styles.sellerMeta}>
                      {t("insights.analytics.bestSellers.meta", {
                        units: formatNumber(item.quantity, { maximumFractionDigits: 1 }),
                        share: formatNumber(item.share, {
                          style: "percent",
                          maximumFractionDigits: 0
                        })
                      })}
                    </Text>
                    <View style={styles.sellerTrack}>
                      <View
                        style={[
                          styles.sellerFill,
                          { width: `${Math.max(8, (item.grossSales / maxSellerGross) * 100)}%` }
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.sellerValue}>
                    {formatCompactCurrency(item.grossSales, currency)}
                  </Text>
                </View>
              ))}
            </View>
          </SectionSurface>

          <SectionSurface
            title={t("insights.analytics.category.title")}
            subtitle={t("insights.analytics.category.subtitle")}
          >
            <DonutChart
              slices={categorySlices}
              centerLabel={t("insights.analytics.category.center")}
              centerValue={formatNumber(analytics!.totalUnits, { maximumFractionDigits: 0 })}
              accessibilityLabel={t("insights.analytics.category.accessibility", {
                count: formatNumber(categorySlices.length)
              })}
            />
          </SectionSurface>

          <SectionSurface
            title={t("insights.analytics.weekday.title")}
            subtitle={t("insights.analytics.weekday.subtitle")}
          >
            <View style={styles.weekdayRow}>
              {analytics!.weekdayMix.map((slice) => (
                <View key={slice.weekday} style={styles.weekdayCol}>
                  <View style={styles.weekdayBarTrack}>
                    <View
                      style={[
                        styles.weekdayBarFill,
                        {
                          height: `${Math.max(slice.value > 0 ? 12 : 0, (slice.value / maxWeekday) * 100)}%`
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.weekdayLabel}>{t(slice.labelKey)}</Text>
                </View>
              ))}
            </View>
          </SectionSurface>

          {analytics!.unitsTrend.some((point) => point.units > 0) ? (
            <SectionSurface
              title={t("insights.analytics.units.title")}
              subtitle={t("insights.analytics.units.subtitle")}
            >
              <TrendLineChart
                series={[{ values: analytics!.unitsTrend.map((point) => point.units), color: colors.success }]}
                labels={unitsLabels}
                showArea
                formatValue={(value) => formatNumber(value, { maximumFractionDigits: 0 })}
                accessibilityLabel={t("insights.analytics.units.accessibility", {
                  units: formatNumber(analytics!.totalUnits, { maximumFractionDigits: 0 })
                })}
              />
            </SectionSurface>
          ) : null}

          {sourceSlices.length > 0 ? (
            <SectionSurface
              title={t("insights.analytics.source.title")}
              subtitle={t("insights.analytics.source.subtitle")}
            >
              <DonutChart
                slices={sourceSlices}
                centerLabel={t("insights.analytics.source.center")}
                accessibilityLabel={t("insights.analytics.source.accessibility", {
                  count: formatNumber(sourceSlices.length)
                })}
              />
            </SectionSurface>
          ) : null}
        </>
      )}
    </View>
  );
}

function ProfileChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileChip}>
      <Text style={styles.profileChipLabel}>{label}</Text>
      <Text style={styles.profileChipValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function localizeMixLabel(label: string, t: ReturnType<typeof useLocale>["t"]) {
  if (label === "Other") return t("insights.analytics.mix.other");
  if (label === "Uncategorized") return t("insights.analytics.mix.uncategorized");
  return label;
}

function SalesTrend({
  points,
  currency
}: {
  points: InsightsSalesTrendPoint[];
  currency?: string;
}) {
  const { formatCompactCurrency, formatCurrency, formatDate, formatNumber, t } = useLocale();
  const latest = points.at(-1);
  const previous = points.at(-2);
  const change = latest && previous && previous.sales > 0
    ? ((latest.sales - previous.sales) / previous.sales) * 100
    : null;
  const changeLabel = change === null
    ? t("insights.trend.waiting")
    : t("insights.trend.change", {
        percent: formatNumber(change / 100, {
          style: "percent",
          maximumFractionDigits: 0,
          signDisplay: "always"
        })
      });
  const dateLabels = buildConciseTrendDateLabels(
    points.map((point) => point.date),
    latest?.date ?? "",
    latest ? formatDate(`${latest.date}T12:00:00.000Z`, { weekday: "short", timeZone: "UTC" }) : "",
    formatDate
  );

  return (
    <View style={styles.salesCard}>
      <View style={styles.salesCardHeader}>
        <Text style={styles.salesCardEyebrow}>{t("insights.sales.eyebrow")}</Text>
        <Text style={styles.salesCardHeaderMeta}>{t("insights.sales.seeTrend")}</Text>
      </View>

      <View style={styles.salesCardBody}>
        <Text style={styles.salesCardTitle}>{t("insights.sales.balance")}</Text>
        {latest ? (
          <StateChangeView stateKey={points.map((point) => `${point.date}:${point.sales}`).join("|")}>
            <View style={styles.trendSummary}>
              <View style={styles.trendSummaryCopy}>
                <Text style={styles.trendValue}>
                  {formatCurrency(latest.sales, { currency, maximumFractionDigits: 0 })}
                </Text>
                <Text
                  style={[
                    styles.trendChange,
                    change !== null && change > 0 && styles.trendChangePositive,
                    change !== null && change < 0 && styles.trendChangeNegative
                  ]}
                >
                  {changeLabel}
                </Text>
              </View>
              <Text style={styles.trendDate}>
                {formatDate(`${latest.date}T12:00:00`, { month: "short", day: "numeric" })}
              </Text>
            </View>

            <TrendLineChart
              series={[{ values: points.map((point) => point.sales) }]}
              labels={dateLabels}
              showArea
              formatValue={(value) => formatCompactCurrency(value, currency)}
              accessibilityLabel={t(
                points.length === 1 ? "insights.trend.accessibility.one" : "insights.trend.accessibility.other",
                {
                  count: formatNumber(points.length),
                  sales: formatCurrency(latest.sales, { currency, maximumFractionDigits: 0 }),
                  change: changeLabel
                }
              )}
              style={styles.trendChart}
            />

            <View style={styles.salesDayList}>
              {points.slice(-3).reverse().map((point, index) => (
                <View key={point.date} style={[styles.salesDayRow, index > 0 && styles.salesDayRowDivided]}>
                  <Text style={styles.salesDayLabel}>
                    {formatDate(`${point.date}T12:00:00.000Z`, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                  </Text>
                  <Text style={styles.salesDayValue}>
                    {formatCurrency(point.sales, { currency, maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>
          </StateChangeView>
        ) : (
          <View style={styles.trendEmpty}>
            <Text style={styles.trendEmptyTitle}>{t("insights.trend.empty.title")}</Text>
            <Text style={styles.trendEmptyBody}>{t("insights.sales.cta")}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function describeFindingFlush(
  summary: {
    accepted: number;
    conflicted: number;
    rejected: number;
    deferred: number;
  },
  t: ReturnType<typeof useLocale>["t"]
) {
  if (summary.conflicted > 0) return t("dailyBrief.result.conflict");
  if (summary.rejected > 0) return t("dailyBrief.result.rejected");
  if (summary.deferred > 0) return t("dailyBrief.result.deferred");
  if (summary.accepted > 0) return t("dailyBrief.result.accepted");
  return t("dailyBrief.result.queued");
}

function serviceStyleLabel(style: RestaurantServiceStyle, t: (key: MessageKey) => string) {
  const keyByStyle: Record<RestaurantServiceStyle, MessageKey> = {
    quick_service: "settings.serviceStyle.quickService",
    fast_casual: "settings.serviceStyle.fastCasual",
    full_service: "settings.serviceStyle.fullService",
    bar: "settings.serviceStyle.bar",
    cafe: "settings.serviceStyle.cafe",
    ghost_kitchen: "settings.serviceStyle.ghostKitchen"
  };
  return t(keyByStyle[style]);
}

function SummaryMetric({
  label,
  value,
  icon,
  tone = "default",
  divided = false
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "default" | "danger" | "caution" | "success";
  divided?: boolean;
}) {
  const { formatNumber } = useLocale();
  return (
    <View style={[styles.summaryMetric, divided && styles.summaryMetricDivided]}>
      {icon}
      <View>
        <Text
          style={[
            styles.summaryMetricValue,
            tone === "danger" && value > 0 && styles.summaryMetricValueDanger,
            tone === "caution" && value > 0 && styles.summaryMetricValueCaution,
            tone === "success" && styles.summaryMetricValueSuccess
          ]}
        >
          {formatNumber(value)}
        </Text>
        <Text style={styles.summaryMetricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function InsightListRow({ insight, divided }: { insight: Insight; divided: boolean }) {
  const { locale, t } = useLocale();
  const presentation = presentInsight(locale, insight);
  const isUrgent = insight.severity === "urgent";
  const isWatch = insight.severity === "warning";

  return (
    <View style={[styles.insightRow, divided && styles.dividedRow]}>
      <View style={[styles.insightIcon, isUrgent && styles.insightIconDanger, isWatch && styles.insightIconWatch]}>
        {isUrgent ? (
          <AlertTriangle size={icon.emphasis} color={colors.danger} strokeWidth={iconStroke} />
        ) : (
          <Lightbulb size={icon.emphasis} color={isWatch ? colors.caution : colors.text} strokeWidth={iconStroke} />
        )}
      </View>
      <View style={styles.insightCopy}>
        <View style={styles.insightTitleRow}>
          <Text style={styles.insightTitle}>{presentation.title}</Text>
          <Text style={[styles.severityLabel, isUrgent && styles.severityDanger, isWatch && styles.severityWatch]}>
            {labelForFilter(t, insight.severity)}
          </Text>
        </View>
        <Text style={styles.insightDescription}>{presentation.description}</Text>
        {presentation.whyItMatters ? (
          <Text style={styles.insightEvidence}>
            <Text style={styles.insightEvidenceLabel}>{t("insights.whyItMatters")}</Text>
            {presentation.whyItMatters}
          </Text>
        ) : null}
        <View style={[styles.actionLine, isUrgent && styles.actionLineDanger]}>
          <Text style={styles.actionLabel}>{t("insights.nextAction")}</Text>
          <Text style={styles.actionText}>{presentation.recommendedAction}</Text>
        </View>
      </View>
    </View>
  );
}

function HowMiseKnows({ memory }: { memory: LearningMemorySummary }) {
  const { formatNumber, locale, t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const presentation = presentLearningMemory(locale, memory);

  return (
    <SectionSurface padding="none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("insights.memory.title")}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.evidenceTrigger, pressed && styles.rowPressed]}
      >
        <BookOpen size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        <View style={styles.evidenceTriggerCopy}>
          <Text style={styles.evidenceTitle}>{t("insights.memory.title")}</Text>
          <Text style={styles.evidenceSubtitle}>
            {t("insights.memory.subtitle", { label: presentation.label, score: formatNumber(memory.score) })}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={icon.emphasis} color={colors.faint} strokeWidth={iconStroke} />
        ) : (
          <ChevronDown size={icon.emphasis} color={colors.faint} strokeWidth={iconStroke} />
        )}
      </Pressable>

      {expanded ? (
        <MotionView distance={4} duration={220} style={styles.evidenceBody}>
          <Text style={styles.evidenceIntro}>
            {presentation.operatorCopy}
          </Text>
          <View style={styles.signalList}>
            {memory.signals.map((signal, index) => (
              <EvidenceRow key={signal.label} signal={signal} divided={index > 0} />
            ))}
          </View>
          <Text style={styles.evidenceNext}>{presentation.nextStep}</Text>
        </MotionView>
      ) : null}
    </SectionSurface>
  );
}

function EvidenceRow({ signal, divided }: { signal: LearningMemorySignal; divided: boolean }) {
  const { locale } = useLocale();
  const presentation = presentLearningMemorySignal(locale, signal);
  const isPositive = signal.tone === "leaf";
  const needsAttention = signal.tone === "brand" || signal.tone === "warning";

  return (
    <View style={[styles.signalRow, divided && styles.dividedRow]}>
      <View style={[styles.signalDot, isPositive && styles.signalDotPositive, needsAttention && styles.signalDotAttention]} />
      <View style={styles.signalCopy}>
        <Text style={styles.signalLabel}>{presentation.label}</Text>
        <Text style={styles.signalDetail}>{presentation.detail}</Text>
      </View>
      <Text style={[styles.signalValue, isPositive && styles.signalValuePositive, needsAttention && styles.signalValueAttention]}>
        {presentation.value}
      </Text>
    </View>
  );
}

function labelForFilter(t: ReturnType<typeof useLocale>["t"], filter: InsightFilter) {
  if (filter === "all") return t("insights.filter.all");
  if (filter === "warning") return t("insights.filter.watch");
  if (filter === "urgent") return t("insights.filter.urgent");
  return t("insights.filter.info");
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  analyticsStack: {
    gap: 16
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  profileChip: {
    width: "47%",
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  profileChipLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  profileChipValue: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 18
  },
  profileNote: {
    color: colors.muted,
    ...conceptTypography.body,
    marginTop: 12
  },
  analyticsEmptyBody: {
    color: colors.muted,
    ...conceptTypography.body
  },
  sellerList: {
    marginTop: 2
  },
  sellerRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10
  },
  sellerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  sellerRankText: {
    color: colors.accentDark,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 16
  },
  sellerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  sellerName: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 19
  },
  sellerMeta: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 16
  },
  sellerTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.panelStrong,
    overflow: "hidden"
  },
  sellerFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.accent
  },
  sellerValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    lineHeight: 18
  },
  weekdayRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    minHeight: 120,
    paddingTop: 8
  },
  weekdayCol: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  weekdayBarTrack: {
    width: "70%",
    height: 88,
    borderRadius: 6,
    backgroundColor: colors.panel,
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  weekdayBarFill: {
    width: "100%",
    borderRadius: 6,
    backgroundColor: colors.accent
  },
  weekdayLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  salesCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  salesCardHeader: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  salesCardEyebrow: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20
  },
  salesCardHeaderMeta: {
    color: colors.accentDark,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 17
  },
  salesCardBody: {
    padding: 16,
    gap: 12
  },
  salesCardTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3
  },
  salesDayList: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  salesDayRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  salesDayRowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  salesDayLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 18
  },
  salesDayValue: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  summaryHeader: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0
  },
  summaryTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    lineHeight: 23
  },
  summaryBody: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  summaryNextStep: {
    color: colors.accentDark,
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 8
  },
  summaryMetrics: {
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "stretch"
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  summaryMetricDivided: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border
  },
  summaryMetricValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    lineHeight: 24
  },
  summaryMetricValueDanger: {
    color: colors.danger
  },
  summaryMetricValueCaution: {
    color: colors.caution
  },
  summaryMetricValueSuccess: {
    color: colors.success
  },
  summaryMetricLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 17
  },
  briefEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: colors.surfaceWarm
  },
  briefEmptyTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginTop: 8,
    textAlign: "center"
  },
  briefEmptyBody: {
    color: colors.muted,
    ...conceptTypography.body,
    maxWidth: 300,
    marginTop: 5,
    textAlign: "center"
  },
  trendSummary: {
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  trendSummaryCopy: {
    flex: 1,
    minWidth: 0
  },
  trendValue: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6
  },
  trendChange: {
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  trendChangePositive: {
    color: colors.success
  },
  trendChangeNegative: {
    color: colors.warning
  },
  trendDate: {
    color: colors.muted,
    ...conceptTypography.caption,
    marginTop: 5,
    textAlign: "right"
  },
  trendChart: {
    marginTop: 10
  },
  trendEmpty: {
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  trendEmptyTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    textAlign: "center"
  },
  trendEmptyBody: {
    color: colors.muted,
    ...conceptTypography.body,
    marginTop: 4,
    textAlign: "center"
  },
  insightRow: {
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11
  },
  dividedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  insightIconDanger: {
    backgroundColor: colors.dangerSoft
  },
  insightIconWatch: {
    backgroundColor: colors.cautionSoft
  },
  insightCopy: {
    flex: 1,
    minWidth: 0
  },
  insightTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  insightTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20
  },
  severityLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    lineHeight: 16
  },
  severityDanger: {
    color: colors.danger
  },
  severityWatch: {
    color: colors.caution
  },
  insightDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  insightEvidence: {
    color: colors.muted,
    ...conceptTypography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8
  },
  insightEvidenceLabel: {
    color: colors.text,
    fontFamily: fontFamilies.semibold
  },
  actionLine: {
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    paddingLeft: 9,
    marginTop: 10
  },
  actionLineDanger: {
    borderLeftColor: colors.danger
  },
  actionLabel: {
    color: colors.faint,
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase"
  },
  actionText: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2
  },
  evidenceTrigger: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  rowPressed: {
    backgroundColor: colors.surfaceWarm
  },
  evidenceTriggerCopy: {
    flex: 1,
    minWidth: 0
  },
  evidenceTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    lineHeight: 20
  },
  evidenceSubtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  evidenceBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
    gap: 12
  },
  evidenceIntro: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19
  },
  signalList: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  signalRow: {
    minHeight: 58,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text
  },
  signalDotPositive: {
    backgroundColor: colors.success
  },
  signalDotAttention: {
    backgroundColor: colors.caution
  },
  signalCopy: {
    flex: 1,
    minWidth: 0
  },
  signalLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 18
  },
  signalDetail: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  signalValue: {
    maxWidth: 72,
    color: colors.text,
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right"
  },
  signalValuePositive: {
    color: colors.success
  },
  signalValueAttention: {
    color: colors.caution
  },
  evidenceNext: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 18
  }
});

const summaryToneColors = {
  danger: { strong: colors.danger, soft: colors.dangerSoft },
  caution: { strong: colors.caution, soft: colors.cautionSoft },
  success: { strong: colors.success, soft: colors.successSoft },
  neutral: { strong: colors.text, soft: colors.surfaceWarm }
} as const;
