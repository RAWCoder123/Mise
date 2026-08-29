import type { MessageKey } from "../../i18n/catalog";
import type { AutonomyOperationalCategory } from "../domain/restaurantAutonomy";
import type { AutonomyLevel } from "../domain/operationalStatus";
import type { MiseActionType } from "../domain/miseActions";

/**
 * Message keys for Settings → Autonomy operator-facing labels.
 * Keep in sync with i18n `autonomy.levelName.*`, `autonomy.actionType.*`,
 * and `autonomy.category.*`.
 */

const LEVEL_KEYS = {
  1: "autonomy.levelName.observe",
  2: "autonomy.levelName.recommend",
  3: "autonomy.levelName.prepare",
  4: "autonomy.levelName.execute",
  5: "autonomy.levelName.optimize"
} as const satisfies Record<AutonomyLevel, MessageKey>;

const CATEGORY_KEYS = {
  inventory: "autonomy.category.inventory",
  orders: "autonomy.category.orders",
  sales: "autonomy.category.sales",
  team: "autonomy.category.team",
  waste: "autonomy.category.waste",
  tasks: "autonomy.category.tasks",
  integrations: "autonomy.category.integrations",
  settings: "autonomy.category.settings"
} as const satisfies Record<AutonomyOperationalCategory, MessageKey>;

const ACTION_TYPE_KEYS = {
  create_internal_task: "autonomy.actionType.create_internal_task",
  recalculate_forecast: "autonomy.actionType.recalculate_forecast",
  update_prep_recommendation: "autonomy.actionType.update_prep_recommendation",
  schedule_inventory_count: "autonomy.actionType.schedule_inventory_count",
  remind_employee: "autonomy.actionType.remind_employee",
  flag_menu_item_internally: "autonomy.actionType.flag_menu_item_internally",
  prepare_supplier_order_draft: "autonomy.actionType.prepare_supplier_order_draft",
  send_supplier_order: "autonomy.actionType.send_supplier_order",
  change_schedule: "autonomy.actionType.change_schedule",
  contact_external_party: "autonomy.actionType.contact_external_party",
  modify_menu_availability: "autonomy.actionType.modify_menu_availability",
  change_price: "autonomy.actionType.change_price",
  send_staff_communication: "autonomy.actionType.send_staff_communication",
  send_supplier_communication: "autonomy.actionType.send_supplier_communication",
  issue_refund_or_credit: "autonomy.actionType.issue_refund_or_credit",
  change_permissions_or_rules: "autonomy.actionType.change_permissions_or_rules",
  prepare_inventory_adjustment: "autonomy.actionType.prepare_inventory_adjustment",
  measure_outcome: "autonomy.actionType.measure_outcome"
} as const satisfies Record<MiseActionType, MessageKey>;

export function autonomyLevelLabelKey(level: AutonomyLevel): MessageKey {
  return LEVEL_KEYS[level];
}

export function autonomyCategoryLabelKey(category: AutonomyOperationalCategory): MessageKey {
  return CATEGORY_KEYS[category];
}

export function autonomyActionTypeLabelKey(actionType: string): MessageKey | null {
  if (Object.prototype.hasOwnProperty.call(ACTION_TYPE_KEYS, actionType)) {
    return ACTION_TYPE_KEYS[actionType as MiseActionType];
  }
  return null;
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** Localized autonomy level name; domain English label remains the fallback for parity checks. */
export function presentAutonomyLevelLabel(level: AutonomyLevel, t: Translate): string {
  return t(autonomyLevelLabelKey(level));
}

export function presentAutonomyCategoryLabel(
  category: AutonomyOperationalCategory,
  t: Translate
): string {
  return t(autonomyCategoryLabelKey(category));
}

/**
 * Localized action-type title. Unknown persisted types fall back to a readable
 * underscore-split form so the screen never invents a catalog key.
 */
export function presentAutonomyActionTypeLabel(actionType: string, t: Translate): string {
  const key = autonomyActionTypeLabelKey(actionType);
  if (key) return t(key);
  const trimmed = actionType.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : "—";
}
