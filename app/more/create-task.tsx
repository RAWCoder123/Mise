import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ClipboardList } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionIcon } from "../../components/ui/ActionIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Screen } from "../../components/ui/Screen";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl, type SegmentOption } from "../../components/ui/SegmentedControl";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { colors, icon, iconStroke, radii, typography } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import { useMiseSession } from "../../contexts/MiseSessionContext";
import type { MessageKey } from "../../i18n/catalog";
import {
  completeOperatorTask,
  createSharedRestaurantTask,
  createOperatorTask,
  fetchRestaurantTeam,
  listSharedRestaurantTasks,
  listOperatorTasks,
  operatorTaskFocusRoute,
  reopenOperatorTask,
  type OperatorTask,
  type OperatorTaskFocusArea,
  type OperatorTaskPriority,
  type OperatorTaskTiming,
  type RestaurantTask,
  type RestaurantTaskRequiredRole,
  type RestaurantTaskServiceWindow,
  type RestaurantTaskVerificationMethod
} from "../../services/miseService";
import { captureMiseError } from "../../services/telemetry";
import type { RestaurantTeamMember } from "../../types/mise";

type FocusChoice = OperatorTaskFocusArea | "none";
type TaskScope = "restaurant" | "personal";
type WindowChoice = RestaurantTaskServiceWindow | "none";

function BackAction() {
  const { t } = useLocale();
  return (
    <ActionIcon accessibilityLabel={t("common.back")} onPress={() => router.back()}>
      <ArrowLeft size={icon.emphasis} color={colors.text} strokeWidth={iconStroke} />
    </ActionIcon>
  );
}

function priorityTone(priority: OperatorTaskPriority): "danger" | "warning" | "neutral" | "caution" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "caution";
  return "neutral";
}

function formatDueLabel(dueAt: string | null, t: ReturnType<typeof useLocale>["t"]) {
  if (!dueAt) return null;
  const date = dueAt.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return t("operatorTasks.dueLabel", { date });
  }
  return null;
}

