import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CalendarDays } from "lucide-react-native";

import { DailyBriefBoard } from "../../components/dailyBrief/DailyBriefBoard";
import { OperatingPlanTimeline } from "../../components/operations/OperatingPlanTimeline";
import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import { useNotificationPreferences } from "../../contexts/NotificationPreferencesContext";
import type { MessageKey, MessageValues } from "../../i18n/catalog";
import { DEMO_DATASET } from "../../services/demoData";
import type { FindingDecisionOutboxEntry } from "../../services/domain/findingDecisionOutbox";
import type { DailyOperationalBrief, OperationalFinding } from "../../services/domain/operationalFindings";
import type { OperationalFindingDecisionType } from "../../services/domain/operationalFindingDecisions";
import { filterOperatingPlanByNotificationPreferences } from "../../services/domain/notificationPreferences";
import type { DailyOperatingPlan, OperatingPlanBucket } from "../../services/domain/operatingPlan";
import {
  completeOperatorTask,
  fetchDailyOperatingPlan,
  fetchDailyOperationalBrief,
  fetchQueuedOperationalFindingDecisions,
  flushQueuedOperationalFindingDecisions,
  listOpenOperatorTasks,
  operatorTaskFocusRoute,
  queueOperationalFindingDecision,
  type OperatorTask
} from "../../services/miseService";
import {
  presentRestaurantScopedHubActionsEditable,
  resolveRestaurantScopedHubLoadState
} from "../../services/presentation/hubLoadState";
import { canManageRestaurantData } from "../../services/tenantAccess";
import { captureMiseError } from "../../services/telemetry";

type TaskFilter = OperatingPlanBucket;
type Translator = (key: MessageKey, values?: MessageValues) => string;

const GROUP_CAPS: Record<TaskFilter, number> = {
  now: 2,
  up_next: 3,
  later: 1,
  done: 1
};

const GROUP_ORDER: readonly TaskFilter[] = ["now", "up_next", "later", "done"];

