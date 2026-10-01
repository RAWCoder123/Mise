import type { MessageKey } from "../../i18n/catalog";
import type {
  ActivityCategory,
  ActivityRelatedEntityType,
  ActivityStatus
} from "../domain/activityEvents";

type Translate = (key: MessageKey) => string;

const ACTIVITY_TRIGGER_KEYS = {
  recalculation: "activity.trigger.recalculation",
  inventory_depletion: "activity.trigger.inventory_depletion",
  owner_approval: "activity.trigger.owner_approval",
  owner_decision: "activity.trigger.owner_decision",
  approved_recommendations: "activity.trigger.approved_recommendations",
  owner_send: "activity.trigger.owner_send",
  physical_count: "activity.trigger.physical_count",
  delivery_receipt: "activity.trigger.delivery_receipt",
  inventory_waste: "activity.trigger.inventory_waste",
  operational_finding: "activity.trigger.operational_finding",
  pos_sync: "activity.trigger.pos_sync",
  learning_summary: "activity.trigger.learning_summary",
  depletion_projection: "activity.trigger.depletion_projection",
  sales_history: "activity.trigger.sales_history",
  action_decision: "activity.trigger.action_decision",
  supplier_delivery: "activity.trigger.supplier_delivery",
  supplier_delivery_outcome: "activity.trigger.supplier_delivery_outcome",
  forecast_updated: "activity.trigger.forecast_updated",
  prep_plan_updated: "activity.trigger.prep_plan_updated",
  inventory_risk_detected: "activity.trigger.inventory_risk_detected",
  physical_count_requested: "activity.trigger.physical_count_requested",
  supplier_prices_checked: "activity.trigger.supplier_prices_checked",
  order_prepared: "activity.trigger.order_prepared",
  order_approved: "activity.trigger.order_approved",
  order_sent: "activity.trigger.order_sent",
  supplier_confirmation_received: "activity.trigger.supplier_confirmation_received",
  delivery_expected: "activity.trigger.delivery_expected",
  delivery_logged: "activity.trigger.delivery_logged",
  invoice_discrepancy_detected: "activity.trigger.invoice_discrepancy_detected",
  waste_analysis_completed: "activity.trigger.waste_analysis_completed",
  staff_schedule_analyzed: "activity.trigger.staff_schedule_analyzed",
  staffing_gap_detected: "activity.trigger.staffing_gap_detected",
  pos_sync_completed: "activity.trigger.pos_sync_completed",
  reservation_forecast_updated: "activity.trigger.reservation_forecast_updated",
  customer_review_trend_detected: "activity.trigger.customer_review_trend_detected",
  menu_item_performance_analyzed: "activity.trigger.menu_item_performance_analyzed",
  task_created: "activity.trigger.task_created",
  task_completed: "activity.trigger.task_completed",
  task_reopened: "activity.trigger.task_reopened",
  task_unblocked: "activity.trigger.task_unblocked",
  automation_failed: "activity.trigger.automation_failed",
  approval_required: "activity.trigger.approval_required",
  recommendation_created: "activity.trigger.recommendation_created",
  recommendation_dismissed: "activity.trigger.recommendation_dismissed",
  recommendation_outcome_measured: "activity.trigger.recommendation_outcome_measured",
  restaurant_memory_updated: "activity.trigger.restaurant_memory_updated",
  inventory_count_recorded: "activity.trigger.inventory_count_recorded"
} as const satisfies Record<string, MessageKey>;

/**
 * Category chip on the Activity hub meta line.
 * Keep this exhaustive: raw English enums must not leak into ES/zh-Hans.
 */
export function activityCategoryLabelKey(category: ActivityCategory): MessageKey {
  switch (category) {
    case "inventory":
      return "activity.category.inventory";
    case "orders":
      return "activity.category.orders";
    case "sales":
      return "activity.category.sales";
    case "team":
      return "activity.category.team";
    case "tasks":
      return "activity.category.tasks";
    case "waste":
      return "activity.category.waste";
    case "approvals":
      return "activity.category.approvals";
    case "integrations":
      return "activity.category.integrations";
    case "memory":
      return "activity.category.memory";
    case "system":
      return "activity.category.system";
  }
}

/**
 * Status chip on the Activity hub meta line.
 */
