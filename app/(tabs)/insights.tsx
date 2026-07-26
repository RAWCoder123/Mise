import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { InsightChartIllustration } from "../../components/ui/MiseIllustrations";
import { MotionView, StateChangeView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { TrendLineChart } from "../../components/ui/TrendLineChart";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  fetchInsights,
  fetchInsightsSalesTrend,
  fetchLearningMemorySummary,
  generateInsightsFromSalesAndInventory,
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

export default function InsightsScreen() {
  const { formatNumber, t } = useLocale();
  const { memberships, restaurant } = useMiseSession();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [memory, setMemory] = useState<LearningMemorySummary | null>(null);
  const [salesTrend, setSalesTrend] = useState<InsightsSalesTrendPoint[]>([]);
  const [filter, setFilter] = useState<InsightFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
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
    setMemory(null);
    setSalesTrend([]);
    setFilter("all");
    setError(false);
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
      const [nextInsights, nextMemory, nextSalesTrend] = await Promise.all([
        fetchInsights(restaurantId),
        fetchLearningMemorySummary(restaurantId),
        fetchInsightsSalesTrend(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setInsights(nextInsights);
      setMemory(nextMemory);
      setSalesTrend(nextSalesTrend);
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

  const canManage = canManageRestaurantData(memberships, restaurant?.id);

  const refreshInsights = useCallback(async () => {
    if (!restaurant || refreshing || !canManage) return;

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    setError(false);
    try {
      await generateInsightsFromSalesAndInventory(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      const [nextInsights, nextMemory, nextSalesTrend] = await Promise.all([
        fetchInsights(restaurantId),
        fetchLearningMemorySummary(restaurantId),
        fetchInsightsSalesTrend(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setInsights(nextInsights);
      setMemory(nextMemory);
      setSalesTrend(nextSalesTrend);
      setLoadedRestaurantId(restaurantId);
    } catch {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setRefreshing(false);
    }
  }, [canManage, refreshing, restaurant?.id]);

  const visibleInsights = loadedRestaurantId === restaurant?.id ? insights : [];
  const visibleMemory = loadedRestaurantId === restaurant?.id ? memory : null;
  const visibleSalesTrend = loadedRestaurantId === restaurant?.id ? salesTrend : [];

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
            <RefreshCw size={20} color={colors.accentDark} strokeWidth={2.25} />
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

        <MotionView delay={70} distance={4}>
          <SalesTrend points={visibleSalesTrend} currency={restaurant?.currency} />
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
                <InsightChartIllustration size={66} />
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
            <AlertTriangle size={22} color={palette.strong} strokeWidth={2.25} />
          ) : urgent === 0 && watch === 0 && info === 0 ? (
            <CheckCircle2 size={22} color={palette.strong} strokeWidth={2.25} />
          ) : (
            <Lightbulb size={22} color={palette.strong} strokeWidth={2.25} />
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
          icon={<AlertTriangle size={18} color={urgent > 0 ? colors.danger : colors.muted} strokeWidth={2.25} />}
        />
        <SummaryMetric
          label={t("insights.metric.watch")}
          value={watch}
          tone="caution"
          icon={<Lightbulb size={18} color={watch > 0 ? colors.caution : colors.muted} strokeWidth={2.25} />}
          divided
        />
        <SummaryMetric
          label={t("insights.metric.info")}
          value={info}
          tone="default"
          icon={<BookOpen size={18} color={info > 0 ? colors.text : colors.muted} strokeWidth={2.25} />}
          divided
        />
      </View>
    </SectionSurface>
  );
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
    <SectionSurface
      title={t("insights.trend.title")}
      subtitle={points.length > 0 ? t("insights.trend.subtitleComplete") : t("insights.trend.subtitle")}
      padding="comfortable"
    >
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
        </StateChangeView>
      ) : (
        <View style={styles.trendEmpty}>
          <Text style={styles.trendEmptyTitle}>{t("insights.trend.empty.title")}</Text>
          <Text style={styles.trendEmptyBody}>{t("insights.trend.empty.body")}</Text>
        </View>
      )}
    </SectionSurface>
  );
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
          <AlertTriangle size={20} color={colors.danger} strokeWidth={2.25} />
        ) : (
          <Lightbulb size={20} color={isWatch ? colors.caution : colors.text} strokeWidth={2.25} />
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
        <BookOpen size={20} color={colors.text} strokeWidth={2.25} />
        <View style={styles.evidenceTriggerCopy}>
          <Text style={styles.evidenceTitle}>{t("insights.memory.title")}</Text>
          <Text style={styles.evidenceSubtitle}>
            {t("insights.memory.subtitle", { label: presentation.label, score: formatNumber(memory.score) })}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={colors.faint} strokeWidth={2.25} />
        ) : (
          <ChevronDown size={20} color={colors.faint} strokeWidth={2.25} />
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
    gap: 14
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
    fontFamily: typography.families.bold,
    fontSize: 18,
    lineHeight: 23
  },
  summaryBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  summaryNextStep: {
    color: colors.accentDark,
    fontFamily: typography.families.semibold,
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
    fontFamily: typography.families.bold,
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
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 15
  },
  briefEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: colors.surfaceWarm
  },
  briefEmptyTitle: {
    color: colors.text,
    ...typography.cardTitle,
    marginTop: 8,
    textAlign: "center"
  },
  briefEmptyBody: {
    color: colors.muted,
    ...typography.body,
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
    fontFamily: typography.families.bold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.25
  },
  trendChange: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
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
    ...typography.caption,
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
    ...typography.cardTitle,
    textAlign: "center"
  },
  trendEmptyBody: {
    color: colors.muted,
    ...typography.body,
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
    fontFamily: typography.families.bold,
    fontSize: 15,
    lineHeight: 20
  },
  severityLabel: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 10,
    lineHeight: 14
  },
  severityDanger: {
    color: colors.danger
  },
  severityWatch: {
    color: colors.caution
  },
  insightDescription: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  insightEvidence: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8
  },
  insightEvidenceLabel: {
    color: colors.text,
    fontFamily: typography.families.semibold
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
    fontFamily: typography.families.bold,
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase"
  },
  actionText: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 17,
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
    fontFamily: typography.families.bold,
    fontSize: 15,
    lineHeight: 20
  },
  evidenceSubtitle: {
    color: colors.muted,
    fontFamily: typography.families.body,
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
    fontFamily: typography.families.body,
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
    fontFamily: typography.families.bold,
    fontSize: 13,
    lineHeight: 18
  },
  signalDetail: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  },
  signalValue: {
    maxWidth: 72,
    color: colors.text,
    fontFamily: typography.families.bold,
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
    fontFamily: typography.families.semibold,
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
