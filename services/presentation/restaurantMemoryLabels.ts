import type { MessageKey } from "../../i18n/catalog";
import type {
  RestaurantMemoryStatus,
  RestaurantMemoryType
} from "../domain/restaurantMemory";

/**
 * Message keys for restaurant-memory type and status chips shown on the
 * Restaurant Memory hub. Keep in sync with i18n `memory.type.*` / `memory.status.*`.
 */

const TYPE_KEYS = {
  demand_pattern: "memory.type.demand_pattern",
  prep_habit: "memory.type.prep_habit",
  waste_pattern: "memory.type.waste_pattern",
  supplier_reliability: "memory.type.supplier_reliability",
  staff_timing: "memory.type.staff_timing",
  safety_stock_preference: "memory.type.safety_stock_preference",
  service_window: "memory.type.service_window",
  approval_preference: "memory.type.approval_preference",
  seasonal_effect: "memory.type.seasonal_effect",
  weather_effect: "memory.type.weather_effect",
  local_event_effect: "memory.type.local_event_effect",
  menu_dependency: "memory.type.menu_dependency",
  operational_exception: "memory.type.operational_exception",
  rejected_recommendation: "memory.type.rejected_recommendation",
  edited_quantity: "memory.type.edited_quantity",
  recurring_bottleneck: "memory.type.recurring_bottleneck",
  action_outcome: "memory.type.action_outcome"
} as const satisfies Record<RestaurantMemoryType, MessageKey>;

const STATUS_KEYS = {
  active: "memory.status.active",
  confirmed: "memory.status.confirmed",
  corrected: "memory.status.corrected",
  dismissed: "memory.status.dismissed",
  forgotten: "memory.status.forgotten",
  disabled: "memory.status.disabled"
} as const satisfies Record<RestaurantMemoryStatus, MessageKey>;

export function restaurantMemoryTypeLabelKey(type: RestaurantMemoryType): MessageKey {
  return TYPE_KEYS[type];
}

export function restaurantMemoryStatusLabelKey(status: RestaurantMemoryStatus): MessageKey {
  return STATUS_KEYS[status];
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/**
 * Localized memory type. Unknown persisted values fall back to a readable
 * underscore-split form so the hub never invents a catalog key or operational fact.
 */
export function presentRestaurantMemoryTypeLabel(type: string, t: Translate): string {
  if (Object.prototype.hasOwnProperty.call(TYPE_KEYS, type)) {
    return t(TYPE_KEYS[type as RestaurantMemoryType]);
  }
  const trimmed = type.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : "—";
}

/**
 * Localized memory status. Unknown persisted values fall back to a readable
 * underscore-split form so the hub never invents a catalog key.
 */
export function presentRestaurantMemoryStatusLabel(status: string, t: Translate): string {
  if (Object.prototype.hasOwnProperty.call(STATUS_KEYS, status)) {
    return t(STATUS_KEYS[status as RestaurantMemoryStatus]);
  }
  const trimmed = status.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : "—";
}
