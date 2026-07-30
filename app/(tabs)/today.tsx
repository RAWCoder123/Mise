import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CalendarDays, CheckCircle2, LockKeyhole } from "lucide-react-native";

import { DailyBriefBoard } from "../../components/dailyBrief/DailyBriefBoard";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProduceCrateIllustration } from "../../components/ui/MiseIllustrations";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, density, typography } from "../../constants/theme";
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

const GROUP_CAPS: Record<TaskFilter, number> = {
  now: 1,
  up_next: 2,
  later: 4,
  done: 2
};

const GROUP_ORDER: readonly TaskFilter[] = ["now", "up_next", "later", "done"];

export default function TodayScreen() {
  const { canUseDemoMode, continueWithDemo, memberships, restaurant, role } = useMiseSession();
  const { formatDate, formatNumber, t, locale } = useLocale();
  const [summary, setSummary] = useState<TodayCommandCenterSummary | null>(null);
  const [brief, setBrief] = useState<DailyOperationalBrief | null>(null);
  const [findingQueue, setFindingQueue] = useState<FindingDecisionOutboxEntry[]>([]);
  const [focus, setFocus] = useState<TaskFilter>("now");
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
    setFocus("now");
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

  const timelineGroups = useMemo(() => {
    const focusedFirst = [focus, ...GROUP_ORDER.filter((value) => value !== focus)];
    return focusedFirst
      .map((key) => ({
        key,
        label: t(groupLabelKey(key)),
        tasks: grouped[key].slice(0, GROUP_CAPS[key]),
        total: grouped[key].length
      }))
      .filter((group) => group.total > 0 || group.key === focus);
  }, [focus, grouped, t]);

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

  const flatTimeline = useMemo(() => {
    const rows: { task: OperationalTodayTask; group: TaskFilter; showPrimary: boolean }[] = [];
    timelineGroups.forEach((group) => {
      group.tasks.forEach((task, index) => {
        rows.push({
          task,
          group: group.key,
          showPrimary: group.key === "now" && index === 0 && task.status !== "completed"
        });
      });
    });
    return rows;
  }, [timelineGroups]);

  const dateLabel = useMemo(
    () => formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" }),
    [formatDate]
  );

  if (!restaurant) {
    return (
      <Screen title={t("nav.today")} subtitle={t("today.subtitle")} titleAlign="left">
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
    <Screen
      title={t("nav.today")}
      subtitle={`${restaurant.name} · ${dateLabel}`}
      titleAlign="left"
      loading={loading}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("nav.today")}
          hitSlop={8}
          onPress={() => setFocus("now")}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <CalendarDays size={18} color={colors.text} strokeWidth={1.9} />
        </Pressable>
      }
    >
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

        <SegmentedControl
          accessibilityLabel={t("today.filter.accessibility")}
          options={filterOptions}
          value={focus}
          onValueChange={setFocus}
          variant="pills"
          scrollable
        />

        {visibleSummary ? (
          flatTimeline.length === 0 ? (
            <View style={styles.emptyTimeline}>
              <CheckCircle2 size={22} color={colors.success} strokeWidth={2.25} />
              <Text style={styles.emptyTitle}>{t(emptyTitleKey(focus))}</Text>
              <Text style={styles.emptyBody}>{t("today.emptyBody")}</Text>
            </View>
          ) : (
            <View style={styles.timelineList}>
              {timelineGroups.map((group) => {
                if (group.tasks.length === 0) return null;
                const groupStartIndex = flatTimeline.findIndex((row) => row.group === group.key);
                return (
                  <View key={group.key} style={styles.timelineGroup}>
                    <Text style={styles.groupLabel}>
                      {group.label}
                      {group.total > 0 ? ` · ${formatNumber(group.total)}` : ""}
                    </Text>
                    {group.tasks.map((task, index) => {
                      const globalIndex = groupStartIndex + index;
                      return (
                        <TimelineTask
                          key={task.id}
                          task={task}
                          locale={locale}
                          role={role ?? "staff"}
                          restaurantTimeZone={visibleSummary.restaurantTimeZone}
                          isFirst={globalIndex === 0}
                          isLast={globalIndex === flatTimeline.length - 1}
                          showPrimaryAction={group.key === "now" && index === 0}
                          onSnooze={() => setSnoozedTaskIds((current) => new Set([...current, task.id]))}
                          t={t}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )
        ) : null}

        <View style={styles.briefContinuation}>
          <DailyBriefBoard
            brief={visibleBrief}
            queue={visibleFindingQueue}
            canManage={canManageBrief}
            busyFindingId={busyFindingId}
            message={briefMessage}
            messageIsError={briefMessageIsError}
            onSubmitFeedback={submitFindingFeedback}
            compact
            onOpen={() => router.push("/insights")}
          />
        </View>
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
  showPrimaryAction,
  onSnooze,
  t
}: {
  task: OperationalTodayTask;
  locale: AppLocale;
  role: RestaurantRole;
  restaurantTimeZone: string;
  isFirst: boolean;
  isLast: boolean;
  showPrimaryAction: boolean;
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
    <View style={[styles.timelineRow, showPrimaryAction && styles.timelineRowActive]}>
      <View style={styles.timeColumn}>
        <Text numberOfLines={1} style={[styles.timeText, high && styles.timeTextHigh]}>{timeLabel}</Text>
        <View style={styles.lineWrap}>
          {!isFirst ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
          <View style={[styles.timelineDot, high && styles.timelineDotHigh, task.status === "completed" && styles.timelineDotDone]} />
          {!isLast ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
        </View>
      </View>

      <View style={[styles.taskContent, showPrimaryAction && styles.taskContentActive]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("today.task.accessibility", {
            title: presentation.title,
            detail: presentation.detail,
            action: actionLabel
          })}
          onPress={() => router.push(`/tasks/${task.id}`)}
          style={({ pressed }) => [styles.taskMain, pressed && styles.pressed]}
        >
          <View style={styles.taskCopy}>
            <View style={styles.taskTitleRow}>
              <Text numberOfLines={1} style={styles.taskTitle}>{presentation.title}</Text>
              <View style={[styles.priorityBadge, high && styles.priorityBadgeHigh, task.status === "completed" && styles.priorityBadgeDone]}>
                <Text style={[styles.priorityText, high && styles.priorityTextHigh, task.status === "completed" && styles.priorityTextDone]}>
                  {t(task.status === "completed" ? "task.badge.done" : high ? "task.badge.high" : "task.badge.normal")}
                </Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.taskDetail}>{presentation.detail}</Text>
          </View>
        </Pressable>

        {showPrimaryAction && canAct && task.status !== "completed" ? (
          <View style={styles.taskActions}>
            <Button
              title={t("today.action.snooze")}
              variant="secondary"
              size="compact"
              onPress={onSnooze}
              style={styles.snoozeButton}
            />
            <Button
              title={t("today.action.start")}
              size="compact"
              onPress={() => router.push(task.action.route)}
              style={styles.startButton}
            />
          </View>
        ) : showPrimaryAction && !canAct && task.status !== "completed" ? (
          <View style={styles.lockedAction}>
            <LockKeyhole size={12} color={colors.muted} strokeWidth={2.2} />
            <Text style={styles.lockedText}>
              {t(task.requiredRole === "owner_admin" ? "today.locked.ownerAdmin" : "today.locked.manager")}
            </Text>
          </View>
        ) : null}
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
  t: Translator
) {
  if (summary.conflicted > 0) return t("dailyBrief.result.conflict");
  if (summary.rejected > 0) return t("dailyBrief.result.rejected");
  if (summary.deferred > 0) return t("dailyBrief.result.deferred");
  if (summary.accepted > 0) return t("dailyBrief.result.accepted");
  return t("dailyBrief.result.queued");
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

function emptyBuckets(): Record<TaskFilter, OperationalTodayTask[]> {
  return { now: [], up_next: [], later: [], done: [] };
}

function groupLabelKey(filter: TaskFilter): MessageKey {
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

const styles = StyleSheet.create({
  stack: {
    gap: 6
  },
  emptyButton: {
    marginTop: 12
  },
  headerAction: {
    width: density.hitTarget,
    height: density.hitTarget,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTimeline: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 4
  },
  emptyTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginTop: 4
  },
  emptyBody: {
    color: colors.muted,
    ...conceptTypography.body,
    textAlign: "center"
  },
  timelineList: {
    gap: 0
  },
  timelineGroup: {
    gap: 0
  },
  groupLabel: {
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "left",
    marginBottom: 2,
    marginTop: 6,
    paddingLeft: 0
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: density.timelineRow,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  timelineRowActive: {
    minHeight: density.timelineRowActive
  },
  timeColumn: {
    width: density.timeColumn,
    alignItems: "center"
  },
  timeText: {
    width: density.timeColumn - 4,
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "center",
    marginTop: 8
  },
  timeTextHigh: {
    color: colors.danger
  },
  lineWrap: {
    flex: 1,
    minHeight: 20,
    alignItems: "center",
    marginTop: 2
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    backgroundColor: colors.border
  },
  timelineLineTransparent: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    backgroundColor: "transparent"
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginVertical: 2
  },
  timelineDotHigh: {
    backgroundColor: colors.danger
  },
  timelineDotDone: {
    backgroundColor: colors.success
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 6,
    paddingRight: 2,
    paddingLeft: 2
  },
  taskContentActive: {
    paddingVertical: 8,
    justifyContent: "flex-start"
  },
  taskMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  taskCopy: {
    flex: 1,
    minWidth: 0
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  taskTitle: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  taskDetail: {
    color: colors.muted,
    ...conceptTypography.caption,
    fontFamily: typography.families.body,
    marginTop: 1
  },
  priorityBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
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
    ...conceptTypography.caption
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
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 6
  },
  startButton: {
    minWidth: 72
  },
  snoozeButton: {
    minWidth: 64
  },
  lockedAction: {
    marginTop: 6,
    minHeight: 26,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.panel
  },
  lockedText: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  briefContinuation: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  pressed: {
    opacity: 0.72
  }
});
