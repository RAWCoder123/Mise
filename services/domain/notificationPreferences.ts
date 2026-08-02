import type { OperationalTodayTask } from "./todayTasks";

/**
 * Operator-controlled Today attention categories. These mute in-app task
 * surfaces only; they are never authorization inputs and do not gate Edge or
 * Data API access.
 */
export const NOTIFICATION_CATEGORIES = [
  "inventory",
  "orders",
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
  waste: true,
  recipes_pos: true,
  insights: true,
  setup: true
};

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
 * codes so chronic learning tasks stay with their operational family.
 */
export function notificationCategoryForTodayTask(
  task: Pick<OperationalTodayTask, "presentation" | "source">
): NotificationCategory | null {
  const code = task.presentation?.code ?? "";
  if (
    code.startsWith("today.inventory.") ||
    code.startsWith("today.inventory_count_session.")
  ) {
    return "inventory";
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
      return "orders";
    case "recipe":
    case "integration":
      return "recipes_pos";
    case "insight":
      return "insights";
    case "setup":
      return "setup";
    default:
      return null;
  }
}

export function filterOperationalTodayTasksByNotificationPreferences<T extends Pick<
  OperationalTodayTask,
  "presentation" | "source"
>>(tasks: readonly T[], preferences: OperatorNotificationPreferences): T[] {
  const normalized = normalizeNotificationPreferences(preferences);
  return tasks.filter((task) => {
    const category = notificationCategoryForTodayTask(task);
    if (!category) return true;
    return normalized[category];
  });
}
