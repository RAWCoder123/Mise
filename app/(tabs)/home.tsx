import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, ClipboardCheck, Package, ShoppingCart, Sparkles, Store, TriangleAlert } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  getInventoryHealthTotal,
  getWellStockedPercentage,
  type InventoryHealthCounts
} from "../../components/ui/InventoryHealth";
import { InventoryHealthSummaryCard } from "../../components/ui/InventoryHealthSummaryCard";
import { OperationalRow } from "../../components/ui/OperationalRow";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { CompactMetricStrip } from "../../components/ui/CompactMetricStrip";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, fontFamilies, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import type { ActivityEvent } from "../../services/domain/activityEvents";
import type {
  OperatingBrief,
  OperatingBriefApprovalCard
} from "../../services/domain/operatingBrief";
import {
  classifyOperationalTodayTaskTiming,
  type OperationalTodayTask,
  type OperationalTodayTaskTiming
} from "../../services/domain/todayTasks";
import {
  approveOperatingDecision,
  fetchOperatingBrief,
  fetchTodaySummary,
  type TodayCommandCenterSummary
} from "../../services/miseService";
import { runScheduledRecalculations } from "../../services/application/scheduledRecalculations";
import type { RecalculationAttentionSummary } from "../../services/presentation/recalculationPresentation";
import { presentOperationalTodayTask } from "../../services/presentation/operationsPresentation";
import { captureMiseError } from "../../services/telemetry";

type Translator = (key: MessageKey, values?: MessageValues) => string;

