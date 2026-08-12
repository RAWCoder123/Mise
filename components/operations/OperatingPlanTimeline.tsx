import { LockKeyhole } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { colors, conceptTypography, density, iconStroke, radii } from "../../constants/theme";
import { useLocale } from "../../contexts/LocaleContext";
import type { AppLocale, MessageKey, MessageValues } from "../../i18n/catalog";
import type { OperatingPlanBucket, OperatingPlanItem } from "../../services/domain/operatingPlan";
import {
  canRestaurantRoleActOnTodayTask,
  classifyOperationalTodayTaskTiming,
  type OperationalTodayTaskActionIntent,
  type OperationalTodayTaskTiming
} from "../../services/domain/todayTasks";
import { presentOperatingPlanItem } from "../../services/presentation/operationsPresentation";
import type { RestaurantRole } from "../../types/mise";

type Translator = (key: MessageKey, values?: MessageValues) => string;

export function OperatingPlanTimeline({
  groups,
  focus,
  locale,
  role,
  restaurantTimeZone,
  t
}: {
  groups: ReadonlyArray<{
    key: OperatingPlanBucket;
    label: string;
    items: OperatingPlanItem[];
    total: number;
  }>;
  focus: OperatingPlanBucket;
  locale: AppLocale;
  role: RestaurantRole;
  restaurantTimeZone: string;
  t: Translator;
}) {
  const flat = groups.flatMap((group) =>
    group.items.map((item, index) => ({
      item,
      group: group.key,
      showPrimary: group.key === "now" && index === 0 && item.status !== "completed"
    }))
  );

  if (flat.length === 0) {
    return (
      <View style={styles.emptyTimeline}>
        <Text style={styles.emptyTitle}>{t(emptyTitleKey(focus))}</Text>
        <Text style={styles.emptyBody}>{t("today.emptyBody")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.timelineList}>
      {groups.map((group) => {
        if (group.items.length === 0) return null;
        const groupStartIndex = flat.findIndex((row) => row.group === group.key);
        return (
          <View key={group.key} style={styles.timelineGroup}>
            {group.items.map((item, index) => {
              const globalIndex = groupStartIndex + index;
              return (
                <OperatingPlanItemRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  role={role}
                  restaurantTimeZone={restaurantTimeZone}
                  isFirst={globalIndex === 0}
                  isLast={globalIndex === flat.length - 1}
                  isGroupFirst={index === 0}
                  isGroupLast={index === group.items.length - 1}
                  groupLabel={index === 0 ? group.label : undefined}
                  showPrimaryAction={group.key === "now" && index === 0}
                  t={t}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function OperatingPlanItemRow({
  item,
  locale,
  role,
  restaurantTimeZone,
  isFirst,
  isLast,
  isGroupFirst,
  isGroupLast,
  groupLabel,
  showPrimaryAction,
  t
}: {
  item: OperatingPlanItem;
  locale: AppLocale;
  role: RestaurantRole;
  restaurantTimeZone: string;
  isFirst: boolean;
  isLast: boolean;
  isGroupFirst: boolean;
  isGroupLast: boolean;
  groupLabel?: string;
  showPrimaryAction: boolean;
  t: Translator;
}) {
  const { formatDate, formatDueTime } = useLocale();
  const presentation = presentOperatingPlanItem(locale, item);
  const task = item.sourceTask;
  const timing = task
    ? classifyOperationalTodayTaskTiming(task, { restaurantTimeZone })
    : centralTaskTiming(item);
  const canAct = task
    ? canRestaurantRoleActOnTodayTask(role, task)
    : canRoleActOnCentralTask(role, item.requiredRole);
  const high = item.priority === "urgent" || item.priority === "high";
  const timeLabel = neededByLabel(item, timing, restaurantTimeZone, formatDate, formatDueTime, t);
  const actionLabel = task ? t(intentKey(task.action.intent)) : t("today.action.start");
  const isDone = item.status === "completed";
  const isHot = !isDone && (high || item.bucket === "now");
  const isLater = !isDone && item.bucket === "later";

  return (
    <View style={[styles.timelineRow, showPrimaryAction && styles.timelineRowActive]}>
      <View style={styles.timeColumn}>
        {groupLabel ? (
          <Text numberOfLines={1} style={styles.groupLabel}>
            {groupLabel}
          </Text>
        ) : null}
        <Text
          numberOfLines={2}
          style={[
            styles.timeText,
            isHot && styles.timeTextHot,
            isLater && styles.timeTextMuted,
            isDone && styles.timeTextDone
          ]}
        >
          {timeLabel}
        </Text>
        <View style={styles.lineWrap}>
          {!isFirst ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
          <View
            style={[
              styles.timelineDot,
              isHot && styles.timelineDotHigh,
              isLater && styles.timelineDotMuted,
              isDone && styles.timelineDotDone
            ]}
          />
          {!isLast ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineTransparent} />}
        </View>
      </View>

      <View
        style={[
          styles.taskContent,
          isGroupFirst && styles.taskContentFirst,
          isGroupLast && styles.taskContentLast,
          showPrimaryAction && styles.taskContentActive
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("today.task.accessibility", {
            title: presentation.title,
            detail: presentation.detail,
            action: actionLabel
          })}
          onPress={() => router.push(`/tasks/${item.id}`)}
          style={({ pressed }) => [styles.taskMain, pressed && styles.pressed]}
        >
          <View style={styles.taskCopy}>
            <Text numberOfLines={2} style={styles.taskTitle}>
              {presentation.title}
            </Text>
            {presentation.windowLabel ? (
              <Text numberOfLines={1} style={styles.taskWindow}>
                {presentation.windowLabel}
              </Text>
            ) : null}
            {isDone && presentation.completionResult ? (
              <Text numberOfLines={1} style={styles.result}>
                {t("today.plan.result", { result: presentation.completionResult })}
              </Text>
            ) : null}
          </View>
          <Badge
            label={t(
              isDone ? "task.badge.done" : high ? "task.badge.high" : "task.badge.normal"
            )}
            tone={isDone ? "success" : high ? "danger" : "neutral"}
          />
        </Pressable>

        {showPrimaryAction && canAct && !isDone ? (
          <View style={styles.taskActions}>
            <Button
              title={t("today.action.start")}
              size="compact"
              onPress={() => router.push(task ? task.action.route : `/tasks/${item.id}`)}
              style={styles.startButton}
            />
          </View>
        ) : showPrimaryAction && !canAct && !isDone ? (
          <View style={styles.lockedAction}>
            <LockKeyhole size={12} color={colors.muted} strokeWidth={iconStroke} />
            <Text style={styles.lockedText}>
              {t(item.requiredRole === "owner_admin" ? "today.locked.ownerAdmin" : "today.locked.manager")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function centralTaskTiming(item: OperatingPlanItem): OperationalTodayTaskTiming {
  if (!item.neededBy) return "unscheduled";
  const due = Date.parse(item.neededBy);
  if (!Number.isFinite(due)) return "unscheduled";
  const delta = due - Date.now();
  if (delta < 0) return "overdue";
  if (delta <= 4 * 60 * 60 * 1000) return "due_soon";
  return "today";
}

function canRoleActOnCentralTask(
  role: RestaurantRole,
  requiredRole: OperatingPlanItem["requiredRole"]
) {
  if (requiredRole === "member") return true;
  if (requiredRole === "manager") return role === "owner" || role === "admin" || role === "manager";
  return role === "owner" || role === "admin";
}

function neededByLabel(
  item: OperatingPlanItem,
  timing: OperationalTodayTaskTiming,
  restaurantTimeZone: string,
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions & { timeZone?: string }) => string,
  formatDueTime: (value: Date | number | string, options?: { timeZone?: string }) => string,
  t: Translator
) {
  if (item.neededBy && /Z$/i.test(item.neededBy)) {
    return formatDueTime(item.neededBy, { timeZone: restaurantTimeZone });
  }
  if (item.neededBy && /^\d{4}-\d{2}-\d{2}$/.test(item.neededBy)) {
    return formatDate(`${item.neededBy}T12:00:00.000Z`, {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }
  if (timing === "overdue") return t("relative.overdue");
  if (timing === "due_soon") return t("relative.dueNow");
  if (timing === "today") return t("relative.today");
  // No exact deadline: leave the time column empty rather than stamping
  // "No time" on it. The concept's left column is a clock, and printing a
  // filler word there in urgency red drew the eye to absent data — the bucket
  // heading above the dot already says when this belongs.
  return null;
}

function emptyTitleKey(filter: OperatingPlanBucket): MessageKey {
  if (filter === "done") return "today.emptyDone";
  if (filter === "now") return "today.emptyNow";
  if (filter === "up_next") return "today.emptyUpNext";
  return "today.emptyLater";
}

function intentKey(intent: OperationalTodayTaskActionIntent): MessageKey {
  if (intent === "update_inventory_count") return "today.intent.updateCount";
  if (intent === "begin_inventory_count_session") return "today.intent.beginCountSession";
  if (intent === "continue_inventory_count_session") return "today.intent.continueCountSession";
  if (intent === "review_recommendation") return "today.intent.reviewRecommendation";
  if (intent === "prepare_supplier_draft") return "today.intent.prepareDraft";
  if (intent === "send_supplier_order") return "today.intent.sendOrder";
  if (intent === "finish_setup") return "today.intent.finishSetup";
  if (intent === "connect_pos") return "today.intent.connectPos";
  if (intent === "review_insight") return "today.intent.reviewInsight";
  return "today.intent.manageConnection";
}

const styles = StyleSheet.create({
  emptyTimeline: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8
  },
  emptyTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle,
    marginTop: 8
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
    gap: 0,
    marginTop: 8
  },
  groupLabel: {
    width: density.timeColumn - 4,
    color: colors.text,
    ...conceptTypography.rowTitle,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "left",
    marginBottom: 3
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: density.timelineRow,
    paddingVertical: 0
  },
  timelineRowActive: {
    minHeight: density.timelineRowActive
  },
  timeColumn: {
    width: density.timeColumn,
    alignItems: "flex-start"
  },
  timeText: {
    width: density.timeColumn - 4,
    color: colors.text,
    ...conceptTypography.caption,
    textAlign: "left",
    marginTop: 1
  },
  timeTextHot: {
    color: colors.danger
  },
  timeTextMuted: {
    color: colors.muted
  },
  timeTextDone: {
    color: colors.success
  },
  lineWrap: {
    flex: 1,
    minHeight: 22,
    alignItems: "center",
    marginTop: 4,
    marginLeft: 10
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
    marginVertical: 3
  },
  timelineDotHigh: {
    backgroundColor: colors.danger
  },
  timelineDotMuted: {
    backgroundColor: colors.faint
  },
  timelineDotDone: {
    backgroundColor: colors.success
  },
  // A bucket is one grouped card. Rows share the side borders and use a
  // hairline divider, matching the reference timeline rather than floating as
  // unrelated task cards.
  taskContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  taskContentFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm
  },
  taskContentLast: {
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm
  },
  taskContentActive: {
    justifyContent: "flex-start"
  },
  taskMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  taskWindow: {
    color: colors.muted,
    ...conceptTypography.subtitle
  },
  taskCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  taskTitle: {
    color: colors.text,
    ...conceptTypography.rowTitle
  },
  result: {
    color: colors.success,
    ...conceptTypography.body,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6
  },
  startButton: {
    minWidth: 104
  },
  lockedAction: {
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.panel
  },
  lockedText: {
    color: colors.muted,
    ...conceptTypography.caption
  },
  pressed: {
    opacity: 0.72
  }
});