export function activityStatusLabelKey(status: ActivityStatus): MessageKey {
  switch (status) {
    case "monitoring":
      return "activity.status.monitoring";
    case "prepared":
      return "activity.status.prepared";
    case "waiting_for_approval":
      return "activity.status.waiting_for_approval";
    case "scheduled":
      return "activity.status.scheduled";
    case "sent":
      return "activity.status.sent";
    case "confirmed":
      return "activity.status.confirmed";
    case "completed":
      return "activity.status.completed";
    case "failed":
      return "activity.status.failed";
    case "could_not_verify":
      return "activity.status.could_not_verify";
    case "partially_completed":
      return "activity.status.partially_completed";
    case "cancelled":
      return "activity.status.cancelled";
    case "reversed":
      return "activity.status.reversed";
  }
}

export function activityRelatedEntityLabelKey(entityType: ActivityRelatedEntityType): MessageKey {
  switch (entityType) {
    case "inventory_item":
      return "activity.related.inventory_item";
    case "purchase_recommendation":
      return "activity.related.purchase_recommendation";
    case "supplier_order":
      return "activity.related.supplier_order";
    case "supplier":
      return "activity.related.supplier";
    case "menu_item":
      return "activity.related.menu_item";
    case "employee":
      return "activity.related.employee";
    case "shift":
      return "activity.related.shift";
    case "task":
      return "activity.related.task";
    case "restaurant_task":
      return "activity.related.restaurant_task";
    case "finding":
      return "activity.related.finding";
    case "memory":
      return "activity.related.memory";
    case "mise_action":
      return "activity.related.mise_action";
    case "pos_import":
      return "activity.related.pos_import";
    case "recalculation_run":
      return "activity.related.recalculation_run";
  }
}

export function activityCategoryLabel(category: ActivityCategory, t: Translate): string {
  return t(activityCategoryLabelKey(category));
}

export function activityStatusLabel(status: ActivityStatus, t: Translate): string {
  return t(activityStatusLabelKey(status));
}

export function activityRelatedEntityLabel(
  entityType: ActivityRelatedEntityType,
  t: Translate
): string {
  return t(activityRelatedEntityLabelKey(entityType));
}

/**
 * Trigger tokens are partly free-form (legacy rows + activityType mirrors).
 * Known tokens localize; unknowns stay humanized so opaque IDs remain readable.
 */
export function activityTriggerLabel(triggerType: string, t: Translate): string {
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_TRIGGER_KEYS, triggerType)) {
    return t(ACTIVITY_TRIGGER_KEYS[triggerType as keyof typeof ACTIVITY_TRIGGER_KEYS]);
  }
  return humanizeActivityToken(triggerType);
}

export function activityEvidenceTypeLabel(evidenceType: string, t: Translate): string {
  const relatedKey = relatedEntityKeyFromToken(evidenceType);
  if (relatedKey) return t(relatedKey);
  if (Object.prototype.hasOwnProperty.call(ACTIVITY_TRIGGER_KEYS, evidenceType)) {
    return t(ACTIVITY_TRIGGER_KEYS[evidenceType as keyof typeof ACTIVITY_TRIGGER_KEYS]);
  }
  return humanizeActivityToken(evidenceType);
}

function relatedEntityKeyFromToken(token: string): MessageKey | null {
  switch (token) {
    case "inventory_item":
      return "activity.related.inventory_item";
    case "purchase_recommendation":
      return "activity.related.purchase_recommendation";
    case "supplier_order":
      return "activity.related.supplier_order";
    case "supplier":
      return "activity.related.supplier";
    case "menu_item":
      return "activity.related.menu_item";
    case "employee":
      return "activity.related.employee";
    case "shift":
      return "activity.related.shift";
    case "task":
      return "activity.related.task";
    case "restaurant_task":
      return "activity.related.restaurant_task";
    case "finding":
      return "activity.related.finding";
    case "memory":
      return "activity.related.memory";
    case "mise_action":
      return "activity.related.mise_action";
    case "pos_import":
      return "activity.related.pos_import";
    case "recalculation_run":
      return "activity.related.recalculation_run";
    default:
      return null;
  }
}

export function humanizeActivityToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/_/g, " ");
}