export default function TodayScreen() {
  const { canUseDemoMode, continueWithDemo, memberships, restaurant, role } = useMiseSession();
  const { formatNumber, t, locale } = useLocale();
  const { preferences: notificationPreferences } = useNotificationPreferences();
  const [summary, setSummary] = useState<DailyOperatingPlan | null>(null);
  const [brief, setBrief] = useState<DailyOperationalBrief | null>(null);
  const [findingQueue, setFindingQueue] = useState<FindingDecisionOutboxEntry[]>([]);
  const [floorNotes, setFloorNotes] = useState<OperatorTask[]>([]);
  const [focus, setFocus] = useState<TaskFilter>("now");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState(false);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const [briefMessageIsError, setBriefMessageIsError] = useState(false);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [busyFloorNoteId, setBusyFloorNoteId] = useState<string | null>(null);
  const [floorNoteMessage, setFloorNoteMessage] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(null);
    setBrief(null);
    setFindingQueue([]);
    setFloorNotes([]);
    setLoadedRestaurantId(null);
    setFocus("now");
    setError(null);
    setBriefError(false);
    setBriefMessage(null);
    setBriefMessageIsError(false);
    setBusyFindingId(null);
    setBusyFloorNoteId(null);
    setFloorNoteMessage(null);
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

      const [nextSummary, nextBrief, nextQueue, nextFloorNotes] = await Promise.all([
        fetchDailyOperatingPlan(restaurantId, { includeCompletedTasks: true }),
        fetchDailyOperationalBrief(restaurantId),
        fetchQueuedOperationalFindingDecisions(restaurantId),
        listOpenOperatorTasks(restaurantId).catch(() => [] as OperatorTask[])
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setSummary(nextSummary);
      setBrief(nextBrief);
      setFindingQueue(nextQueue);
      setFloorNotes(nextFloorNotes);
      setLoadedRestaurantId(restaurantId);
      setFloorNoteMessage(null);
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
  const hubLoadState = resolveRestaurantScopedHubLoadState({
    restaurantId: restaurant?.id,
    loadedRestaurantId,
    loadError: Boolean(error)
  });
  const hubReady = hubLoadState === "ready";
  const actionsEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManageBrief,
    hubReady,
    busy: Boolean(busyFindingId)
  });
  const floorNotesEditable = presentRestaurantScopedHubActionsEditable({
    allowed: canManageBrief,
    hubReady,
    busy: Boolean(busyFloorNoteId)
  });

  async function markFloorNoteDone(note: OperatorTask) {
    if (!restaurant || !floorNotesEditable) return;
    const restaurantId = restaurant.id;
    setBusyFloorNoteId(note.id);
    setFloorNoteMessage(null);
    try {
      await completeOperatorTask({ restaurantId, taskId: note.id });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setFloorNotes((current) => current.filter((candidate) => candidate.id !== note.id));
    } catch (completeError) {
      captureMiseError(completeError, {
        flow: "today",
        operation: "complete_operator_task",
        restaurant_id: restaurantId
      });
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setFloorNoteMessage(t("today.floorNotes.completeError"));
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) setBusyFloorNoteId(null);
    }
  }

  async function submitFindingFeedback(
    finding: OperationalFinding,
    decisionType: OperationalFindingDecisionType,
    editedRecommendedAction?: string
  ) {
    if (!restaurant || !actionsEditable || busyFindingId) return;
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

  const visibleSummary = useMemo(() => {
    if (!hubReady || !summary) return null;
    return filterOperatingPlanByNotificationPreferences(summary, notificationPreferences);
  }, [hubReady, notificationPreferences, summary]);
  const visibleBrief = hubReady ? brief : null;
  const visibleFindingQueue = hubReady ? findingQueue : [];
  const visibleFloorNotes = hubReady ? floorNotes : [];
  const groupedFloorNotes = useMemo(() => {
    const buckets: Record<"now" | "up_next" | "later", OperatorTask[]> = {
      now: [],
      up_next: [],
      later: []
    };
    visibleFloorNotes.forEach((note) => {
      buckets[note.timing].push(note);
    });
    return buckets;
  }, [visibleFloorNotes]);

  const grouped = useMemo(() => {
    if (!visibleSummary) return emptyBuckets();
    const buckets = emptyBuckets();
    for (const key of GROUP_ORDER) {
      buckets[key] = visibleSummary.buckets[key];
    }
    return buckets;
  }, [visibleSummary]);

  const timelineGroups = useMemo(() => {
    const focusedOrder = [focus, ...GROUP_ORDER.filter((key) => key !== focus)];
    return focusedOrder
      .map((key) => ({
        key,
        label: t(groupLabelKey(key)),
        items: key === focus ? grouped[key] : grouped[key].slice(0, GROUP_CAPS[key]),
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
          label,
          badge: value !== "now" && count > 0 ? formatNumber(count) : undefined,
          accessibilityLabel: t("today.filter.optionAccessibility", { filter: label, count: formatNumber(count) }),
          tone
        };
      }),
    [formatNumber, grouped, t]
  );

  if (!restaurant) {
    return (
      <Screen title={t("nav.today")} subtitle={t("today.subtitle")} titleAlign="left">
        <EmptyState
          title={t("workspace.none.title")}
          body={t(canUseDemoMode ? "workspace.none.demoBody" : "workspace.none.body")}
          illustration={<CalendarDays size={icon.emphasis} color={colors.muted} strokeWidth={iconStroke} />}
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
      titleAlign="left"
      loading={loading}
      action={
        <ActionIcon accessibilityLabel={t("nav.today")} onPress={() => setFocus("now")}>
          <CalendarDays size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
        </ActionIcon>
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
          <OperatingPlanTimeline
            groups={timelineGroups}
            focus={focus}
            locale={locale}
            role={role ?? "staff"}
            restaurantTimeZone={visibleSummary.restaurantTimeZone}
            t={t}
          />
        ) : null}

        {visibleFloorNotes.length > 0 || floorNoteMessage ? (
          <View style={styles.floorNotesSection}>
            <SectionHeader
              title={t("today.floorNotes.title")}
              subtitle={
                visibleFloorNotes.length > 0
                  ? t("today.floorNotes.subtitle", { count: formatNumber(visibleFloorNotes.length) })
                  : undefined
              }
            />
            {floorNoteMessage ? (
              <StatusNotice tone="danger" title={t("common.error")} message={floorNoteMessage} />
            ) : null}
            {(["now", "up_next", "later"] as const).map((timing) => {
              const notes = groupedFloorNotes[timing];
              if (notes.length === 0) return null;
              return (
                <View key={timing} style={styles.floorNotesGroup}>
                  <Text style={styles.groupLabel}>
                    {t(
                      timing === "now"
                        ? "floorNotes.timing.now"
                        : timing === "up_next"
                          ? "floorNotes.timing.upNext"
                          : "floorNotes.timing.later"
                    )}
                  </Text>
                  {notes.map((note) => {
                    const focusRoute = operatorTaskFocusRoute(note.focusArea);
                    return (
                      <View key={note.id} style={styles.floorNoteCard}>
                        <Pressable
                          accessibilityRole={focusRoute ? "button" : undefined}
                          accessibilityLabel={t("today.floorNotes.rowAccessibility", { title: note.title })}
                          disabled={!focusRoute}
                          onPress={focusRoute ? () => router.push(focusRoute as never) : undefined}
                          style={({ pressed }) => [styles.floorNoteMain, pressed && focusRoute && styles.pressed]}
                        >
                          <View style={styles.floorNoteCopy}>
                            <Text style={styles.floorNoteTitle}>{note.title}</Text>
                            {note.body ? (
                              <Text numberOfLines={2} style={styles.floorNoteDetail}>
                                {note.body}
                              </Text>
                            ) : null}
                          </View>
                          {note.focusArea ? (
                            <Badge
                              label={t(
                                note.focusArea === "inventory"
                                  ? "floorNotes.focus.inventory"
                                  : note.focusArea === "orders"
                                    ? "floorNotes.focus.orders"
                                    : note.focusArea === "insights"
                                      ? "floorNotes.focus.insights"
                                      : "floorNotes.focus.ask"
                              )}
                              tone="neutral"
                            />
                          ) : null}
                        </Pressable>
                        <Button
                          title={
                            busyFloorNoteId === note.id
                              ? t("common.saving")
                              : t("today.floorNotes.markDone")
                          }
                          size="compact"
                          variant="secondary"
                          onPress={() => void markFloorNoteDone(note)}
                          disabled={!floorNotesEditable}
                          style={styles.floorNoteDone}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.briefContinuation}>
          <DailyBriefBoard
            brief={visibleBrief}
            queue={visibleFindingQueue}
            canManage={actionsEditable}
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

function emptyBuckets(): Record<TaskFilter, DailyOperatingPlan["buckets"][TaskFilter]> {
  return { now: [], up_next: [], later: [], done: [] };
}

function groupLabelKey(filter: TaskFilter): MessageKey {
  if (filter === "now") return "today.filter.now";
  if (filter === "up_next") return "today.filter.upNext";
  if (filter === "later") return "today.filter.later";
  return "today.filter.done";
}

const styles = StyleSheet.create({
  stack: {
    gap: 10
  },
  emptyButton: {
    marginTop: 16
  },
  groupLabel: {
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "left",
    marginBottom: 8,
    marginTop: 12,
    paddingLeft: 0
  },
  briefContinuation: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  floorNotesSection: {
    marginTop: 4,
    gap: 6
  },
  floorNotesGroup: {
    gap: 6
  },
  floorNoteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 9,
    gap: 6
  },
  floorNoteMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  floorNoteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  floorNoteTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  floorNoteDetail: {
    color: colors.muted,
    ...conceptTypography.body
  },
  floorNoteDone: {
    alignSelf: "flex-start"
  },
  pressed: {
    opacity: 0.72
  }
});
