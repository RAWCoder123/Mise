import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, Clock3, Package, ShoppingCart, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { OverflowMenu } from "../../components/ui/OverflowMenu";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { RetryNotice, StatusNotice } from "../../components/ui/StatusNotice";
import { colors, conceptTypography, icon, iconStroke, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  canRestaurantRoleCancelSharedTask,
  canRestaurantRoleCompleteSharedTask,
  type RestaurantTask
} from "../../services/domain/restaurantTasks";
import {
  canRestaurantRoleActOnTodayTask,
  type OperationalTodayTask,
  type OperationalTodayTaskActionIntent
} from "../../services/domain/todayTasks";
import {
  cancelSharedRestaurantTask,
  completeSharedRestaurantTask,
  fetchTodaySummary,
  listSharedRestaurantTasks,
  reopenSharedRestaurantTask
} from "../../services/miseService";
import { presentOperationalTodayTask } from "../../services/presentation/operationsPresentation";
import { captureMiseError } from "../../services/telemetry";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { formatDate, formatDueTime, locale, t } = useLocale();
  const { restaurant, role, user } = useMiseSession();
  const [task, setTask] = useState<OperationalTodayTask | null>(null);
  const [sharedTask, setSharedTask] = useState<RestaurantTask | null>(null);
  const [restaurantTimeZone, setRestaurantTimeZone] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [completionResult, setCompletionResult] = useState("");
  const [completionEvidence, setCompletionEvidence] = useState("");
  const [mutating, setMutating] = useState(false);
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
    setSharedTask(null);
    setRestaurantTimeZone(null);
    setChecked({});
    setCompletionResult("");
    setCompletionEvidence("");
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
      const [summary, sharedTasks] = await Promise.all([
        fetchTodaySummary(restaurantId, { includeCompletedTasks: true }),
        listSharedRestaurantTasks(restaurantId, { includeCompleted: true })
      ]);
      if (requestId !== requestIdRef.current || activeRestaurantIdRef.current !== restaurantId) return;
      setTask(summary.operationalTasks.find((candidate) => candidate.id === id) ?? null);
      setSharedTask(sharedTasks.find((candidate) => candidate.id === id) ?? null);
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

  const overflow = (
    <OverflowMenu
      accessibilityLabel={t("tasks.menu.accessibility")}
      items={[
        { id: "today", label: t("tasks.menu.openToday"), onSelect: () => router.replace("/today") },
        {
          id: "activity",
          label: t("tasks.menu.viewActivity"),
          onSelect: () => router.push("/more/activity" as never)
        }
      ]}
    />
  );

  if (!restaurant) {
    return (
      <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}
      action={overflow}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("tasks.noRestaurant.body")} />
      </Screen>
    );
  }

  if (!task && !sharedTask && !loading && !error) {
    return (
      <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}
      action={overflow}>
        <EmptyState title={t("tasks.gone.title")} body={t("tasks.gone.body")} />
        <Button title={t("tasks.backToToday")} onPress={() => router.replace("/today")} fullWidth style={styles.emptyButton} />
      </Screen>
    );
  }

  async function completeSharedTask() {
    if (!restaurant || !sharedTask || mutating) return;
    const checklistComplete = sharedTask.checklist.every((entry, index) =>
      Boolean(checked[sharedChecklistKey(entry, index)])
    );
    if (!checklistComplete) {
      setError(t("tasks.shared.checklistRequired"));
      return;
    }
    if (!completionResult.trim()) {
      setError(t("tasks.shared.resultRequired"));
      return;
    }
    if (
      sharedTask.verificationRequired &&
      sharedTask.verificationMethod !== "checklist" &&
      !completionEvidence.trim()
    ) {
      setError(t("tasks.shared.evidenceRequired"));
      return;
    }
    setMutating(true);
    setError(null);
    try {
      await completeSharedRestaurantTask({
        restaurantId: restaurant.id,
        taskId: sharedTask.id,
        completionResult,
        completionEvidence: [
          ...sharedTask.checklist.map((entry) => ({
            type: "checklist_item",
            label: entry.label ?? entry.type ?? "Completed checklist item",
            completed: true
          })),
          ...(completionEvidence.trim()
            ? [{ type: sharedTask.verificationMethod, note: completionEvidence.trim() }]
            : [])
        ]
      });
      await load();
    } catch (completionError) {
      captureMiseError(completionError, {
        flow: "shared_task_detail",
        operation: "complete",
        restaurant_id: restaurant.id,
        task_id: sharedTask.id
      });
      setError(t("tasks.shared.completeError"));
    } finally {
      setMutating(false);
    }
  }

  async function reopenSharedTask() {
    if (!restaurant || !sharedTask || mutating) return;
    setMutating(true);
    setError(null);
    try {
      await reopenSharedRestaurantTask(restaurant.id, sharedTask.id);
      await load();
    } catch (reopenError) {
      captureMiseError(reopenError, {
        flow: "shared_task_detail",
        operation: "reopen",
        restaurant_id: restaurant.id,
        task_id: sharedTask.id
      });
      setError(t("tasks.shared.reopenError"));
    } finally {
      setMutating(false);
    }
  }

  async function cancelSharedTask() {
    if (!restaurant || !sharedTask || mutating) return;
    setMutating(true);
    setError(null);
    try {
      await cancelSharedRestaurantTask({
        restaurantId: restaurant.id,
        taskId: sharedTask.id
      });
      await load();
    } catch (cancelError) {
      captureMiseError(cancelError, {
        flow: "shared_task_detail",
        operation: "cancel",
        restaurant_id: restaurant.id,
        task_id: sharedTask.id
      });
      const message = cancelError instanceof Error ? cancelError.message : "";
      setError(
        /open dependent/i.test(message)
          ? t("tasks.shared.cancelBlockedByDependents")
          : t("tasks.shared.cancelError")
      );
    } finally {
      setMutating(false);
    }
  }

  if (sharedTask) {
    const completed = sharedTask.status === "completed";
    const cancelled = sharedTask.status === "cancelled";
    const high = sharedTask.priority === "urgent" || sharedTask.priority === "high";
    const canComplete = canRestaurantRoleCompleteSharedTask(
      role ?? "staff",
      user?.id,
      sharedTask
    );
    const blockedByAssignee = Boolean(
      sharedTask.assigneeUserId &&
      sharedTask.assigneeUserId !== user?.id &&
      (role ?? "staff") === "staff"
    );
    const canReopen = role === "owner" || role === "admin" || role === "manager";
    const canCancel = canRestaurantRoleCancelSharedTask(role ?? "staff");
    const dueLabel = sharedTask.dueAt && restaurantTimeZone
      ? formatDueTime(sharedTask.dueAt, { timeZone: restaurantTimeZone })
      : sharedTask.serviceWindow
        ? t(serviceWindowKey(sharedTask.serviceWindow))
        : t("tasks.due.none");
    const assignedLabel = sharedTask.assigneeUserId
      ? t("tasks.shared.assignedTeammate")
      : t(
          sharedTask.requiredRole === "owner_admin"
            ? "tasks.assigned.ownerAdmin"
            : sharedTask.requiredRole === "manager"
              ? "tasks.assigned.manager"
              : "tasks.assigned.staff"
        );

    return (
      <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}
      action={overflow} loading={loading} keyboardAware>
        <View style={styles.stack}>
          {error ? (
            <StatusNotice tone="danger" title={t("common.error")} message={error} />
          ) : null}

          <View style={styles.hero}>
            {completed ? (
              <CheckCircle2 size={icon.emphasis} color={colors.success} strokeWidth={iconStroke} />
            ) : (
              <ClipboardList
                size={icon.emphasis}
                color={cancelled ? colors.faint : high ? colors.danger : colors.accentDark}
                strokeWidth={iconStroke}
              />
            )}
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{sharedTask.title}</Text>
              <View style={styles.inlineBadges}>
                <Badge label={t("tasks.shared.restaurantWide")} tone="neutral" />
                <Badge
                  label={t(
                    cancelled
                      ? "task.badge.cancelled"
                      : completed
                        ? "task.badge.done"
                        : high
                          ? "tasks.priority.high"
                          : "task.badge.normal"
                  )}
                  tone={cancelled ? "neutral" : completed ? "success" : high ? "danger" : "neutral"}
                />
              </View>
            </View>
          </View>

          <View style={styles.metaList}>
            <MetaRow label={t("tasks.meta.due")} value={dueLabel} />
            <MetaRow label={t("tasks.meta.assigned")} value={assignedLabel} />
            <MetaRow label={t("tasks.meta.related")} value={sharedRelatedLabel(sharedTask, t)} />
            <MetaRow label={t("tasks.shared.verification")} value={verificationLabel(sharedTask, t)} />
          </View>

          <View style={styles.instructions}>
            <Text style={styles.sectionTitle}>{t("tasks.instructions.title")}</Text>
            <Text style={styles.instructionsBody}>{sharedTask.detail ?? t("tasks.shared.noInstructions")}</Text>
          </View>

          {sharedTask.checklist.length > 0 ? (
            <View style={styles.checklist}>
              <Text style={styles.sectionTitle}>{t("tasks.checklist.title")}</Text>
              {sharedTask.checklist.map((entry, index) => {
                const key = sharedChecklistKey(entry, index);
                const isChecked = completed || Boolean(checked[key]);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked, disabled: completed || cancelled }}
                    disabled={completed || cancelled}
                    onPress={() => setChecked((current) => ({ ...current, [key]: !current[key] }))}
                    style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
                  >
                    {isChecked
                      ? <CheckCircle2 size={icon.inline} color={colors.success} strokeWidth={iconStroke} />
                      : <Circle size={icon.inline} color={colors.borderStrong} strokeWidth={iconStroke} />}
                    <Text style={[styles.checkText, isChecked && styles.checkTextDone]}>
                      {String(entry.label ?? entry.type ?? t("tasks.shared.checklistItem", { number: index + 1 }))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {sharedTask.dependencyIds.length > 0 && !completed && !cancelled ? (
            <Text style={styles.restricted}>
              {t("tasks.shared.dependencies", { count: sharedTask.dependencyIds.length })}
            </Text>
          ) : null}

          {cancelled ? (
            <View style={styles.instructions}>
              <Text style={styles.sectionTitle}>{t("tasks.shared.cancelledTitle")}</Text>
              <Text style={styles.instructionsBody}>{t("tasks.shared.cancelledBody")}</Text>
            </View>
          ) : completed ? (
            <View style={styles.instructions}>
              <Text style={styles.sectionTitle}>{t("tasks.shared.result")}</Text>
              <Text style={styles.instructionsBody}>{sharedTask.completionResult}</Text>
              {sharedTask.completionEvidence.map((entry, index) => (
                <Text key={index} style={styles.evidenceText}>
                  {String(entry.note ?? entry.label ?? entry.type ?? t("tasks.shared.evidence"))}
                </Text>
              ))}
              {canReopen ? (
                <Button
                  title={mutating ? t("common.saving") : t("operatorTasks.list.reopen")}
                  variant="secondary"
                  onPress={() => void reopenSharedTask()}
                  disabled={mutating}
                  fullWidth
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.instructions}>
              <Text style={styles.sectionTitle}>{t("tasks.shared.recordResult")}</Text>
              <TextInput
                accessibilityLabel={t("tasks.shared.recordResult")}
                placeholder={t("tasks.shared.resultPlaceholder")}
                placeholderTextColor={colors.faint}
                value={completionResult}
                onChangeText={setCompletionResult}
                style={[styles.input, styles.resultInput]}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              {sharedTask.verificationRequired && sharedTask.verificationMethod !== "checklist" ? (
                <TextInput
                  accessibilityLabel={t("tasks.shared.evidence")}
                  placeholder={t("tasks.shared.evidencePlaceholder")}
                  placeholderTextColor={colors.faint}
                  value={completionEvidence}
                  onChangeText={setCompletionEvidence}
                  style={styles.input}
                  maxLength={500}
                />
              ) : null}
              <Button
                title={mutating ? t("common.saving") : t("tasks.action.markComplete")}
                onPress={() => void completeSharedTask()}
                disabled={mutating || !canComplete || sharedTask.status === "blocked"}
                fullWidth
              />
              {canCancel ? (
                <Button
                  title={mutating ? t("common.saving") : t("tasks.action.cancel")}
                  variant="secondary"
                  onPress={() => void cancelSharedTask()}
                  disabled={mutating}
                  fullWidth
                  style={styles.cancelAction}
                />
              ) : null}
              {!canComplete ? (
                <Text style={styles.restricted}>
                  {t(
                    blockedByAssignee
                      ? "tasks.restricted.assignee"
                      : sharedTask.requiredRole === "owner_admin"
                        ? "tasks.restricted.ownerAdmin"
                        : "tasks.restricted.manager"
                  )}
                </Text>
              ) : sharedTask.status === "blocked" ? (
                <Text style={styles.restricted}>{t("tasks.shared.blocked")}</Text>
              ) : null}
            </View>
          )}
        </View>
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
    <Screen title={t("tasks.title")} titleAlign="center" leadingAction={<BackAction />}
      action={overflow} loading={loading}>
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
              {taskIcon(task, high ? colors.danger : colors.accentDark)}
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{presentation.title}</Text>
                <Badge
                  label={t(high ? "tasks.priority.high" : "task.badge.normal")}
                  tone={high ? "danger" : "neutral"}
                />
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
              {checklistKeys.map((key) => {
                const isChecked = Boolean(checked[key]);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    onPress={() => setChecked((current) => ({ ...current, [key]: !current[key] }))}
                    style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
                  >
                    {isChecked ? (
                      <CheckCircle2 size={icon.inline} color={colors.success} strokeWidth={iconStroke} />
                    ) : (
                      <Circle size={icon.inline} color={colors.borderStrong} strokeWidth={iconStroke} />
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
                size="compact"
                style={styles.primaryAction}
              />
              <Button
                title={t("today.action.snooze")}
                variant="secondary"
                size="compact"
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

function sharedChecklistKey(entry: RestaurantTask["checklist"][number], index: number) {
  return `${index}:${entry.type ?? entry.label ?? "item"}`;
}

function serviceWindowKey(window: NonNullable<RestaurantTask["serviceWindow"]>): MessageKey {
  if (window === "before_dinner_service") return "today.plan.window.before_dinner";
  if (window === "during_closing") return "today.plan.window.closing";
  if (window === "custom") return "today.plan.window.unscheduled";
  return `today.plan.window.${window}` as MessageKey;
}

function verificationLabel(task: RestaurantTask, t: (key: MessageKey) => string) {
  if (!task.verificationRequired) return t("tasks.shared.verificationNone");
  const key = `tasks.shared.verification.${task.verificationMethod}` as MessageKey;
  return t(key);
}

function sharedRelatedLabel(task: RestaurantTask, t: (key: MessageKey) => string) {
  if (task.relatedInventoryItemId) return t("tasks.related.inventory");
  if (task.relatedOrderId || task.relatedRecommendationId) return t("tasks.related.orders");
  return t("tasks.related.operations");
}

function checklistKeysForIntent(intent: OperationalTodayTaskActionIntent): readonly MessageKey[] {
  if (
    intent === "update_inventory_count" ||
    intent === "begin_inventory_count_session" ||
    intent === "continue_inventory_count_session"
  ) {
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
  if (task.source.kind === "inventory" || task.source.kind === "inventory_count_session") {
    return t("tasks.related.inventory");
  }
  if (task.source.kind === "order" || task.source.kind === "recommendation") return t("tasks.related.orders");
  if (task.source.kind === "integration") return t("tasks.related.integrations");
  if (task.source.kind === "insight") return t("tasks.related.insights");
  return t("tasks.related.operations");
}

function taskIcon(task: OperationalTodayTask, color: string): ReactNode {
  const props = { size: 15, color, strokeWidth: 2.1 } as const;
  if (task.source.kind === "inventory" || task.source.kind === "inventory_count_session") {
    return <Package {...props} />;
  }
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
    marginTop: 16
  },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  inlineBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  title: {
    color: colors.text,
    fontFamily: typography.families.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3
  },
  metaList: {
    gap: 0
  },
  metaRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
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
    gap: 6
  },
  sectionTitle: {
    color: colors.text,
    ...conceptTypography.sectionTitle
  },
  instructionsBody: {
    color: colors.muted,
    ...conceptTypography.body
  },
  evidenceText: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    ...conceptTypography.body
  },
  resultInput: {
    minHeight: 96
  },
  cancelAction: {
    marginTop: 10
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border
  },
  checklist: {
    gap: 0
  },
  checkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
    gap: 10,
    marginTop: 8
  },
  primaryAction: {
    flex: 1.4,
    minHeight: 48
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48
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
