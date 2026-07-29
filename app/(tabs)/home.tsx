import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect } from "expo-router";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Package, ShoppingCart, Sparkles } from "lucide-react-native";
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
import { Screen } from "../../components/ui/Screen";
import { CompactMetricStrip } from "../../components/ui/CompactMetricStrip";
import { RetryNotice } from "../../components/ui/StatusNotice";
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

type Translator = (key: MessageKey, values?: MessageValues) => string;

export default function HomeScreen() {
  const { canUseDemoMode, continueWithDemo, restaurant, user } = useMiseSession();
  const { formatCompactCurrency, formatNumber, t, locale } = useLocale();
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("screen.openRestaurantSettings", { restaurant: restaurant.name })}
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.restaurantChip, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.restaurantChipText}>{restaurant.name}</Text>
          <ChevronDown size={12} color={colors.muted} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.greetingBlock}>
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
            <ServiceAlert summary={visibleSummary} formatNumber={formatNumber} t={t} />
            <HomeMetrics
              summary={visibleSummary}
              formatCompactCurrency={formatCompactCurrency}
              formatNumber={formatNumber}
              t={t}
            />
            <DailyBrief summary={visibleSummary} formatNumber={formatNumber} t={t} />
            <InventoryBrief counts={visibleSummary.inventoryHealth} formatNumber={formatNumber} t={t} />
            <TopTasks
              tasks={visibleSummary.operationalTasks}
              restaurantTimeZone={visibleSummary.restaurantTimeZone}
              locale={locale}
              t={t}
            />
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
  const tone = summary.inventoryHealth.critical > 0
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
  const route = stockRisk > 0 ? "/inventory" : summary.pendingRecommendations > 0 ? "/orders" : "/today";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(route)}
      style={({ pressed }) => [
        styles.alert,
        (tone === "warning" || tone === "danger") && styles.alertWarning,
        tone === "success" && styles.alertSuccess,
        pressed && styles.pressed
      ]}
    >
      <View
        style={[
          styles.alertIcon,
          (tone === "warning" || tone === "danger") && styles.alertIconWarning,
          tone === "success" && styles.alertIconSuccess
        ]}
      >
        {tone === "success" ? (
          <CheckCircle2 size={14} color={colors.success} strokeWidth={2.3} />
        ) : (
          <AlertTriangle size={14} color={colors.danger} strokeWidth={2.3} />
        )}
      </View>
      <View style={styles.alertCopy}>
        <Text style={styles.alertTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.alertBody} numberOfLines={1}>
          {stockRisk > 0
            ? t("home.alert.lowStock.body")
            : summary.pendingRecommendations > 0
              ? t("home.alert.orders.body")
              : t("home.alert.onTrack.body")}
        </Text>
      </View>
      <ChevronRight size={16} color={tone === "success" ? colors.faint : colors.danger} strokeWidth={2.2} />
    </Pressable>
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
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open");
  const salesDelta = buildSalesDelta(summary, formatNumber);

  return (
    <View style={styles.metricsBlock}>
      <Text style={styles.sectionLabel}>{t("home.glance.title")}</Text>
      <CompactMetricStrip
        accessibilityLabel={t("home.metrics.accessibility")}
        metrics={[
          {
            id: "sales",
            label: t("home.metric.sales"),
            value: formatCompactCurrency(summary.salesToday, summary.restaurantCurrency),
            caption: salesDelta?.label,
            captionTone: salesDelta?.tone === "success" ? "success" : salesDelta?.tone === "danger" ? "danger" : "default"
          },
          {
            id: "sold",
            label: t("home.metric.itemsSold"),
            value: formatNumber(summary.itemsSold)
          },
          {
            id: "tasks",
            label: t("home.metric.openTasks"),
            value: formatNumber(openTasks.length),
            tone: openTasks.length > 0 ? "default" : "success"
          },
          {
            id: "orders",
            label: t("home.metric.orderReview"),
            value: formatNumber(summary.pendingRecommendations),
            tone: summary.pendingRecommendations > 0 ? "caution" : "success"
          }
        ]}
      />
    </View>
  );
}

