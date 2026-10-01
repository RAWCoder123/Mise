import { translate, type AppLocale, type MessageKey } from "../../i18n/catalog";
import type { OperatingPlanItem } from "../domain/operatingPlan";
import type { OperationalTodayTaskActionIntent } from "../domain/todayTasks";

/**
 * Locale-aware operating-plan effect copy.
 *
 * Builds from structured action intent / shared-task origin so durable English
 * `OperatingPlanItem.effect` can stay audit-stable. Does not invent effects.
 */
export function presentOperatingPlanEffect(
  locale: AppLocale,
  item: Pick<OperatingPlanItem, "effect" | "sourceTask" | "sourceRestaurantTask">
): string {
  if (item.sourceRestaurantTask) {
    return translate(locale, "today.plan.effectBody.sharedTask");
  }

  const task = item.sourceTask;
  if (!task) {
    return item.effect;
  }

  const key = effectBodyKeyForIntent(task.action.intent, task.source.status);
  if (!key) {
    // Operator-authored or unstructured detail remains as evidence-only English.
    return item.effect;
  }

  return translate(locale, key);
}

function effectBodyKeyForIntent(
  intent: OperationalTodayTaskActionIntent,
  sourceStatus: string
): MessageKey | null {
  if (
    intent === "update_inventory_count" ||
    intent === "begin_inventory_count_session" ||
    intent === "continue_inventory_count_session"
  ) {
    return "today.plan.effectBody.count";
  }
  if (intent === "review_recommendation") {
    return "today.plan.effectBody.reviewRecommendation";
  }
  if (intent === "prepare_supplier_draft") {
    return "today.plan.effectBody.prepareDraft";
  }
  if (intent === "send_supplier_order") {
    return sourceStatus === "draft"
      ? "today.plan.effectBody.sendDraft"
      : "today.plan.effectBody.followDelivery";
  }
  if (intent === "finish_setup") {
    return "today.plan.effectBody.finishSetup";
  }
  if (
    intent === "connect_pos" ||
    intent === "manage_pos_connection" ||
    intent === "repair_pos_connection"
  ) {
    return "today.plan.effectBody.posFreshness";
  }
  if (intent === "review_insight") {
    return "today.plan.effectBody.reviewInsight";
  }
  // open_restaurant_task and any future unstructured intents keep durable effect.
  return null;
}
