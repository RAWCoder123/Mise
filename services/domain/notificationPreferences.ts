import type { DailyOperatingPlan, OperatingPlanItem } from "./operatingPlan";
import type { OperatingBrief } from "./operatingBrief";
import type { OperationalTodayTask } from "./todayTasks";

/**
 * Operator-controlled Today/Home attention categories. These mute in-app plan
 * surfaces only; they are never authorization inputs and do not gate Edge or
 * Data API access.
 */
export const NOTIFICATION_CATEGORIES = [
  "inventory",
  "orders",
  "deliveries",
  "waste",
  "recipes_pos",
  "insights",
  "setup"
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type OperatorNotificationPreferences = Record<NotificationCategory, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: OperatorNotificationPreferences = {
  inventory: true,
  orders: true,
  deliveries: true,
  waste: true,
  recipes_pos: true,
  insights: true,
  setup: true
};

const DELIVERY_TODAY_TASK_CODES = new Set([
  "today.order.receive",
  "today.order.received"
]);

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeNotificationPreferences(value: unknown): OperatorNotificationPreferences {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const normalized = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof source[category] === "boolean") {
      normalized[category] = source[category];
    }
  }
  return normalized;
}

export function toggleNotificationCategory(
  preferences: OperatorNotificationPreferences,
  category: NotificationCategory,
  enabled: boolean
): OperatorNotificationPreferences {
  return {
    ...normalizeNotificationPreferences(preferences),
    [category]: enabled
  };
}

/**
 * Map an authoritative Today task onto a muteable category using presentation
 * codes so learning/repair tasks stay with their operational family.
 */
export function notificationCategoryForTodayTask(
  task: Pick<OperationalTodayTask, "presentation" | "source"> &
    Partial<Pick<OperationalTodayTask, "action">>
): NotificationCategory | null {
  const code = task.presentation?.code ?? "";
  const actionIntent = task.action?.intent;
  if (
    code.startsWith("today.inventory.") ||
    code.startsWith("today.inventory_count_session.")
  ) {
    return "inventory";
  }
  if (DELIVERY_TODAY_TASK_CODES.has(code) || actionIntent === "receive_supplier_order") {
    return "deliveries";
  }
  if (
    code.startsWith("today.recommendation.") ||
    code.startsWith("today.order.") ||
    code.startsWith("today.ordering.")
  ) {
    return "orders";
  }
  if (code.startsWith("today.waste.")) return "waste";
  if (code.startsWith("today.recipe.") || code.startsWith("today.integration.")) {
    return "recipes_pos";
  }
  if (code.startsWith("today.insight.")) return "insights";
  if (code.startsWith("today.setup.")) return "setup";

  switch (task.source.kind) {
    case "inventory":
    case "inventory_count_session":
      return "inventory";
    case "recommendation":
    case "order":
      // Receive intents already returned deliveries above.
      return "orders";
    case "integration":
      return "recipes_pos";
    case "insight":
      return "insights";
    case "setup":
      return "setup";
    case "restaurant_task":
      return null;
    default:
      return null;
  }
}

export function notificationCategoryForOperatingPlanItem(
  item: Pick<OperatingPlanItem, "sourceTask" | "relatedRefs" | "kind" | "reprioritization">
): NotificationCategory | null {
  if (item.reprioritization?.code === "delivery_overdue") {
    return "deliveries";
  }

  if (item.sourceTask) {
    return notificationCategoryForTodayTask(item.sourceTask);
  }

  // Central/human tasks without a Mise Today source stay visible; operators mute
  // only derived attention families, never manager-assigned floor work.
  if (item.kind === "human_task") return null;

  for (const ref of item.relatedRefs) {
    switch (ref.type) {
      case "inventory_item":
      case "inventory_count_session":
        return "inventory";
      case "purchase_recommendation":
        return "orders";
      case "supplier_order":
        // Without a source task, supplier-order refs stay under purchasing unless
        // the plan already marked them delivery-overdue above.
        return "orders";
      case "insight":
        return "insights";
      case "pos_integration":
        return "recipes_pos";
      case "setup_step":
        return "setup";
      default:
        break;
    }
  }

  return null;
}