function DailyBrief({
  summary,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open").length;
  const risk = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const bullets = [
    t(openTasks === 1 ? "home.brief.bullet.tasks.one" : "home.brief.bullet.tasks.other", {
      count: formatNumber(openTasks)
    }),
    t(
      summary.pendingRecommendations === 1 ? "home.brief.bullet.orders.one" : "home.brief.bullet.orders.other",
      { count: formatNumber(summary.pendingRecommendations) }
    ),
    t(risk === 1 ? "home.brief.bullet.stock.one" : "home.brief.bullet.stock.other", {
      count: formatNumber(risk)
    })
  ];

  return (
    <View style={styles.briefSection}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{t("home.brief.title")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.brief.action")}
          hitSlop={6}
          onPress={() => router.push("/ask-mise")}
        >
          <Text style={styles.sectionAction}>{t("home.brief.action")}</Text>
        </Pressable>
      </View>
      <View style={styles.briefBody}>
        <View style={styles.briefBullets}>
          {bullets.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
        <ProduceCrateIllustration size={56} />
      </View>
    </View>
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
  const percent = formatNumber(healthy / 100, { style: "percent", maximumFractionDigits: 0 });

  return (
    <View style={styles.healthSection}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{t("home.health.title")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.health.action")}
          hitSlop={6}
          onPress={() => router.push("/inventory")}
        >
          <Text style={styles.sectionAction}>{t("home.health.action")}</Text>
        </Pressable>
      </View>
      <View style={styles.healthRow}>
        <Text style={styles.healthPercent}>{total === 0 ? formatNumber(0, { style: "percent" }) : percent}</Text>
        <Text style={styles.healthHealthy}>{t("home.health.healthy")}</Text>
      </View>
      <InventoryHealthBar counts={counts} />
      <View style={styles.healthLegend}>
        <Text style={styles.legendText}>
          <Text style={{ color: inventoryStatusColors.Good }}>● </Text>
          {t("inventory.health.good")} {formatNumber(counts.good)}
        </Text>
        <Text style={styles.legendText}>
          <Text style={{ color: inventoryStatusColors.Watch }}>● </Text>
          {t("inventory.health.watch")} {formatNumber(counts.watch)}
        </Text>
        <Text style={styles.legendText}>
          <Text style={{ color: inventoryStatusColors.Low }}>● </Text>
          {t("inventory.health.low")} {formatNumber(counts.low + counts.critical)}
        </Text>
      </View>
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
  const openTasks = tasks.filter((task) => task.status === "open").slice(0, 2);
  return (
    <View style={styles.tasksSection}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{t("home.tasks.title")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.viewAll")}
          hitSlop={6}
          onPress={() => router.push("/today")}
        >
          <Text style={styles.sectionAction}>{t("common.viewAll")}</Text>
        </Pressable>
      </View>
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
    </View>
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
      style={({ pressed }) => [styles.taskRow, divided && styles.divided, pressed && styles.pressed]}
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
): { label: string; trend: "up" | "down" | "flat"; tone: "success" | "danger" | "neutral" } | undefined {
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
  const props = { size: 14, color, strokeWidth: 2.15 } as const;
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
    gap: 10
  },
  emptyButton: {
    marginTop: 12
  },
  restaurantChip: {
    alignSelf: "flex-start",
    minHeight: 28,
    maxWidth: "88%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  restaurantChipText: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  greetingBlock: {
    gap: 2
  },
  greeting: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3
  },
  greetingSubtext: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
    lineHeight: 15
  },
  alert: {
    minHeight: 52,
    maxHeight: 56,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  alertWarning: {
    borderColor: colors.redSoft,
    backgroundColor: colors.dangerSoft
  },
  alertSuccess: {
    borderColor: colors.successSoft,
    backgroundColor: colors.successSoft
  },
  alertIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong
  },
  alertIconWarning: {
    backgroundColor: colors.surface
  },
  alertIconSuccess: {
    backgroundColor: colors.surface
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1
  },
  alertTitle: {
    color: colors.text,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 15
  },
  alertBody: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10,
    lineHeight: 13
  },
  metricsBlock: {
    gap: 6
  },
  sectionLabel: {
    color: colors.text,
    ...typography.sectionTitle
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  sectionAction: {
    color: colors.accentDark,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  briefSection: {
    gap: 0
  },
  briefBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  briefBullets: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    backgroundColor: colors.accent
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.families.body,
    fontSize: 12,
    lineHeight: 16
  },
  healthSection: {
    gap: 6
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6
  },
  healthPercent: {
    color: colors.success,
    fontFamily: typography.families.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4
  },
  healthHealthy: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  healthLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  legendText: {
    color: colors.muted,
    fontFamily: typography.families.medium,
    fontSize: 10,
    lineHeight: 13
  },
  tasksSection: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8
  },
  emptyCopy: {
    color: colors.muted,
    ...typography.body
  },
  taskRow: {
    minHeight: 48,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  pressed: {
    opacity: 0.72
  },
  taskGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontFamily: typography.families.semibold,
    fontSize: 13,
    lineHeight: 16
  },
  taskMeta: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1
  },
  priorityBadge: {
    borderRadius: radii.xl,
    backgroundColor: colors.panelStrong,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  priorityBadgeHigh: {
    backgroundColor: colors.dangerSoft
  },
  priorityText: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 10,
    lineHeight: 12
  },
  priorityTextHigh: {
    color: colors.danger
  }
});
