import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, Clock3, Package, ShoppingCart, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, density, typography } from "../../constants/theme";
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

function BackAction() {
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={8}
      onPress={() => router.back()}
      style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.55 }]}
    >
      <ArrowLeft size={20} color={colors.text} strokeWidth={2.1} />
    </Pressable>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatDueTime, locale, t } = useLocale();
  const { restaurant, role } = useMiseSession();
  const [task, setTask] = useState<OperationalTodayTask | null>(null);
  const [restaurantTimeZone, setRestaurantTimeZone] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
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
    setChecked({});
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
      <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("tasks.noRestaurant.body")} />
      </Screen>
    );
  }

  if (!task && !loading && !error) {
    return (
      <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.gone.title")} body={t("tasks.gone.body")} />
        <Button title={t("tasks.backToToday")} onPress={() => router.replace("/today")} fullWidth style={styles.emptyButton} />
      </Screen>
    );
  }

  const presentation = task ? presentOperationalTodayTask(locale, task) : null;
  const canAct = task ? canRestaurantRoleActOnTodayTask(role ?? "staff", task) : false;
  const high = task ? task.priority === "urgent" || task.priority === "high" : false;
  const dueLabel = task
    ? task.dueAt && restaurantTimeZone
      ? formatDueTime(task.dueAt, { timeZone: restaurantTimeZone })
      : task.dueDate
        ? formatDate(`${task.dueDate}T12:00:00.000Z`, { month: "short", day: "numeric", timeZone: "UTC" })
        : t("tasks.due.none")
    : "";
  const checklistKeys = task ? checklistKeysForIntent(task.action.intent) : [];
  const relatedLabel = task ? relatedLabelFor(task, t) : "";
  const assignedLabel = task
    ? t(task.requiredRole === "owner_admin" ? "tasks.assigned.ownerAdmin" : task.requiredRole === "manager" ? "tasks.assigned.manager" : "tasks.assigned.staff")
    : "";

  return (
    <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />} loading={loading}>
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
              <View style={[styles.heroIcon, high && styles.heroIconHigh]}>
                {taskIcon(task, high ? colors.danger : colors.text)}
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{presentation.title}</Text>
                <Text style={[styles.priority, high && styles.priorityHigh]}>
                  {t(high ? "tasks.priority.high" : "task.badge.normal")}
                </Text>
              </View>
            </View>

            <View style={styles.metaList}>
              <MetaRow label={t("tasks.meta.due")} value={dueLabel} />
              <MetaRow label={t("tasks.meta.assigned")} value={assignedLabel} />
              <MetaRow label={t("tasks.meta.related")} value={relatedLabel} />
            </View>

            <View style={styles.instructions}>
              <Text style={styles.sectionTitle}>{t("tasks.instructions.title")}</Text>
              <Text style={styles.instructionsBody}>{presentation.detail}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.checklist}>
              <Text style={styles.sectionTitle}>{t("tasks.checklist.title")}</Text>
              {checklistKeys.map((key, index) => {
                const isChecked = Boolean(checked[key]) || (task.status === "completed" && index < 2);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    onPress={() => setChecked((current) => ({ ...current, [key]: !current[key] }))}
                    style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
                  >
                    {isChecked ? (
                      <CheckCircle2 size={16} color={colors.success} strokeWidth={2.2} />
                    ) : (
                      <Circle size={16} color={colors.borderStrong} strokeWidth={2.2} />
                    )}
                    <Text style={[styles.checkText, isChecked && styles.checkTextDone]}>{t(key)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actions}>
              <Button
                title={t(task.status === "completed" ? "today.action.open" : "tasks.action.markComplete")}
                onPress={() => router.push(task.action.route)}
                disabled={!canAct}
                style={styles.primaryAction}
              />
              <Button
                title={t("today.action.snooze")}
                variant="secondary"
                onPress={() => router.replace("/today")}
                style={styles.secondaryAction}
              />
            </View>
            {!canAct ? (
              <Text style={styles.restricted}>
                {t(task.requiredRole === "owner_admin" ? "tasks.restricted.ownerAdmin" : "tasks.restricted.manager")}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function checklistKeysForIntent(intent: OperationalTodayTaskActionIntent): readonly MessageKey[] {
  if (intent === "update_inventory_count") {
    return ["tasks.checklist.inventory.1", "tasks.checklist.inventory.2", "tasks.checklist.inventory.3", "tasks.checklist.generic.3"];
  }
  if (intent === "review_recommendation") {
    return ["tasks.checklist.recommendation.1", "tasks.checklist.recommendation.2", "tasks.checklist.recommendation.3", "tasks.checklist.generic.3"];
  }
  if (intent === "prepare_supplier_draft" || intent === "send_supplier_order") {
    return ["tasks.checklist.order.1", "tasks.checklist.order.2", "tasks.checklist.order.3", "tasks.checklist.generic.3"];
  }
  if (intent === "connect_pos" || intent === "manage_pos_connection" || intent === "repair_pos_connection") {
    return ["tasks.checklist.pos.1", "tasks.checklist.pos.2", "tasks.checklist.pos.3", "tasks.checklist.generic.3"];
  }
  if (intent === "finish_setup") {
    return ["tasks.checklist.setup.1", "tasks.checklist.setup.2", "tasks.checklist.setup.3", "tasks.checklist.generic.3"];
  }
  return ["tasks.checklist.generic.1", "tasks.checklist.generic.2", "tasks.checklist.generic.3", "tasks.checklist.inventory.3"];
}

function relatedLabelFor(task: OperationalTodayTask, t: (key: MessageKey) => string) {
  if (task.source.kind === "inventory") return t("tasks.related.inventory");
  if (task.source.kind === "order" || task.source.kind === "recommendation") return t("tasks.related.orders");
  if (task.source.kind === "integration") return t("tasks.related.integrations");
  if (task.source.kind === "insight") return t("tasks.related.insights");
  return t("tasks.related.operations");
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 15, color, strokeWidth: 2.1 } as const;
  if (task.source.kind === "inventory") return <Package {...props} />;
  if (task.source.kind === "recommendation" || task.source.kind === "order") return <ShoppingCart {...props} />;
  if (task.source.kind === "integration") return <ClipboardList {...props} />;
  if (task.status === "completed") return <CheckCircle2 {...props} />;
  if (task.dueAt || task.dueDate) return <Clock3 {...props} />;
  return <Sparkles {...props} />;
}

const styles = StyleSheet.create({
  stack: {
    gap: 8
  },
  emptyButton: {
    marginTop: 12
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  heroIcon: {
    width: density.iconPlain,
    height: density.iconPlain,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong
  },
  heroIconHigh: {
    backgroundColor: colors.dangerSoft
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1
  },
  title: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1
  },
  priority: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  priorityHigh: {
    color: colors.danger
  },
  metaList: {
    gap: 0
  },
  metaRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  metaLabel: {
    color: colors.muted,
    ...conceptTypography.body
  },
  metaValue: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.rowTitle,
    textAlign: "right"
  },
  instructions: {
    gap: 3
  },
  sectionTitle: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  instructionsBody: {
    color: colors.muted,
    ...conceptTypography.body
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border
  },
  checklist: {
    gap: 2
  },
  checkRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkText: {
    flex: 1,
    color: colors.text,
    ...conceptTypography.body
  },
  checkTextDone: {
    color: colors.muted,
    textDecorationLine: "line-through"
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  primaryAction: {
    flex: 1.4,
    minHeight: 40,
    height: 40
  },
  secondaryAction: {
    flex: 1,
    minHeight: 40,
    height: 40
  },
  restricted: {
    color: colors.muted,
    ...conceptTypography.caption,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.72
  }
});
