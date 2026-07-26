import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { CalendarCheck, ClipboardList, Package, ShoppingBag, ShoppingCart, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  InventoryHealthBar,
  getInventoryHealthTotal,
  getWellStockedPercentage,
  type InventoryHealthCounts
} from "../../components/ui/InventoryHealth";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SectionSurface } from "../../components/ui/SectionSurface";
import { StatCard, StatCardRow, type StatCardDelta } from "../../components/ui/StatCard";
import { RetryNotice, StatusNotice, type StatusNoticeTone } from "../../components/ui/StatusNotice";
import { colors, inventoryStatusColors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import {
  classifyOperationalTodayTaskTiming,
  type OperationalTodayTask,
  type OperationalTodayTaskTiming
} from "../../services/domain/todayTasks";
import { fetchTodaySummary, type TodayCommandCenterSummary } from "../../services/miseService";
import { presentOperationalTodayTask } from "../../services/presentation/operationsPresentation";
import { captureMiseError } from "../../services/telemetry";
import type { RestaurantServiceStyle } from "../../types/mise";

type Translator = (key: MessageKey, values?: MessageValues) => string;

const serviceStyleKeys: Record<RestaurantServiceStyle, MessageKey> = {
  quick_service: "settings.serviceStyle.quickService",
  fast_casual: "settings.serviceStyle.fastCasual",
  full_service: "settings.serviceStyle.fullService",
  bar: "settings.serviceStyle.bar",
  cafe: "settings.serviceStyle.cafe",
  ghost_kitchen: "settings.serviceStyle.ghostKitchen"
};

export default function HomeScreen() {
  const { canUseDemoMode, continueWithDemo, restaurant, user } = useMiseSession();
  const { formatCompactCurrency, formatDate, formatNumber, t, locale } = useLocale();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
    setLoadedRestaurantId(null);
    setError(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id]);

  const load = useCallback(async () => {
    if (!restaurant) {
      setLoading(false);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setError(null);
    setLoading(true);
    try {
      const nextSummary = await fetchTodaySummary(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "home", operation: "load", restaurant_id: restaurantId });
      setError(t("home.error"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function openDemo() {
    await continueWithDemo({
      preset: DEMO_DATASET.id,
      name: DEMO_DATASET.restaurant.name,
      cuisine_type: DEMO_DATASET.restaurant.cuisineType,
      posProvider: DEMO_DATASET.defaultPosProvider
    });
    router.replace("/home");
  }

  const visibleSummary = loadedRestaurantId === restaurant?.id ? summary : null;
  const dateLabel = useMemo(
    () => formatDate(new Date(), { weekday: "short", month: "short", day: "numeric" }),
    [formatDate]
  );

  if (!restaurant) {
    return (
      <Screen title={t("nav.home")} subtitle={t("home.subtitle.noRestaurant")}>
        <EmptyState
          title={t("workspace.none.title")}
          body={t(canUseDemoMode ? "workspace.none.demoBody" : "workspace.none.body")}
          illustration={<ProduceCrateIllustration />}
        />
        <Button
          title={t(canUseDemoMode ? "workspace.none.demoAction" : "workspace.none.setupAction")}
          onPress={canUseDemoMode ? openDemo : () => router.replace("/setup")}
          fullWidth
          style={styles.emptyButton}
        />
      </Screen>
    );
  }

  const greetingName = firstName(user?.name) || t("home.greeting.fallbackName");

  return (
    <Screen loading={loading}>
      <View style={styles.stack}>
        <View style={styles.greetingBlock}>
          <Text style={styles.dateText}>
            {dateLabel} · {t(serviceStyleKeys[restaurant.service_style])}
          </Text>
          <Text style={styles.greeting}>{t(greetingKeyForNow(), { name: greetingName })}</Text>
          <Text style={styles.greetingSubtext}>{t("home.greeting.subtext")}</Text>
        </View>

        {error ? (
          <RetryNotice
            title={t("home.retry.title")}
            message={error}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("home.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {visibleSummary ? (
          <>
            <MotionView delay={20} distance={4}>
              <ServiceAlert summary={visibleSummary} formatNumber={formatNumber} t={t} />
            </MotionView>

            <MotionView delay={45} distance={4}>
              <HomeMetrics
                summary={visibleSummary}
                formatCompactCurrency={formatCompactCurrency}
                formatNumber={formatNumber}
                t={t}
              />
            </MotionView>

            <MotionView delay={70} distance={4}>
              <DailyBrief
                summary={visibleSummary}
                formatCompactCurrency={formatCompactCurrency}
                formatNumber={formatNumber}
                t={t}
              />
            </MotionView>

            <MotionView delay={95} distance={4}>
              <InventoryBrief counts={visibleSummary.inventoryHealth} formatNumber={formatNumber} t={t} />
            </MotionView>

            <MotionView delay={120} distance={4}>
              <TopTasks
                tasks={visibleSummary.operationalTasks}
                restaurantTimeZone={visibleSummary.restaurantTimeZone}
                locale={locale}
                t={t}
              />
            </MotionView>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function ServiceAlert({
  summary,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const stockRisk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const tone: StatusNoticeTone = summary.inventoryHealth.critical > 0
    ? "danger"
    : stockRisk > 0 || summary.pendingRecommendations > 0
      ? "warning"
      : "success";
  const title = stockRisk > 0
    ? t(stockRisk === 1 ? "home.alert.lowStock.title.one" : "home.alert.lowStock.title.other", {
        count: formatNumber(stockRisk)
      })
    : summary.pendingRecommendations > 0
      ? t(
          summary.pendingRecommendations === 1
            ? "home.alert.orders.title.one"
            : "home.alert.orders.title.other",
          { count: formatNumber(summary.pendingRecommendations) }
        )
      : t("home.alert.onTrack.title");
  const message = stockRisk > 0
    ? t("home.alert.lowStock.body")
    : summary.pendingRecommendations > 0
      ? t("home.alert.orders.body")
      : t("home.alert.onTrack.body");
  const route = stockRisk > 0 ? "/inventory" : summary.pendingRecommendations > 0 ? "/orders" : "/today";
  const actionLabel = stockRisk > 0
    ? t("home.alert.lowStock.action")
    : summary.pendingRecommendations > 0
      ? t("home.alert.orders.action")
      : t("home.alert.onTrack.action");

  return (
    <StatusNotice
      title={title}
      message={message}
      tone={tone}
      actionLabel={actionLabel}
      actionVariant={tone === "success" ? "text" : "solid"}
      onAction={() => router.push(route)}
    />
  );
}

function HomeMetrics({
  summary,
  formatCompactCurrency,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatCompactCurrency: (value: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const salesDelta = buildSalesDelta(summary, formatNumber);
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open");
  const highPriority = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;

  return (
    <StatCardRow accessibilityLabel={t("home.metrics.accessibility")}>
      <StatCard
        label={t("home.metric.sales")}
        value={formatCompactCurrency(summary.salesToday, summary.restaurantCurrency)}
        delta={salesDelta}
        icon={<ShoppingBag size={16} color={colors.text} strokeWidth={2.15} />}
      />
      <StatCard
        label={t("home.metric.openTasks")}
        value={formatNumber(openTasks.length)}
        tone={highPriority > 0 ? "danger" : "default"}
        delta={
          highPriority > 0
            ? { label: t("home.metric.high", { count: formatNumber(highPriority) }), trend: "flat", tone: "danger" }
            : undefined
        }
        icon={<CalendarCheck size={16} color={highPriority > 0 ? colors.danger : colors.text} strokeWidth={2.15} />}
      />
      <StatCard
        label={t("home.metric.orderReview")}
        value={formatNumber(summary.pendingRecommendations)}
        tone={summary.pendingRecommendations > 0 ? "caution" : "success"}
        icon={
          <ClipboardList
            size={16}
            color={summary.pendingRecommendations > 0 ? colors.caution : colors.success}
            strokeWidth={2.15}
          />
        }
      />
    </StatCardRow>
  );
}

function DailyBrief({
  summary,
  formatCompactCurrency,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatCompactCurrency: (value: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open").length;
  const risk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const salesLine = t("home.brief.sales", {
    sales: formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
    count: formatNumber(summary.itemsSold)
  });
  const priorityLine = risk > 0
    ? t(risk === 1 ? "home.brief.risk.one" : "home.brief.risk.other", { count: formatNumber(risk) })
    : summary.pendingRecommendations > 0
      ? t(
          summary.pendingRecommendations === 1 ? "home.brief.orders.one" : "home.brief.orders.other",
          { count: formatNumber(summary.pendingRecommendations) }
        )
      : t(openTasks === 1 ? "home.brief.tasks.one" : "home.brief.tasks.other", { count: formatNumber(openTasks) });

  return (
    <SectionSurface title={t("home.brief.title")} action={t("home.brief.action")} onAction={() => router.push("/ask-mise")}>
      <View style={styles.briefRow}>
        <View style={styles.sparkIcon}>
          <Sparkles size={19} color={colors.accentDark} strokeWidth={2.2} />
        </View>
        <View style={styles.briefCopy}>
          <Text style={styles.briefTitle}>{t("home.brief.heading")}</Text>
          <Text style={styles.briefBody}>{salesLine} {priorityLine}</Text>
        </View>
      </View>
    </SectionSurface>
  );
}

function InventoryBrief({
  counts,
  formatNumber,
  t
}: {
  counts: InventoryHealthCounts;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const total = getInventoryHealthTotal(counts);
  const healthy = getWellStockedPercentage(counts);
  const attention = counts.watch + counts.low + counts.critical;
  const percent = formatNumber(healthy / 100, { style: "percent", maximumFractionDigits: 0 });

  return (
    <SectionSurface
      title={t("home.health.title")}
      action={t("home.health.action")}
      onAction={() => router.push("/inventory")}
      separatedHeader={false}
    >
      <View style={styles.healthHead}>
        <Text style={styles.healthPercent}>{total === 0 ? formatNumber(0, { style: "percent" }) : percent}</Text>
        <View style={styles.healthCopy}>
          <Text style={styles.healthTitle}>
            {attention === 0
              ? t("home.health.healthy")
              : t(attention === 1 ? "home.health.attention.one" : "home.health.attention.other", {
                  count: formatNumber(attention)
                })}
          </Text>
          <Text style={styles.healthBody}>
            {attention === 0 ? t("home.health.ready") : t("home.health.mostly")}
          </Text>
        </View>
      </View>
      <InventoryHealthBar counts={counts} />
      <View style={styles.healthLegend}>
        <HealthLegend
          color={inventoryStatusColors.Good}
          label={t("inventory.health.good")}
          value={counts.good}
          formatNumber={formatNumber}
        />
        <HealthLegend
          color={inventoryStatusColors.Watch}
          label={t("inventory.health.watch")}
          value={counts.watch}
          formatNumber={formatNumber}
        />
        <HealthLegend
          color={inventoryStatusColors.Low}
          label={t("inventory.health.low")}
          value={counts.low + counts.critical}
          formatNumber={formatNumber}
        />
      </View>
    </SectionSurface>
  );
}

function HealthLegend({
  color,
  label,
  value,
  formatNumber
}: {
  color: string;
  label: string;
  value: number;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label} {formatNumber(value)}</Text>
    </View>
  );
}

function TopTasks({
  tasks,
  restaurantTimeZone,
  locale,
  t
}: {
  tasks: OperationalTodayTask[];
  restaurantTimeZone: string;
  locale: Parameters<typeof presentOperationalTodayTask>[0];
  t: Translator;
}) {
  const openTasks = tasks.filter((task) => task.status === "open").slice(0, 3);
  return (
    <SectionSurface
      title={t("home.tasks.title")}
      action={t("common.viewAll")}
      onAction={() => router.push("/today")}
      padding={openTasks.length > 0 ? "none" : "compact"}
    >
      {openTasks.length === 0 ? (
        <Text style={styles.emptyCopy}>{t("home.tasks.empty")}</Text>
      ) : (
        openTasks.map((task, index) => (
          <HomeTaskRow
            key={task.id}
            task={task}
            divided={index > 0}
            restaurantTimeZone={restaurantTimeZone}
            locale={locale}
            t={t}
          />
        ))
      )}
    </SectionSurface>
  );
}

function HomeTaskRow({
  task,
  divided,
  restaurantTimeZone,
  locale,
  t
}: {
  task: OperationalTodayTask;
  divided: boolean;
  restaurantTimeZone: string;
  locale: Parameters<typeof presentOperationalTodayTask>[0];
  t: Translator;
}) {
  const { formatDueTime } = useLocale();
  const presentation = presentOperationalTodayTask(locale, task);
  const timing = classifyOperationalTodayTaskTiming(task, { restaurantTimeZone });
  const timeLabel = task.dueAt
    ? formatDueTime(task.dueAt, { timeZone: restaurantTimeZone })
    : t(timingKey(timing));
  const high = task.priority === "urgent" || task.priority === "high";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("home.task.accessibility", { title: presentation.title, time: timeLabel })}
      onPress={() => router.push(`/tasks/${task.id}`)}
      style={({ pressed }) => [styles.taskRow, divided && styles.divided, pressed && styles.pressedRow]}
    >
      <View style={[styles.taskGlyph, high && styles.taskGlyphHigh]}>
        {taskIcon(task, high ? colors.danger : colors.text)}
      </View>
      <View style={styles.taskCopy}>
        <Text numberOfLines={1} style={styles.taskTitle}>{presentation.title}</Text>
        <Text numberOfLines={1} style={styles.taskMeta}>{timeLabel}</Text>
      </View>
      <View style={[styles.priorityBadge, high && styles.priorityBadgeHigh]}>
        <Text style={[styles.priorityText, high && styles.priorityTextHigh]}>
          {t(high ? "task.badge.high" : "task.badge.normal")}
        </Text>
      </View>
    </Pressable>
  );
}

function buildSalesDelta(
  summary: TodayCommandCenterSummary,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
): StatCardDelta | undefined {
  const currentPoint = summary.salesTrend.at(-1)?.label === summary.operatingDate ? summary.salesTrend.at(-1) : null;
  const previousPoint = currentPoint && summary.salesTrend.length >= 2 ? summary.salesTrend.at(-2) : null;
  if (!currentPoint || !previousPoint || previousPoint.sales <= 0) return undefined;
  const change = Math.round(((currentPoint.sales - previousPoint.sales) / previousPoint.sales) * 100);
  return {
    label: `${change > 0 ? "+" : ""}${formatNumber(change)}%`,
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
    tone: change > 0 ? "success" : change < 0 ? "danger" : "neutral"
  };
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 17, color, strokeWidth: 2.15 } as const;
  if (task.source.kind === "inventory") return <Package {...props} />;
  if (task.source.kind === "order" || task.source.kind === "recommendation") return <ShoppingCart {...props} />;
  return <Sparkles {...props} />;
}

function timingKey(timing: OperationalTodayTaskTiming): MessageKey {
  if (timing === "overdue") return "relative.overdue";
  if (timing === "due_soon") return "relative.dueNow";
  if (timing === "today") return "relative.today";
  if (timing === "later") return "task.timing.later";
  return "task.timing.noTime";
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function greetingKeyForNow(): MessageKey {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greeting.morning";
  if (hour < 17) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  emptyButton: {
    marginTop: 12
  },
  greetingBlock: {
    gap: 3
  },
  dateText: {
    color: colors.accentDark,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 16
  },
  greeting: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.45
  },
  greetingSubtext: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 13,
    lineHeight: 19
  },
  briefRow: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center"
  },
  sparkIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft
  },
  briefCopy: {
    flex: 1,
    minWidth: 0
  },
  briefTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  briefBody: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  healthHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  healthPercent: {
    color: colors.success,
    fontFamily: typography.families.bold,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.8
  },
  healthCopy: {
    flex: 1,
    minWidth: 0
  },
  healthTitle: {
    color: colors.text,
    ...typography.cardTitle
  },
  healthBody: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  healthLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  legendText: {
    color: colors.muted,
    fontFamily: typography.families.medium,
    fontSize: 11,
    lineHeight: 14
  },
  emptyCopy: {
    color: colors.muted,
    ...typography.body
  },
  taskRow: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  pressedRow: {
    backgroundColor: colors.surfaceWarm
  },
  taskGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel
  },
  taskGlyphHigh: {
    backgroundColor: colors.dangerSoft
  },
  taskCopy: {
    flex: 1,
    minWidth: 0
  },
  taskTitle: {
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 13.5,
    lineHeight: 18
  },
  taskMeta: {
    color: colors.muted,
    ...typography.caption,
    marginTop: 2
  },
  priorityBadge: {
    borderRadius: radii.xl,
    backgroundColor: colors.panelStrong,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  priorityBadgeHigh: {
    backgroundColor: colors.dangerSoft
  },
  priorityText: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  priorityTextHigh: {
    color: colors.danger
  }
});