export function filterOperationalTodayTasksByNotificationPreferences<
  T extends Pick<OperationalTodayTask, "presentation" | "source"> &
    Partial<Pick<OperationalTodayTask, "action">>
>(tasks: readonly T[], preferences: OperatorNotificationPreferences): T[] {
  const normalized = normalizeNotificationPreferences(preferences);
  return tasks.filter((task) => {
    const category = notificationCategoryForTodayTask(task);
    if (!category) return true;
    return normalized[category];
  });
}

export function filterOperatingPlanByNotificationPreferences(
  plan: DailyOperatingPlan,
  preferences: OperatorNotificationPreferences
): DailyOperatingPlan {
  const normalized = normalizeNotificationPreferences(preferences);
  const items = plan.items.filter((item) => {
    const category = notificationCategoryForOperatingPlanItem(item);
    if (!category) return true;
    return normalized[category];
  });

  const buckets: DailyOperatingPlan["buckets"] = {
    now: [],
    up_next: [],
    later: [],
    done: []
  };
  for (const item of items) {
    buckets[item.bucket].push(item);
  }

  return {
    ...plan,
    items,
    buckets
  };
}

/**
 * Soften Home operating-brief delivery attention when deliveries are muted.
 * Does not invent inventory or approval facts; only removes delivery-family
 * surfacing and falls back to other evidenced risks for status copy.
 */
export function filterOperatingBriefByNotificationPreferences(
  brief: OperatingBrief,
  preferences: OperatorNotificationPreferences
): OperatingBrief {
  const normalized = normalizeNotificationPreferences(preferences);
  if (normalized.deliveries) return brief;

  const deliveryWasOverdue = brief.outlook.deliveryStatus === "overdue";
  const outlook = {
    ...brief.outlook,
    deliveryStatus: "none" as const,
    deliveryDetail: ""
  };

  const miseIsWatching = brief.miseIsWatching.filter((row) => {
    if (row.relatedEntityType !== "supplier_order") return true;
    // Draft purchasing work stays visible under orders; mute only receipt waits.
    return row.title.startsWith("Draft ");
  });

  let restaurantStatus = brief.restaurantStatus;
  if (deliveryWasOverdue) {
    const topRisk =
      outlook.menuRisks[0]?.detail ??
      brief.needsApproval[0]?.riskIfIgnored ??
      (brief.restaurantStatus.dataFreshness.state === "incomplete"
        ? brief.restaurantStatus.dataFreshness.label
        : null);
    const stillNeedsAttention =
      brief.needsApproval.length > 0 ||
      outlook.menuRisks.length > 0 ||
      brief.restaurantStatus.dataFreshness.state === "stale" ||
      brief.restaurantStatus.dataFreshness.state === "incomplete" ||
      brief.restaurantStatus.status === "at_risk";

    restaurantStatus = {
      ...brief.restaurantStatus,
      topRisk,
      status:
        brief.restaurantStatus.status === "at_risk"
          ? "at_risk"
          : stillNeedsAttention
            ? "attention_needed"
            : "on_track",
      summary:
        brief.restaurantStatus.status === "at_risk"
          ? brief.restaurantStatus.summary
          : stillNeedsAttention
            ? `Attention needed: ${brief.needsApproval.length} approval${
                brief.needsApproval.length === 1 ? "" : "s"
              } and ${outlook.menuRisks.length} inventory watch item${
                outlook.menuRisks.length === 1 ? "" : "s"
              } are open.`
            : `Service looks prepared. Mise reviewed sales, inventory, and supplier coverage${
                brief.needsApproval.length > 0
                  ? `, and ${brief.needsApproval.length} decision${
                      brief.needsApproval.length === 1 ? "" : "s"
                    } still need approval`
                  : ""
              }.`
    };
  }

  return {
    ...brief,
    outlook,
    miseIsWatching,
    restaurantStatus
  };
}
