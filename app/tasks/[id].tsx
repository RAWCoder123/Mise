import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { CheckCircle2, Clock3, ClipboardList, Package, ShoppingCart, Sparkles } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconBadge } from "../../components/ui/IconBadge";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  canRestaurantRoleActOnTodayTask,
  type OperationalTodayTask,
  type OperationalTodayTaskActionIntent
} from "../../services/domain/todayTasks";
import { fetchTodaySummary } from "../../services/miseService";
import { presentOperationalTodayTask } from "../../services/presentation/operationsPresentation";
import { captureMiseError } from "../../services/telemetry";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatDueTime, locale, t } = useLocale();
  const { restaurant, role } = useMiseSession();
  const [task, setTask] = useState<OperationalTodayTask | null>(null);
  const [restaurantTimeZone, setRestaurantTimeZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRestaurantIdRef = useRef<string | null>(restaurant?.id ?? null);
  activeRestaurantIdRef.current = restaurant?.id ?? null;

  useEffect(() => {
    navigation.setOptions({ title: t("tasks.title") });
  }, [navigation, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    setTask(null);
    setRestaurantTimeZone(null);
    setError(null);
    setLoading(Boolean(restaurant));
  }, [restaurant?.id, id]);

  const load = useCallback(async () => {
    if (!restaurant || !id) {
      setLoading(false);
      return;
    }

    const restaurantId = restaurant.id;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchTodaySummary(restaurantId, { includeCompletedTasks: true });
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setTask(summary.operationalTasks.find((candidate) => candidate.id === id) ?? null);
      setRestaurantTimeZone(summary.restaurantTimeZone);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      captureMiseError(loadError, { flow: "task_detail", operation: "load", restaurant_id: restaurantId });
      setError(t("tasks.error"));
    } finally {
      if (requestId === requestIdRef.current && activeRestaurantIdRef.current === restaurantId) setLoading(false);
    }
  }, [id, restaurant?.id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!restaurant) {
    return (
      <Screen title={t("tasks.title")} subtitle={t("workspace.none.title")}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("tasks.noRestaurant.body")} />
      </Screen>
    );
  }

  if (!task && !loading && !error) {
    return (
      <Screen title={t("tasks.title")} subtitle={restaurant.name}>
        <EmptyState title={t("tasks.gone.title")} body={t("tasks.gone.body")} />
        <Button title={t("tasks.backToToday")} onPress={() => router.replace("/today")} fullWidth style={styles.emptyButton} />
      </Screen>
    );
  }

  const presentation = task ? presentOperationalTodayTask(locale, task) : null;
  const canAct = task ? canRestaurantRoleActOnTodayTask(role ?? "staff", task) : false;
  const dueLabel = task
    ? task.dueAt && restaurantTimeZone
      ? formatDueTime(task.dueAt, { timeZone: restaurantTimeZone })
      : task.dueDate
        ? formatDate(`${task.dueDate}T12:00:00.000Z`, { month: "short", day: "numeric", timeZone: "UTC" })
        : t("tasks.due.none")
    : "";

  return (
    <Screen title={t("tasks.title")} subtitle={restaurant.name} loading={loading}>
      <View style={styles.stack}>
        {error ? (
          <RetryNotice
            title={t("tasks.retry.title")}
            message={error}
            retryLabel={t("common.retry")}
            accessibilityLabel={t("tasks.retry.accessibility")}
            onRetry={() => void load()}
          />
        ) : null}

        {task && presentation ? (
          <>
            <View style={styles.hero}>
              <IconBadge tone={task.priority === "urgent" || task.priority === "high" ? "danger" : "neutral"}>
                {taskIcon(task, task.priority === "urgent" || task.priority === "high" ? colors.danger : colors.text)}
              </IconBadge>
              <View style={styles.heroCopy}>
                <View style={styles.badgeRow}>
                  <Text style={[styles.priority, task.priority !== "normal" && styles.priorityHigh]}>
                    {t(task.priority === "normal" ? "task.badge.normal" : "tasks.priority.high")}
                  </Text>
                  <Text style={styles.due}>{dueLabel}</Text>
                </View>
                <Text style={styles.title}>{presentation.title}</Text>
                <Text style={styles.detail}>{presentation.detail}</Text>
              </View>
            </View>

            <View style={styles.checklist}>
              <Text style={styles.sectionTitle}>{t("tasks.checklist.title")}</Text>
              {checklistKeysForIntent(task.action.intent).map((key, index) => (
                <View key={key} style={styles.checkRow}>
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIndex}>{index + 1}</Text>
                  </View>
                  <Text style={styles.checkText}>{t(key)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Button
                title={t(task.status === "completed" ? "today.action.open" : "today.action.start")}
                onPress={() => router.push(task.action.route)}
                disabled={!canAct}
                fullWidth
              />
              <View style={styles.secondaryActions}>
                <Button
                  title={t("today.action.snooze")}
                  variant="secondary"
                  onPress={() => router.replace("/today")}
                  style={styles.secondaryButton}
                />
                <Button title={t("common.back")} variant="ghost" onPress={() => router.back()} style={styles.secondaryButton} />
              </View>
              {!canAct ? (
                <Text style={styles.restricted}>
                  {t(task.requiredRole === "owner_admin" ? "tasks.restricted.ownerAdmin" : "tasks.restricted.manager")}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function checklistKeysForIntent(intent: OperationalTodayTaskActionIntent): readonly MessageKey[] {
  if (intent === "update_inventory_count") {
    return ["tasks.checklist.inventory.1", "tasks.checklist.inventory.2", "tasks.checklist.inventory.3"];
  }
  if (intent === "review_recommendation") {
    return ["tasks.checklist.recommendation.1", "tasks.checklist.recommendation.2", "tasks.checklist.recommendation.3"];
  }
  if (intent === "prepare_supplier_draft" || intent === "send_supplier_order") {
    return ["tasks.checklist.order.1", "tasks.checklist.order.2", "tasks.checklist.order.3"];
  }
  if (intent === "connect_pos" || intent === "manage_pos_connection" || intent === "repair_pos_connection") {
    return ["tasks.checklist.pos.1", "tasks.checklist.pos.2", "tasks.checklist.pos.3"];
  }
  if (intent === "finish_setup") {
    return ["tasks.checklist.setup.1", "tasks.checklist.setup.2", "tasks.checklist.setup.3"];
  }
  return ["tasks.checklist.generic.1", "tasks.checklist.generic.2", "tasks.checklist.generic.3"];
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 20, color, strokeWidth: 2.2 } as const;
  if (task.source.kind === "inventory") return <Package {...props} />;
  if (task.source.kind === "recommendation" || task.source.kind === "order") return <ShoppingCart {...props} />;
  if (task.source.kind === "integration") return <ClipboardList {...props} />;
  if (task.status === "completed") return <CheckCircle2 {...props} />;
  if (task.dueAt || task.dueDate) return <Clock3 {...props} />;
  return <Sparkles {...props} />;
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  emptyButton: {
    marginTop: 12
  },
  hero: {
    flexDirection: "row",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  priority: {
    color: colors.muted,
    fontFamily: typography.families.semibold,
    fontSize: 12,
    lineHeight: 16
  },
  priorityHigh: {
    color: colors.danger
  },
  due: {
    color: colors.muted,
    ...typography.caption
  },
  title: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
    marginTop: 6
  },
  detail: {
    color: colors.muted,
    ...typography.body,
    marginTop: 5
  },
  checklist: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12
  },
  sectionTitle: {
    color: colors.text,
    ...typography.sectionTitle
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong
  },
  checkIndex: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 11,
    lineHeight: 14
  },
  checkText: {
    flex: 1,
    color: colors.text,
    ...typography.body
  },
  actions: {
    gap: 8
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 8
  },
  secondaryButton: {
    flex: 1
  },
  restricted: {
    color: colors.muted,
    ...typography.caption,
    textAlign: "center"
  }
});