export default function CreateOperatorTaskScreen() {
  const { t } = useLocale();
  const { restaurant, role, user } = useMiseSession();
  const [scope, setScope] = useState<TaskScope>("restaurant");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<OperatorTaskPriority>("normal");
  const [dueDateText, setDueDateText] = useState("");
  const [timing, setTiming] = useState<OperatorTaskTiming>("now");
  const [focus, setFocus] = useState<FocusChoice>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tasks, setTasks] = useState<OperatorTask[]>([]);
  const [sharedTasks, setSharedTasks] = useState<RestaurantTask[]>([]);
  const [team, setTeam] = useState<RestaurantTeamMember[]>([]);
  const [serviceWindow, setServiceWindow] = useState<WindowChoice>("none");
  const [requiredRole, setRequiredRole] = useState<RestaurantTaskRequiredRole>("member");
  const [verificationMethod, setVerificationMethod] = useState<RestaurantTaskVerificationMethod>("none");
  const [checklistText, setChecklistText] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [dependencyId, setDependencyId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const hasDueDate = dueDateText.trim().length > 0;

  const priorityOptions = useMemo<readonly SegmentOption<OperatorTaskPriority>[]>(
    () => [
      { value: "urgent", label: t("operatorTasks.priority.urgent"), tone: "danger" },
      { value: "high", label: t("operatorTasks.priority.high"), tone: "warning" },
      { value: "normal", label: t("operatorTasks.priority.normal"), tone: "brand" },
      { value: "low", label: t("operatorTasks.priority.low"), tone: "neutral" }
    ],
    [t]
  );

  const scopeOptions = useMemo<readonly SegmentOption<TaskScope>[]>(
    () => [
      { value: "restaurant", label: t("operatorTasks.scope.restaurant"), tone: "brand" },
      { value: "personal", label: t("operatorTasks.scope.personal"), tone: "neutral" }
    ],
    [t]
  );

  const timingOptions = useMemo<readonly SegmentOption<OperatorTaskTiming>[]>(
    () => [
      { value: "now", label: t("floorNotes.timing.now"), tone: "danger" },
      { value: "up_next", label: t("floorNotes.timing.upNext"), tone: "brand" },
      { value: "later", label: t("floorNotes.timing.later"), tone: "neutral" }
    ],
    [t]
  );

  const focusOptions = useMemo<readonly SegmentOption<FocusChoice>[]>(
    () =>
      (
        [
          { value: "none", labelKey: "floorNotes.focus.none" },
          { value: "inventory", labelKey: "floorNotes.focus.inventory" },
          { value: "orders", labelKey: "floorNotes.focus.orders" },
          { value: "insights", labelKey: "floorNotes.focus.insights" },
          { value: "ask", labelKey: "floorNotes.focus.ask" }
        ] as const
      ).map(({ value, labelKey }) => ({
        value,
        label: t(labelKey as MessageKey)
      })),
    [t]
  );

  const windowOptions = useMemo<readonly SegmentOption<WindowChoice>[]>(
    () => [
      { value: "none", label: t("operatorTasks.window.none"), tone: "neutral" },
      { value: "before_prep", label: t("today.plan.window.before_prep"), tone: "brand" },
      { value: "before_lunch", label: t("today.plan.window.before_lunch"), tone: "brand" },
      { value: "before_supplier_cutoff", label: t("today.plan.window.before_supplier_cutoff"), tone: "brand" },
      { value: "before_dinner_service", label: t("today.plan.window.before_dinner"), tone: "brand" },
      { value: "during_closing", label: t("today.plan.window.closing"), tone: "neutral" },
      { value: "end_of_day", label: t("today.plan.window.end_of_day"), tone: "neutral" }
    ],
    [t]
  );

  const roleOptions = useMemo<readonly SegmentOption<RestaurantTaskRequiredRole>[]>(
    () => {
      const options: SegmentOption<RestaurantTaskRequiredRole>[] = [
        { value: "member", label: t("tasks.assigned.staff"), tone: "brand" }
      ];
      if (role === "owner" || role === "admin" || role === "manager") {
        options.push({ value: "manager", label: t("tasks.assigned.manager"), tone: "neutral" });
      }
      if (role === "owner" || role === "admin") {
        options.push({ value: "owner_admin", label: t("tasks.assigned.ownerAdmin"), tone: "neutral" });
      }
      return options;
    },
    [role, t]
  );

  const verificationOptions = useMemo<readonly SegmentOption<RestaurantTaskVerificationMethod>[]>(
    () => [
      { value: "none", label: t("tasks.shared.verification.none"), tone: "neutral" },
      { value: "checklist", label: t("tasks.shared.verification.checklist"), tone: "brand" },
      { value: "count", label: t("tasks.shared.verification.count"), tone: "brand" },
      { value: "manager_review", label: t("tasks.shared.verification.manager_review"), tone: "neutral" },
      { value: "receipt", label: t("tasks.shared.verification.receipt"), tone: "neutral" }
    ],
    [t]
  );

  const loadTasks = useCallback(async () => {
    if (!restaurant) {
      setTasks([]);
      return;
    }
    try {
      const [next, nextShared, nextTeam] = await Promise.all([
        listOperatorTasks(restaurant.id),
        listSharedRestaurantTasks(restaurant.id, { includeCompleted: true }),
        fetchRestaurantTeam(restaurant.id)
      ]);
      setTasks(next);
      setSharedTasks(nextShared);
      setTeam(nextTeam.filter((member) => member.status === "active"));
      setListError(null);
    } catch (loadError) {
      captureMiseError(loadError, {
        flow: "operator_tasks",
        operation: "list",
        restaurant_id: restaurant.id
      });
      setListError(t("operatorTasks.error.load"));
    }
  }, [restaurant, t]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks])
  );

  const openTasks = useMemo(() => tasks.filter((task) => task.status === "open"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);
  const visibleList = showCompleted ? completedTasks : openTasks;
  const openSharedTasks = useMemo(
    () => sharedTasks.filter((task) => task.status !== "completed" && task.status !== "cancelled"),
    [sharedTasks]
  );
  const completedSharedTasks = useMemo(
    () => sharedTasks.filter((task) => task.status === "completed"),
    [sharedTasks]
  );
  const assignableTeam = useMemo(
    () => team.filter(
      (member) =>
        memberCanTakeRole(member, requiredRole) &&
        (role !== "staff" || member.user_id === user?.id)
    ),
    [team, requiredRole, role, user?.id]
  );

  async function save() {
    if (!restaurant || saving) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t("operatorTasks.error.titleRequired"));
      setSaved(false);
      return;
    }

    const dueTrimmed = dueDateText.trim();
    if (scope === "personal" && dueTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(dueTrimmed)) {
      setError(t("operatorTasks.error.dueDate"));
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (scope === "restaurant") {
        await createSharedRestaurantTask({
          restaurantId: restaurant.id,
          clientTaskId: `restaurant-task:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          title: trimmedTitle,
          detail: body,
          origin: "human",
          operationalCategory:
            focus === "inventory" ? "inventory" : focus === "orders" ? "orders" : "other",
          priority,
          timingBucket: timing,
          dueAt: null,
          serviceWindow: serviceWindow === "none" ? null : serviceWindow,
          requiredRole,
          assigneeUserId,
          verificationMethod,
          checklist: checklistText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((label) => ({ type: "checklist_item", label })),
          dependencyIds: dependencyId ? [dependencyId] : []
        });
      } else {
        await createOperatorTask({
          restaurantId: restaurant.id,
          title: trimmedTitle,
          body,
          priority,
          dueAt: dueTrimmed || null,
          timing: dueTrimmed ? undefined : timing,
          focusArea: focus === "none" ? null : focus
        });
      }
      setSaved(true);
      setTitle("");
      setBody("");
      setPriority("normal");
      setDueDateText("");
      setTiming("now");
      setFocus("none");
      setServiceWindow("none");
      setRequiredRole("member");
      setVerificationMethod("none");
      setChecklistText("");
      setAssigneeUserId(null);
      setDependencyId(null);
      await loadTasks();
    } catch (saveError) {
      captureMiseError(saveError, {
        flow: "operator_tasks",
        operation: "create",
        restaurant_id: restaurant.id
      });
      setError(t("operatorTasks.error.save"));
    } finally {
      setSaving(false);
    }
  }

  async function markDone(task: OperatorTask) {
    if (!restaurant || busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      await completeOperatorTask({ restaurantId: restaurant.id, taskId: task.id });
      await loadTasks();
    } catch (completeError) {
      captureMiseError(completeError, {
        flow: "operator_tasks",
        operation: "complete",
        restaurant_id: restaurant.id
      });
      setListError(t("operatorTasks.error.complete"));
    } finally {
      setBusyTaskId(null);
    }
  }

  async function reopen(task: OperatorTask) {
    if (!restaurant || busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      await reopenOperatorTask({ restaurantId: restaurant.id, taskId: task.id });
      await loadTasks();
    } catch (reopenError) {
      captureMiseError(reopenError, {
        flow: "operator_tasks",
        operation: "reopen",
        restaurant_id: restaurant.id
      });
      setListError(t("operatorTasks.error.reopen"));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (!restaurant) {
    return (
      <Screen title={t("operatorTasks.title")} titleAlign="center" leadingAction={<BackAction />}>
        <EmptyState title={t("tasks.noRestaurant.title")} body={t("operatorTasks.noRestaurant.body")} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t("operatorTasks.title")}
      subtitle={t("operatorTasks.subtitle")}
      titleAlign="center"
      leadingAction={<BackAction />}
      keyboardAware
    >
      <View style={styles.stack}>
        <SectionHeader title={t("operatorTasks.scope.title")} />
        <SegmentedControl
          accessibilityLabel={t("operatorTasks.scope.title")}
          options={scopeOptions}
          value={scope}
          onValueChange={setScope}
          variant="pills"
        />

        <StatusNotice
          tone="neutral"
          title={t(scope === "restaurant" ? "operatorTasks.shared.noticeTitle" : "operatorTasks.noticeTitle")}
          message={t(scope === "restaurant" ? "operatorTasks.shared.noticeBody" : "operatorTasks.noticeBody")}
        />

        {error ? <StatusNotice tone="danger" title={t("common.error")} message={error} /> : null}
        {saved ? (
          <StatusNotice
            tone="success"
            title={t("operatorTasks.successTitle")}
            message={t(scope === "restaurant" ? "operatorTasks.shared.successBody" : "operatorTasks.successBody")}
          />
        ) : null}

        <SectionHeader title={t("operatorTasks.field.title")} />
        <TextInput
          accessibilityLabel={t("operatorTasks.field.title")}
          placeholder={t("operatorTasks.field.titlePlaceholder")}
          placeholderTextColor={colors.faint}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          maxLength={120}
          autoFocus
        />

        <SectionHeader title={t("operatorTasks.field.body")} />
        <TextInput
          accessibilityLabel={t("operatorTasks.field.body")}
          placeholder={t("operatorTasks.field.bodyPlaceholder")}
          placeholderTextColor={colors.faint}
          value={body}
          onChangeText={setBody}
          style={[styles.input, styles.bodyInput]}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        <SectionHeader title={t("operatorTasks.field.priority")} />
        <SegmentedControl
          accessibilityLabel={t("operatorTasks.field.priority")}
          options={priorityOptions}
          value={priority}
          onValueChange={setPriority}
          variant="pills"
          scrollable
        />

        {scope === "personal" ? (
          <>
            <SectionHeader title={t("operatorTasks.field.due")} />
            <TextInput
              accessibilityLabel={t("operatorTasks.field.due")}
              placeholder={t("operatorTasks.field.duePlaceholder")}
              placeholderTextColor={colors.faint}
              value={dueDateText}
              onChangeText={setDueDateText}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
          </>
        ) : null}

        {scope === "restaurant" || !hasDueDate ? (
          <>
            <SectionHeader title={t("operatorTasks.field.timing")} />
            <SegmentedControl
              accessibilityLabel={t("operatorTasks.field.timing")}
              options={timingOptions}
              value={timing}
              onValueChange={setTiming}
              variant="pills"
              scrollable
            />
          </>
        ) : null}

        <SectionHeader title={t("operatorTasks.field.focus")} />
        <SegmentedControl
          accessibilityLabel={t("operatorTasks.field.focus")}
          options={focusOptions}
          value={focus}
          onValueChange={setFocus}
          variant="pills"
          scrollable
        />

        {scope === "restaurant" ? (
          <>
            <SectionHeader title={t("operatorTasks.field.window")} />
            <SegmentedControl
              accessibilityLabel={t("operatorTasks.field.window")}
              options={windowOptions}
              value={serviceWindow}
              onValueChange={setServiceWindow}
              variant="pills"
              scrollable
            />

            <SectionHeader title={t("operatorTasks.field.requiredRole")} />
            <SegmentedControl
              accessibilityLabel={t("operatorTasks.field.requiredRole")}
              options={roleOptions}
              value={requiredRole}
              onValueChange={(nextRole) => {
                setRequiredRole(nextRole);
                setAssigneeUserId(null);
              }}
              variant="pills"
              scrollable
            />

            <SectionHeader title={t("operatorTasks.field.assignee")} subtitle={t("operatorTasks.field.assigneeHint")} />
            <View style={styles.choiceList}>
              <ChoiceRow
                label={t("operatorTasks.assignee.unassigned")}
                selected={!assigneeUserId}
                onPress={() => setAssigneeUserId(null)}
              />
              {assignableTeam.map((member) => (
                <ChoiceRow
                  key={member.user_id}
                  label={member.name?.trim() || member.email?.trim() || t("operatorTasks.assignee.teammate")}
                  detail={member.role}
                  selected={assigneeUserId === member.user_id}
                  onPress={() => setAssigneeUserId(member.user_id)}
                />
              ))}
            </View>

            <SectionHeader title={t("operatorTasks.field.verification")} />
            <SegmentedControl
              accessibilityLabel={t("operatorTasks.field.verification")}
              options={verificationOptions}
              value={verificationMethod}
              onValueChange={setVerificationMethod}
              variant="pills"
              scrollable
            />

            <SectionHeader title={t("operatorTasks.field.checklist")} subtitle={t("operatorTasks.field.checklistHint")} />
            <TextInput
              accessibilityLabel={t("operatorTasks.field.checklist")}
              placeholder={t("operatorTasks.field.checklistPlaceholder")}
              placeholderTextColor={colors.faint}
              value={checklistText}
              onChangeText={setChecklistText}
              style={[styles.input, styles.checklistInput]}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />

            <SectionHeader title={t("operatorTasks.field.dependency")} subtitle={t("operatorTasks.field.dependencyHint")} />
            <View style={styles.choiceList}>
              <ChoiceRow
                label={t("operatorTasks.dependency.none")}
                selected={!dependencyId}
                onPress={() => setDependencyId(null)}
              />
              {openSharedTasks.slice(0, 12).map((task) => (
                <ChoiceRow
                  key={task.id}
                  label={task.title}
                  detail={task.status}
                  selected={dependencyId === task.id}
                  onPress={() => setDependencyId(task.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Button
          title={saving ? t("common.saving") : t("operatorTasks.save")}
          icon={<ClipboardList size={icon.row} color={colors.surface} strokeWidth={iconStroke} />}
          onPress={() => void save()}
          disabled={saving}
          fullWidth
        />

        <View style={styles.listHeader}>
          <SectionHeader
            title={
              showCompleted
                ? t("operatorTasks.list.completedTitle")
                : t("operatorTasks.list.openTitle")
            }
            subtitle={
              showCompleted
                ? t("operatorTasks.list.completedSubtitle", {
                    count: scope === "restaurant" ? completedSharedTasks.length : completedTasks.length
                  })
                : t("operatorTasks.list.openSubtitle", {
                    count: scope === "restaurant" ? openSharedTasks.length : openTasks.length
                  })
            }
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showCompleted
                ? t("operatorTasks.list.showOpen")
                : t("operatorTasks.list.showCompleted")
            }
            onPress={() => setShowCompleted((current) => !current)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <Text style={styles.toggleLabel}>
              {showCompleted
                ? t("operatorTasks.list.showOpen")
                : t("operatorTasks.list.showCompleted")}
            </Text>
          </Pressable>
        </View>

        {listError ? (
          <StatusNotice tone="danger" title={t("common.error")} message={listError} />
        ) : null}

        {(scope === "restaurant"
          ? showCompleted ? completedSharedTasks : openSharedTasks
          : visibleList).length === 0 ? (
          <EmptyState
            title={
              showCompleted
                ? t("operatorTasks.list.emptyCompletedTitle")
                : t("operatorTasks.list.emptyOpenTitle")
            }
            body={
              showCompleted
                ? t("operatorTasks.list.emptyCompletedBody")
                : t("operatorTasks.list.emptyOpenBody")
            }
          />
        ) : scope === "restaurant" ? (
          <View style={styles.taskList}>
            {(showCompleted ? completedSharedTasks : openSharedTasks).map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("operatorTasks.list.rowAccessibility", { title: task.title })}
                  onPress={() => router.push(`/tasks/${task.id}`)}
                  style={({ pressed }) => [styles.taskMain, pressed && styles.pressed]}
                >
                  <View style={styles.taskCopy}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.detail ? <Text numberOfLines={3} style={styles.taskBody}>{task.detail}</Text> : null}
                    <Text style={styles.taskMeta}>
                      {t(task.status === "blocked" ? "operatorTasks.shared.blocked" : "operatorTasks.shared.central")}
                    </Text>
                  </View>
                  <View style={styles.badges}>
                    <Badge
                      label={t(`operatorTasks.priority.${task.priority}` as MessageKey)}
                      tone={priorityTone(task.priority)}
                    />
                    <Badge label={t("operatorTasks.scope.restaurant")} tone="neutral" />
                  </View>
                </Pressable>
                <Button
                  title={t("today.action.open")}
                  size="compact"
                  variant="secondary"
                  onPress={() => router.push(`/tasks/${task.id}`)}
                  style={styles.taskAction}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.taskList}>
            {visibleList.map((task) => {
              const focusRoute = operatorTaskFocusRoute(task.focusArea);
              const dueLabel = formatDueLabel(task.dueAt, t);
              return (
                <View key={task.id} style={styles.taskCard}>
                  <Pressable
                    accessibilityRole={focusRoute ? "button" : undefined}
                    accessibilityLabel={t("operatorTasks.list.rowAccessibility", {
                      title: task.title
                    })}
                    disabled={!focusRoute}
                    onPress={focusRoute ? () => router.push(focusRoute as never) : undefined}
                    style={({ pressed }) => [
                      styles.taskMain,
                      pressed && focusRoute && styles.pressed
                    ]}
                  >
                    <View style={styles.taskCopy}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.body ? (
                        <Text numberOfLines={3} style={styles.taskBody}>
                          {task.body}
                        </Text>
                      ) : null}
                      {dueLabel ? <Text style={styles.taskMeta}>{dueLabel}</Text> : null}
                    </View>
                    <View style={styles.badges}>
                      <Badge
                        label={t(`operatorTasks.priority.${task.priority}` as MessageKey)}
                        tone={priorityTone(task.priority)}
                      />
                      {task.focusArea ? (
                        <Badge
                          label={t(
                            task.focusArea === "inventory"
                              ? "floorNotes.focus.inventory"
                              : task.focusArea === "orders"
                                ? "floorNotes.focus.orders"
                                : task.focusArea === "insights"
                                  ? "floorNotes.focus.insights"
                                  : "floorNotes.focus.ask"
                          )}
                          tone="neutral"
                        />
                      ) : null}
                    </View>
                  </Pressable>
                  <Button
                    title={
                      busyTaskId === task.id
                        ? t("common.saving")
                        : showCompleted
                          ? t("operatorTasks.list.reopen")
                          : t("operatorTasks.list.markDone")
                    }
                    size="compact"
                    variant="secondary"
                    onPress={() => void (showCompleted ? reopen(task) : markDone(task))}
                    disabled={busyTaskId === task.id}
                    style={styles.taskAction}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

function ChoiceRow({
  label,
  detail,
  selected,
  onPress
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceRow, selected && styles.choiceRowSelected, pressed && styles.pressed]}
    >
      <View style={[styles.choiceDot, selected && styles.choiceDotSelected]} />
      <Text style={styles.choiceLabel} numberOfLines={2}>{label}</Text>
      {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function memberCanTakeRole(
  member: RestaurantTeamMember,
  requiredRole: RestaurantTaskRequiredRole
) {
  if (requiredRole === "member") return true;
  if (requiredRole === "manager") {
    return member.role === "owner" || member.role === "admin" || member.role === "manager";
  }
  return member.role === "owner" || member.role === "admin";
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    ...typography.body
  },
  bodyInput: {
    minHeight: 112
  },
  checklistInput: {
    minHeight: 96
  },
  choiceList: {
    gap: 8
  },
  choiceRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface
  },
  choiceRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  choiceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  choiceDotSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  choiceLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text
  },
  choiceDetail: {
    ...typography.caption,
    color: colors.muted,
    textTransform: "capitalize"
  },
  listHeader: {
    gap: 8,
    marginTop: 8
  },
  toggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2
  },
  toggleLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600"
  },
  pressed: {
    opacity: 0.72
  },
  taskList: {
    gap: 10
  },
  taskCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 10
  },
  taskMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  taskCopy: {
    flex: 1,
    gap: 4
  },
  taskTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600"
  },
  taskBody: {
    ...typography.caption,
    color: colors.muted
  },
  taskMeta: {
    ...typography.caption,
    color: colors.faint
  },
  badges: {
    gap: 6,
    alignItems: "flex-end"
  },
  taskAction: {
    alignSelf: "stretch"
  }
});