export default function HomeScreen() {
  const { canUseDemoMode, continueWithDemo, restaurant, user } = useMiseSession();
  const { formatCurrency, formatNumber, t, locale } = useLocale();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [brief, setBrief] = useState<OperatingBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const [recalcAttention, setRecalcAttention] =
    useState<RecalculationAttentionSummary | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  const lastSeenSessionRef = useRef<{ restaurantId: string; value: string } | null>(null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
    setBrief(null);
    setLoadedRestaurantId(null);
    setError(null);
    setApprovingId(null);
    setApprovalNotice(null);
    setRecalcAttention(null);
    lastSeenSessionRef.current = null;
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
      let lastSeenAt = lastSeenSessionRef.current?.restaurantId === restaurantId
        ? lastSeenSessionRef.current.value
        : null;
      if (!lastSeenAt) {
        const openedAt = new Date().toISOString();
        try {
          const stored = await AsyncStorage.getItem(operatingBriefSeenKey(restaurantId));
          lastSeenAt = stored && Number.isFinite(Date.parse(stored))
            ? new Date(stored).toISOString()
            : new Date(Date.parse(openedAt) - 12 * 60 * 60 * 1000).toISOString();
          await AsyncStorage.setItem(operatingBriefSeenKey(restaurantId), openedAt);
        } catch {
          lastSeenAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        }
        lastSeenSessionRef.current = { restaurantId, value: lastSeenAt };
      }
      // Dispatch any due recalculation cycles before reading, so the screen
      // always renders post-recalculation state rather than racing it.
      const recalculation = await runScheduledRecalculations({
        restaurantId,
        restaurantTimeZone: restaurant.timezone
      });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setRecalcAttention(recalculation);

      const [nextSummary, nextBrief] = await Promise.all([
        fetchTodaySummary(restaurantId),
        fetchOperatingBrief(restaurantId, { lastSeenAt })
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setBrief(nextBrief);
      setLoadedRestaurantId(restaurantId);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "home", operation: "load", restaurant_id: restaurantId });
      setError(t("home.error"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id, restaurant?.timezone, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        lastSeenSessionRef.current = null;
      };
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
  const visibleBrief = loadedRestaurantId === restaurant?.id ? brief : null;

  if (!restaurant) {
    return (
      <Screen title={t("nav.home")} subtitle={t("home.subtitle.noRestaurant")}>
        <EmptyState
          title={t("workspace.none.title")}
          body={t(canUseDemoMode ? "workspace.none.demoBody" : "workspace.none.body")}
          illustration={<Store size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
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
          <ChevronDown size={icon.inline} color={colors.muted} strokeWidth={iconStroke} />
        </Pressable>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{t(greetingKeyForNow(), { name: greetingName })}</Text>
          <Text style={styles.greetingSubtext} numberOfLines={2}>
            {t("home.greeting.subtext", { restaurant: restaurant.name })}
          </Text>
          {visibleBrief?.demoLabeled ? (
            <Text style={styles.demoLabel}>{t("home.demo.label")}</Text>
          ) : null}
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

        {recalcAttention ? (
          <StatusNotice
            tone="warning"
            title={t("home.recalculation.title")}
            message={
              recalcAttention.state === "unavailable"
                ? t("home.recalculation.unavailable")
                : t(
                    recalcAttention.deadLetteredCount === 1
                      ? "home.recalculation.body.one"
                      : "home.recalculation.body.other",
                    { count: formatNumber(recalcAttention.deadLetteredCount) }
                  )
            }
            actionLabel={t("home.recalculation.action")}
            onAction={() => router.push("/more/activity")}
          />
        ) : null}

        {visibleBrief ? <RestaurantStatusCard brief={visibleBrief} t={t} /> : null}

        {visibleSummary ? (
          <>
            <HomeMetrics
              summary={visibleSummary}
              formatSalesCurrency={(value, currency) =>
                formatCurrency(value, { currency, maximumFractionDigits: 0 })
              }
              formatNumber={formatNumber}
              t={t}
            />
            <DailyBriefing summary={visibleSummary} formatNumber={formatNumber} t={t} />
            <InventoryBrief counts={visibleSummary.inventoryHealth} formatNumber={formatNumber} t={t} />
            <TopTasks
              tasks={visibleSummary.operationalTasks}
              restaurantTimeZone={visibleSummary.restaurantTimeZone}
              locale={locale}
              t={t}
            />
          </>
        ) : null}

        {approvalNotice ? (
          <Text style={styles.approvalNotice} accessibilityLiveRegion="polite">
            {approvalNotice}
          </Text>
        ) : null}

        {visibleBrief ? (
          <ApprovalsSection
            brief={visibleBrief}
            approvingId={approvingId}
            t={t}
            onApprove={async (card) => {
              if (!restaurant || approvingId) return;
              if (!card.recommendationId && !card.actionId) {
                router.push("/orders");
                return;
              }
              setApprovingId(card.id);
              setApprovalNotice(null);
              try {
                const decisionResult = await approveOperatingDecision(restaurant.id, {
                  recommendationId: card.recommendationId,
                  actionId: card.actionId,
                  quantity: card.quantity ?? undefined
                });
                if (activeRestaurantIdRef.current !== restaurant.id) return;
                setApprovalNotice(
                  t(
                    decisionResult.kind === "action_executed"
                      ? "home.approvals.sent"
                      : "home.approvals.approved"
                  )
                );
                await load();
              } catch (approveError) {
                captureMiseError(approveError, {
                  flow: "home",
                  operation: "approve",
                  restaurant_id: restaurant.id
                });
                if (activeRestaurantIdRef.current === restaurant.id) {
                  setApprovalNotice(t("home.approvals.approveError"));
                }
              } finally {
                if (activeRestaurantIdRef.current === restaurant.id) setApprovingId(null);
              }
            }}
          />
        ) : null}

        {visibleBrief ? <ActivitySection brief={visibleBrief} t={t} /> : null}

        <Button
          title={t("home.ask.entry")}
          accessibilityLabel={t("home.ask.accessibility")}
          variant="secondary"
          icon={<Sparkles size={icon.row} color={colors.text} strokeWidth={iconStroke} />}
          onPress={() => router.push("/ask-mise" as never)}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function RestaurantStatusCard({
  brief,
  t
}: {
  brief: OperatingBrief;
  t: Translator;
}) {
  // A healthy morning needs no banner at all — the concept only shows this
  // block when something is actually wrong.
  if (brief.restaurantStatus.status === "on_track") return null;

  const statusKey =
    brief.restaurantStatus.status === "attention_needed"
      ? "home.status.attention_needed"
      : "home.status.at_risk";

  return (
    <StatusNotice
      variant="row"
      tone={brief.restaurantStatus.status === "attention_needed" ? "warning" : "danger"}
      title={t(statusKey)}
      message={brief.restaurantStatus.summary}
      onPress={() => router.push(brief.needsApproval.length > 0 ? "/orders" : "/today")}
    />
  );
}

function ApprovalsSection({
  brief,
  approvingId,
  t,
  onApprove
}: {
  brief: OperatingBrief;
  approvingId: string | null;
  t: Translator;
  onApprove: (card: OperatingBriefApprovalCard) => void | Promise<void>;
}) {
  const cards = brief.needsApproval.slice(0, 3);
  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("home.approvals.title")}
        action={t("home.approvals.action")}
        onAction={() => router.push("/orders")}
      />
      {cards.length === 0 ? (
        <Text style={styles.emptyCopy}>{t("home.approvals.empty")}</Text>
      ) : (
        cards.map((card) => {
          const canOneTap = Boolean(card.recommendationId || card.actionId);
          return (
            <View key={card.id} style={styles.briefCard}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.recommendedAction}</Text>
              <Text style={styles.metaLine}>{t("home.approvals.why")}: {card.whyItMatters}</Text>
              <View style={styles.approvalActions}>
                <Button
                  title={
                    approvingId === card.id
                      ? t("home.approvals.approving")
                      : canOneTap
                        ? t("home.approvals.approve")
                        : t("home.approvals.review")
                  }
                  onPress={() => void onApprove(card)}
                  disabled={Boolean(approvingId)}
                  style={styles.approvalButton}
                />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function ActivitySection({ brief, t }: { brief: OperatingBrief; t: Translator }) {
  const events = brief.liveActivity.slice(0, 5);
  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("home.activity.title")}
        action={t("home.activity.history")}
        onAction={() => router.push("/more/activity" as never)}
      />
      {events.length === 0 ? (
        <Text style={styles.emptyCopy}>{t("home.activity.empty")}</Text>
      ) : (
        events.map((event) => <ActivityRow key={event.id} event={event} />)
      )}
    </View>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const time = event.occurredAt.slice(11, 16);
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityTime}>{time || "--:--"}</Text>
      <View style={styles.activityCopy}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.cardBody} numberOfLines={2}>{event.summary}</Text>
      </View>
    </View>
  );
}

function HomeMetrics({
  summary,
  formatSalesCurrency,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatSalesCurrency: (value: number, currency?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open");
  const highPriority = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const salesDelta = buildSalesDelta(summary, formatNumber);
  // Average ticket gives the second cell a real comparison instead of a gap.
  const averageTicket =
    summary.itemsSold > 0
      ? formatSalesCurrency(summary.salesToday / summary.itemsSold, summary.restaurantCurrency)
      : undefined;

  return (
    <View style={styles.metricsBlock}>
      <SectionHeader
        title={t("home.glance.title")}
        action={t("common.viewAll")}
        onAction={() => router.push("/insights")}
      />
      <CompactMetricStrip
        accessibilityLabel={t("home.metrics.accessibility")}
        metrics={[
          {
            id: "sales",
            label: t("home.metric.sales"),
            value: formatSalesCurrency(summary.salesToday, summary.restaurantCurrency),
            delta: salesDelta?.label,
            deltaTone: salesDelta?.tone === "success" ? "success" : salesDelta?.tone === "danger" ? "danger" : "default",
            comparison: salesDelta ? t("home.metric.vsYesterday") : undefined
          },
          {
            id: "sold",
            label: t("home.metric.itemsSold"),
            value: formatNumber(summary.itemsSold),
            delta: averageTicket,
            deltaTone: "default",
            comparison: averageTicket ? t("home.metric.avgTicket") : undefined
          },
          {
            id: "tasks",
            label: t("home.metric.openTasks"),
            value: formatNumber(openTasks.length),
            tone: openTasks.length > 0 ? "default" : "success",
            delta: highPriority > 0 ? formatNumber(highPriority) : undefined,
            deltaTone: "danger",
            comparison: highPriority > 0 ? t("home.metric.highPriority") : undefined
          },
          {
            id: "orders",
            label: t("home.metric.orderReview"),
            value: formatNumber(summary.pendingRecommendations),
            tone: summary.pendingRecommendations > 0 ? "caution" : "success",
            delta:
              summary.pendingRecommendations > 0
                ? formatNumber(summary.pendingRecommendations)
                : undefined,
            deltaTone: "caution",
            comparison:
              summary.pendingRecommendations > 0 ? t("home.metric.awaiting") : undefined
          }
        ]}
      />
    </View>
  );
}

function DailyBriefing({
  summary,
  formatNumber,
  t
}: {
  summary: TodayCommandCenterSummary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: Translator;
}) {
  const openTasks = summary.operationalTasks.filter((task) => task.status === "open").length;
  const stockAlerts = summary.inventoryHealth.watch + summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const reorderCount = summary.inventoryHealth.low + summary.inventoryHealth.critical;
  const highPriority = summary.operationalTasks.filter(
    (task) => task.status === "open" && (task.priority === "urgent" || task.priority === "high")
  ).length;
  const rows = [
    {
      id: "tasks",
      label: t(openTasks === 1 ? "home.brief.bullet.tasks.one" : "home.brief.bullet.tasks.other", {
        count: formatNumber(openTasks)
      }),
      sublabel: t("home.brief.sub.tasks", { count: formatNumber(highPriority) }),
      icon: <ClipboardCheck size={12} color={openTasks > 0 ? colors.danger : colors.success} strokeWidth={iconStroke} />,
      tint: openTasks > 0 ? colors.dangerSoft : colors.successSoft
    },
    {
      id: "orders",
      label: t(summary.pendingRecommendations === 1 ? "home.brief.bullet.orders.one" : "home.brief.bullet.orders.other", {
        count: formatNumber(summary.pendingRecommendations)
      }),
      sublabel: t("home.brief.sub.orders", { count: formatNumber(summary.pendingRecommendations) }),
      icon: (
        <ShoppingCart
          size={12}
          color={summary.pendingRecommendations > 0 ? colors.caution : colors.success}
          strokeWidth={iconStroke}
        />
      ),
      tint: summary.pendingRecommendations > 0 ? colors.cautionSoft : colors.successSoft
    },
    {
      id: "stock",
      label: t(stockAlerts === 1 ? "home.brief.bullet.stock.one" : "home.brief.bullet.stock.other", {
        count: formatNumber(stockAlerts)
      }),
      sublabel: t("home.brief.sub.stock", { count: formatNumber(reorderCount) }),
      icon: <TriangleAlert size={12} color={stockAlerts > 0 ? colors.warning : colors.success} strokeWidth={iconStroke} />,
      tint: stockAlerts > 0 ? colors.warningSoft : colors.successSoft
    }
  ];

  return (
    <View style={styles.briefingSection}>
      <SectionHeader
        title={t("home.brief.title")}
        action={t("home.brief.action")}
        onAction={() => router.push("/insights")}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.brief.heading")}
        onPress={() => router.push("/today")}
        style={({ pressed }) => [styles.briefingCard, pressed && styles.pressed]}
      >
        <View style={styles.briefingCopy}>
          <Text style={styles.briefingTitle}>{t("home.brief.heading")}</Text>
          {rows.map((row) => (
            <View key={row.id} style={styles.briefingRow}>
              <View style={[styles.briefingIcon, { backgroundColor: row.tint }]}>{row.icon}</View>
              <View style={styles.briefingRowCopy}>
                <Text numberOfLines={1} style={styles.briefingText}>{row.label}</Text>
                <Text numberOfLines={1} style={styles.briefingSub}>{row.sublabel}</Text>
              </View>
            </View>
          ))}
        </View>
      </Pressable>
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
      <SectionHeader
        title={t("home.health.title")}
        action={t("home.health.action")}
        onAction={() => router.push("/inventory")}
      />
      <InventoryHealthSummaryCard
        layout="inline"
        counts={counts}
        percentLabel={total === 0 ? formatNumber(0, { style: "percent" }) : percent}
        chipLabel={t("home.health.healthy")}
        chipTone="success"
      />
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
      <SectionHeader
        title={t("home.tasks.title")}
        action={t("common.viewAll")}
        onAction={() => router.push("/today")}
      />
      {openTasks.length === 0 ? (
        <Text style={styles.emptyCopy}>{t("home.tasks.empty")}</Text>
      ) : (
        openTasks.map((task) => (
          <HomeTaskRow
            key={task.id}
            task={task}
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
  restaurantTimeZone,
  locale,
  t
}: {
  task: OperationalTodayTask;
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
    <OperationalRow
      title={presentation.title}
      subtitle={timeLabel}
      icon={taskIcon(task, high ? colors.danger : colors.text)}
      iconTone={high ? "danger" : "brand"}
      badgeLabel={t(high ? "task.badge.high" : "task.badge.normal")}
      badgeTone={high ? "danger" : "neutral"}
      onPress={() => router.push(`/tasks/${task.id}`)}
    />
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
  const props = { size: 18, color, strokeWidth: 2.15 } as const;
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

function operatingBriefSeenKey(restaurantId: string) {
  return `mise.operating-brief.last-seen.v1:${restaurantId}`;
}

const styles = StyleSheet.create({
  stack: {
    gap: 12
  },
  emptyButton: {
    marginTop: 16
  },
  restaurantChip: {
    alignSelf: "flex-start",
    minHeight: 30,
    maxWidth: "88%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    // panel (#F7F7F5) is nearly the canvas value, so the chip needs white.
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  restaurantChipText: {
    color: colors.text,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 15
  },
  greetingBlock: {
    gap: 2
  },
  greeting: {
    color: colors.text,
    ...conceptTypography.greeting
  },
  greetingSubtext: {
    color: colors.muted,
    ...conceptTypography.subtitle
  },
  demoLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.medium,
    fontSize: 10,
    lineHeight: 13
  },
  metaLine: {
    color: colors.faint,
    fontFamily: fontFamilies.medium,
    fontSize: 9,
    lineHeight: 12
  },
  metricsBlock: {
    gap: 0
  },
  section: {
    gap: 6
  },
  briefCard: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4
  },
  cardTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  cardBody: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: conceptTypography.body.fontFamily,
    lineHeight: 15
  },
  activityRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  activityTime: {
    width: 38,
    color: colors.muted,
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    lineHeight: 14
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  healthSection: {
    gap: 0
  },
  tasksSection: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10
  },
  emptyCopy: {
    color: colors.muted,
    ...conceptTypography.body
  },
  approvalNotice: {
    color: colors.muted,
    ...conceptTypography.body
  },
  approvalActions: {
    marginTop: 4
  },
  approvalButton: {
    alignSelf: "flex-start"
  },
  briefingSection: {
    gap: 0
  },
  briefingCard: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  briefingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  briefingTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  briefingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  briefingIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  briefingRowCopy: {
    flex: 1,
    minWidth: 0
  },
  briefingText: {
    color: colors.text,
    ...conceptTypography.caption
  },
  briefingSub: {
    color: colors.faint,
    ...conceptTypography.micro
  },
  pressed: {
    opacity: 0.72
  }
});
