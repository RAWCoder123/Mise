import type { MessageKey } from "../../i18n/catalog";
import type { RestaurantTaskStatus } from "../domain/restaurantTasks";

/**
 * Message keys for shared restaurant-task status shown in Create Task pickers
 * and related operator surfaces. Keep in sync with i18n `operatorTasks.status.*`.
 */

const STATUS_KEYS = {
  waiting: "operatorTasks.status.waiting",
  blocked: "operatorTasks.status.blocked",
  in_progress: "operatorTasks.status.in_progress",
  completed: "operatorTasks.status.completed",
  cancelled: "operatorTasks.status.cancelled",
  could_not_verify: "operatorTasks.status.could_not_verify"
} as const satisfies Record<RestaurantTaskStatus, MessageKey>;

export function restaurantTaskStatusLabelKey(status: RestaurantTaskStatus): MessageKey {
  return STATUS_KEYS[status];
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/**
 * Localized task status. Unknown persisted values fall back to a readable
 * underscore-split form so the picker never invents a catalog key.
 */
export function presentRestaurantTaskStatusLabel(status: string, t: Translate): string {
  if (Object.prototype.hasOwnProperty.call(STATUS_KEYS, status)) {
    return t(STATUS_KEYS[status as RestaurantTaskStatus]);
  }
  const trimmed = status.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : "—";
}
