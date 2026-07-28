import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  Package,
  Settings,
  ShoppingCart,
  Sparkles
} from "lucide-react-native";

import { DailyBriefBoard } from "../../components/dailyBrief/DailyBriefBoard";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { MotionView } from "../../components/ui/Motion";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type { DailyOperationalBrief, OperationalFinding } from "../../services/domain/operationalFindings";
import type { OperationalFindingDecisionType } from "../../services/domain/operationalFindingDecisions";
import {
  canRestaurantRoleActOnTodayTask,
  classifyOperationalTodayTaskTiming,
  type OperationalTodayTask,
  type OperationalTodayTaskActionIntent,
  type OperationalTodayTaskTiming
} from "../../services/domain/todayTasks";
import {
  fetchDailyOperationalBrief,
  fetchQueuedOperationalFindingDecisions,
  fetchTodaySummary,
  flushQueuedOperationalFindingDecisions,
  queueOperationalFindingDecision,
  type TodayCommandCenterSummary
} from "../../services/miseService";
import { presentOperationalTodayTask } from "../../services/presentation/operationsPresentation";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";
import type { RestaurantRole } from "../../types/mise";

type TaskFilter = "now" | "up_next" | "later" | "done";
type Translator = (key: MessageKey, values?: MessageValues) => string;

export default function TodayScreen() {
  const { canUseDemoMode, continueWithDemo, memberships, restaurant, role } = useMiseSession();
  const { formatDate, formatNumber, t, locale } = useLocale();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [brief, setBrief] = useState<DailyOperationalBrief | null>(null);
  const [findingQueue, setFindingQueue] = useState<FindingDecisionOutboxEntry[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("now");
  const [snoozedTaskIds, setSnoozedTaskIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState(false);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const [briefMessageIsError, setBriefMessageIsError] = useState(false);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
    setBrief(null);
    setFindingQueue([]);
    setLoadedRestaurantId(null);
    setFilter("now");
    setSnoozedTaskIds(new Set());
    setError(null);
    setBriefError(false);
    setBriefMessage(null);
    setBriefMessageIsError(false);
    setBusyFindingId(null);
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
    setError(null);
    setBriefError(false);
    try {
      await flushQueuedOperationalFindingDecisions(restaurantId);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;

      const [nextSummary, nextBrief, nextQueue] = await Promise.all([
        fetchTodaySummary(restaurantId, { includeCompletedTasks: true }),
        fetchDailyOperationalBrief(restaurantId),
        fetchQueuedOperationalFindingDecisions(restaurantId)
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setBrief(nextBrief);
      setFindingQueue(nextQueue);
      setLoadedRestaurantId(restaurantId);
      setSnoozedTaskIds(new Set());
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "today", operation: "load", restaurant_id: restaurantId });
      setError(t("today.error"));
      setBriefError(true);
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [restaurant?.id, t]);

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

  const canManageBrief = canManageRestaurantData(memberships, restaurant?.id);

  async function submitFindingFeedback(
    finding: OperationalFinding,
    decisionType: OperationalFindingDecisionType,
    editedRecommendedAction?: string
  ) {
    if (!restaurant || !canManageBrief || busyFindingId) return;
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
    } catch (submitError) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(submitError, {
        flow: "today",
        operation: "finding_feedback",
        restaurant_id: restaurantId
      });
      const message =
        submitError instanceof Error && /permission|authorization|forbidden|denied/i.test(submitError.message)
          ? t("dailyBrief.viewOnly.body")
          : t("dailyBrief.result.error");
      setBriefMessage(message);
      setBriefMessageIsError(true);
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyFindingId(null);
    }
  }

  async function openDemo() {
    await continueWithDemo({
      preset: DEMO_DATASET.id,
      name: DEMO_DATASET.restaurant.name,
      cuisine_type: DEMO_DATASET.restaurant.cuisineType,
      posProvider: DEMO_DATASET.defaultPosProvider
    });
    router.replace("/today");
  }

  const visibleSummary = loadedRestaurantId === restaurant?.id ? summary : null;
  const visibleBrief = loadedRestaurantId === restaurant?.id ? brief : null;
  const visibleFindingQueue = loadedRestaurantId === restaurant?.id ? findingQueue : [];
  const grouped = useMemo(() => {
    if (!visibleSummary) return emptyBuckets();
    return bucketTasks(
      visibleSummary.operationalTasks.filter((task) => !snoozedTaskIds.has(task.id)),
      visibleSummary.restaurantTimeZone
    );
  }, [snoozedTaskIds, visibleSummary]);
  const visibleTasks = grouped[filter];
  const filterOptions = useMemo<readonly SegmentOption<TaskFilter>[]>(
    () =>
      (
        [
          { value: "now", labelKey: "today.filter.now", tone: "danger" },
          { value: "up_next", labelKey: "today.filter.upNext", tone: "brand" },
          { value: "later", labelKey: "today.filter.later", tone: "neutral" },
          { value: "done", labelKey: "today.filter.done", tone: "success" }
        ] as const
      ).map(({ value, labelKey, tone }) => {
        const label = t(labelKey);
        const count = grouped[value].length;
        return {
          value,
          label: count > 0 ? `${label} (${formatNumber(count)})` : label,
          accessibilityLabel: t("today.filter.optionAccessibility", { filter: label, count: formatNumber(count) }),
          tone
        };
      }),
    [formatNumber, grouped, t]
  );
  const dateLabel = useMemo(
    () => formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" }),
    [formatDate]
  );

  if (!restaurant) {
    return (
      <Screen title={t("nav.today")} subtitle={t("today.subtitle")}>
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

  return (
    <Screen title={t("nav.today")} subtitle={`${restaurant.name} · ${dateLabel}`} loading={loading}>
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("today.retry.title")}
            message={error}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("today.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {briefError && !error ? (
          <RetryNotice
            title={t("dailyBrief.retry.title")}
            message={t("dailyBrief.loadError")}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("dailyBrief.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        <MotionView distance={3} duration={220}>
          <DailyBriefBoard
            brief={visibleBrief}
            queue={visibleFindingQueue}
            canManage={canManageBrief}
            busyFindingId={busyFindingId}
            message={briefMessage}
            messageIsError={briefMessageIsError}
            onSubmitFeedback={submitFindingFeedback}
          />
        </MotionView>

        <SegmentedControl
          accessibilityLabel={t("today.filter.accessibility")}
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
          scrollable
        />

        {visibleSummary ? (
          <MotionView key={filter} distance={4} duration={220}>
            <View style={styles.timelineSurface}>
              <View style={styles.timelineHeader}>
                <View>
                  <Text style={styles.timelineTitle}>{t(filterTitleKey(filter))}</Text>
                  <Text style={styles.timelineSubtitle}>
                    {t(filter === "done" ? "today.section.done" : "today.section.active")}
                  </Text>
                </View>
                <Text style={styles.timelineCount}>{formatNumber(visibleTasks.length)}</Text>
              </View>

              {visibleTasks.length === 0 ? (
                <View style={styles.emptyTimeline}>
                  <CheckCircle2 size={26} color={colors.success} strokeWidth={2.25} />
                  <Text style={styles.emptyTitle}>{t(emptyTitleKey(filter))}</Text>
                  <Text style={styles.emptyBody}>{t("today.emptyBody")}</Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {visibleTasks.map((task, index) => (
                    <TimelineTask
                      key={task.id}
                      task={task}
                      locale={locale}
                      role={role ?? "staff"}
                      restaurantTimeZone={visibleSummary.restaurantTimeZone}
                      isFirst={index === 0}
                      isLast={index === visibleTasks.length - 1}
                      onSnooze={() => setSnoozedTaskIds((current) => new Set([...current, task.id]))}
                      t={t}
                    />
                  ))}
                </View>
              )}
            </View>
          </MotionView>
        ) : null}
      </View>
    </Screen>
  );
}

function TimelineTask({
  task,
  locale,
  role,
  restaurantTimeZone,
  isFirst,
  isLast,
  onSnooze,
  t
}: {
  task: OperationalTodayTask;
  locale: AppLocale;
  role: RestaurantRole;
  restaurantTimeZone: string;
  isFirst: boolean;
  isLast: boolean;
  onSnooze: () => void;
  t: Translator;
}) {
  const { formatDate, formatDueTime } = useLocale();
  const presentation = presentOperationalTodayTask(locale, task);
  const timing = classifyOperationalTodayTaskTiming(task, { restaurantTimeZone });
  const canAct = canRestaurantRoleActOnTodayTask(role, task);
  const high = task.priority === "urgent" || task.priority === "high";
  const timeLabel = taskTimingLabel(task, timing, restaurantTimeZone, formatDate, formatDueTime, t);
  const actionLabel = t(intentKey(task.action.intent));

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timeColumn}>
        <Text numberOfLines={1} style={[styles.timeText, high && styles.timeTextHigh]}>{timeLabel}</Text>
        <View style={styles.lineWrap}>
          {!isFirst ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
          <View style={[styles.timelineDot, high && styles.timelineDotHigh, task.status === "completed" && styles.timelineDotDone]} />
          {!isLast ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("today.task.accessibility", {
          title: presentation.title,
          detail: presentation.detail,
          action: actionLabel
        })}
        onPress={() => router.push(`/tasks/${task.id}`)}
        style={({ pressed }) => [styles.taskCard, pressed && styles.taskCardPressed]}
      >
        <View style={styles.taskCardTop}>
          <View style={[styles.taskIcon, high && styles.taskIconHigh, task.status === "completed" && styles.taskIconDone]}>
            {taskIcon(task, high ? colors.danger : task.status === "completed" ? colors.success : colors.text)}
          </View>
          <View style={styles.taskCopy}>
            <View style={styles.taskTitleRow}>
              <Text numberOfLines={2} style={styles.taskTitle}>{presentation.title}</Text>
              <View style={[styles.priorityBadge, high && styles.priorityBadgeHigh, task.status === "completed" && styles.priorityBadgeDone]}>
                <Text style={[styles.priorityText, high && styles.priorityTextHigh, task.status === "completed" && styles.priorityTextDone]}>
                  {t(task.status === "completed" ? "task.badge.done" : high ? "task.badge.high" : "task.badge.normal")}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.taskDetail}>{presentation.detail}</Text>
          </View>
        </View>

        <View style={styles.taskActions}>
          {canAct && task.status !== "completed" ? (
            <Button title={t("today.action.start")} onPress={() => router.push(task.action.route)} style={styles.startButton} />
          ) : canAct ? (
            <Button title={t("today.action.open")} variant="secondary" onPress={() => router.push(task.action.route)} style={styles.startButton} />
          ) : (
            <View style={styles.lockedAction}>
              <LockKeyhole size={14} color={colors.muted} strokeWidth={2.2} />
              <Text style={styles.lockedText}>
                {t(task.requiredRole === "owner_admin" ? "today.locked.ownerAdmin" : "today.locked.manager")}
              </Text>
            </View>
          )}
          {task.status !== "completed" ? (
            <Button title={t("today.action.snooze")} variant="secondary" onPress={onSnooze} style={styles.snoozeButton} />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function bucketTasks(tasks: OperationalTodayTask[], restaurantTimeZone: string): Record<TaskFilter, OperationalTodayTask[]> {
  const buckets = emptyBuckets();
  tasks.forEach((task) => {
    if (task.status === "completed") {
      buckets.done.push(task);
      return;
    }
    const timing = classifyOperationalTodayTaskTiming(task, { restaurantTimeZone });
    if (timing === "overdue" || timing === "due_soon") buckets.now.push(task);
    else if (timing === "today") buckets.up_next.push(task);
    else buckets.later.push(task);
  });
  return buckets;
}

function describeFindingFlush(
  summary: {
    accepted: number;
    conflicted: number;
    rejected: number;
    deferred: number;
  },
  t: Translator
) {
  if (summary.conflicted > 0) return t("dailyBrief.result.conflict");
  if (summary.rejected > 0) return t("dailyBrief.result.rejected");
  if (summary.deferred > 0) return t("dailyBrief.result.deferred");
  if (summary.accepted > 0) return t("dailyBrief.result.accepted");
  return t("dailyBrief.result.queued");
}

function emptyBuckets(): Record<TaskFilter, OperationalTodayTask[]> {
  return { now: [], up_next: [], later: [], done: [] };
}

function filterTitleKey(filter: TaskFilter): MessageKey {
  if (filter === "now") return "today.filter.now";
  if (filter === "up_next") return "today.filter.upNext";
  if (filter === "later") return "today.filter.later";
  return "today.filter.done";
}

function emptyTitleKey(filter: TaskFilter): MessageKey {
  if (filter === "done") return "today.emptyDone";
  if (filter === "now") return "today.emptyNow";
  if (filter === "up_next") return "today.emptyUpNext";
  return "today.emptyLater";
}

function taskTimingLabel(
  task: OperationalTodayTask,
  timing: OperationalTodayTaskTiming,
  restaurantTimeZone: string,
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions & { timeZone?: string }) => string,
  formatDueTime: (value: Date | number | string, options?: { timeZone?: string }) => string,
  t: Translator
) {
  if (task.dueAt) return formatDueTime(task.dueAt, { timeZone: restaurantTimeZone });
  if (timing === "overdue") return t("relative.overdue");
  if (timing === "due_soon") return t("relative.dueNow");
  if (timing === "today") return t("relative.today");
  if (task.dueDate) return formatDate(`${task.dueDate}T12:00:00.000Z`, { month: "short", day: "numeric", timeZone: "UTC" });
  return t("task.timing.noTime");
}

function intentKey(intent: OperationalTodayTaskActionIntent): MessageKey {
  if (intent === "update_inventory_count") return "today.intent.updateCount";
  if (intent === "review_recommendation") return "today.intent.reviewRecommendation";
  if (intent === "prepare_supplier_draft") return "today.intent.prepareDraft";
  if (intent === "send_supplier_order") return "today.intent.sendOrder";
  if (intent === "finish_setup") return "today.intent.finishSetup";
  if (intent === "connect_pos") return "today.intent.connectPos";
  if (intent === "review_insight") return "today.intent.reviewInsight";
  return "today.intent.manageConnection";
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 18, color, strokeWidth: 2.2 } as const;
  if (task.source.kind === "inventory") return <Package {...props} />;
  if (task.source.kind === "recommendation" || task.source.kind === "order") return <ShoppingCart {...props} />;
  if (task.source.kind === "setup") return <Settings {...props} />;
  if (task.source.kind === "integration") return <ClipboardList {...props} />;
  return <Sparkles {...props} />;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  emptyButton: {
    marginTop: 12
  },
  timelineSurface: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  timelineHeader: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  timelineTitle: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 18,
    lineHeight: 23
  },
  timelineSubtitle: {
    color: colors.muted,
    fontFamily: typography.families.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2
  },
  timelineCount: {
    color: colors.accentDark,
    fontFamily: typography.families.bold,
    fontSize: 21,
    lineHeight: 26
  },
  emptyTimeline: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  emptyTitle: {
    color: colors.text,
    ...typography.cardTitle,
    marginTop: 10
  },
  emptyBody: {
    color: colors.muted,
    ...typography.body,
    textAlign: "center",
    marginTop: 4
  },
  timelineList: {
    paddingVertical: 4
  },
  timelineRow: {
    flexDirection: "row",
    paddingRight: 12
  },
  timeColumn: {
    width: 76,
    alignItems: "center"
  },
  timeText: {
    width: 70,
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 15
  },
  timeTextHigh: {
    color: colors.danger
  },
  lineWrap: {
    flex: 1,
    minHeight: 92,
    alignItems: "center",
    marginTop: 4
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border
  },
  timelineLineTransparent: {
    width: 1,
    flex: 1,
    backgroundColor: "transparent"
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.borderStrong,
    marginVertical: 2
  },
  timelineDotHigh: {
    backgroundColor: colors.danger
  },
  timelineDotDone: {
    backgroundColor: colors.success
  },
  taskCard: {
    flex: 1,
    minWidth: 0,
    marginVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12
  },
  taskCardPressed: {
    backgroundColor: colors.surfaceWarm
  },
  taskCardTop: {
    flexDirection: "row",
    gap: 10
  },
  taskIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  taskIconHigh: {
    backgroundColor: colors.dangerSoft
  },
  taskIconDone: {
    backgroundColor: colors.successSoft
  },
  taskCopy: {
    flex: 1,
    minWidth: 0
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  taskTitle: {
    flex: 1,
    color: colors.text,
    ...typography.cardTitle,
    fontSize: 14,
    lineHeight: 19
  },
  taskDetail: {
    color: colors.muted,
    ...typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  priorityBadge: {
    borderRadius: radii.xl,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.panelStrong
  },
  priorityBadgeHigh: {
    backgroundColor: colors.dangerSoft
  },
  priorityBadgeDone: {
    backgroundColor: colors.successSoft
  },
  priorityText: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 11,
    lineHeight: 14
  },
  priorityTextHigh: {
    color: colors.danger
  },
  priorityTextDone: {
    color: colors.success
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12
  },
  startButton: {
    flex: 1
  },
  snoozeButton: {
    minWidth: 96
  },
  lockedAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.panel
  },
  lockedText: {
    color: colors.muted,
    ...typography.caption
  }
});
