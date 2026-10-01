import { formatLocalizedNumber } from "../../i18n/formatters";
import { translate, type AppLocale, type MessageKey } from "../../i18n/catalog";
import type { ActivityEvent, ActivityType } from "../domain/activityEvents";

type ActivityCopySource = Pick<
  ActivityEvent,
  "activityType" | "title" | "summary" | "metadata" | "errorMessage"
>;

function metaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function metaNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function metaBoolean(metadata: Record<string, unknown>, key: string): boolean {
  return metadata[key] === true;
}

function formatQuantity(locale: AppLocale, value: number): string {
  return formatLocalizedNumber(locale, value, { maximumFractionDigits: 3 });
}

function cycleLabel(locale: AppLocale, cycle: string): string {
  switch (cycle) {
    case "daily_open":
      return translate(locale, "activity.cycle.daily_open");
    case "mid_shift":
      return translate(locale, "activity.cycle.mid_shift");
    case "close":
      return translate(locale, "activity.cycle.close");
    default:
      return cycle.replace(/_/g, " ");
  }
}

const ACTIVITY_TITLE_KEYS = {
  forecast_updated: "activity.title.forecast_updated",
  prep_plan_updated: "activity.title.prep_plan_updated",
  inventory_risk_detected: "activity.title.inventory_risk_detected",
  physical_count_requested: "activity.title.physical_count_requested",
  supplier_prices_checked: "activity.title.supplier_prices_checked",
  order_prepared: "activity.title.order_prepared",
  order_approved: "activity.title.order_approved",
  order_sent: "activity.title.order_sent",
  supplier_confirmation_received: "activity.title.supplier_confirmation_received",
  delivery_expected: "activity.title.delivery_expected",
  delivery_logged: "activity.title.delivery_logged",
  invoice_discrepancy_detected: "activity.title.invoice_discrepancy_detected",
  waste_analysis_completed: "activity.title.waste_recorded",
  staff_schedule_analyzed: "activity.title.staff_schedule_analyzed",
  staffing_gap_detected: "activity.title.staffing_gap_detected",
  pos_sync_completed: "activity.title.pos_sync_completed",
  reservation_forecast_updated: "activity.title.reservation_forecast_updated",
  customer_review_trend_detected: "activity.title.customer_review_trend_detected",
  menu_item_performance_analyzed: "activity.title.menu_item_performance_analyzed",
  task_created: "activity.title.task_created",
  task_completed: "activity.title.task_completed",
  task_reopened: "activity.title.task_reopened",
  task_unblocked: "activity.title.task_unblocked",
  automation_failed: "activity.title.automation_failed",
  approval_required: "activity.title.approval_required",
  recommendation_created: "activity.title.recommendation_created",
  recommendation_dismissed: "activity.title.recommendation_dismissed",
  recommendation_outcome_measured: "activity.title.recommendation_outcome_measured",
  restaurant_memory_updated: "activity.title.restaurant_memory_updated",
  inventory_count_recorded: "activity.title.inventory_count_recorded"
} as const satisfies Record<ActivityType, MessageKey>;

/**
 * Locale-aware activity title. Prefer structured activityType (+ metadata
 * variants); fall back to the durable English title when the type is opaque
 * free-form copy (findings, custom task titles).
 */
export function presentActivityTitle(locale: AppLocale, event: ActivityCopySource): string {
  const { activityType, metadata, title } = event;

  if (activityType === "waste_analysis_completed" && metaBoolean(metadata, "repeatedRecently")) {
    return translate(locale, "activity.title.waste_pattern");
  }

  if (activityType === "forecast_updated" && metaString(metadata, "cycle")) {
    return translate(locale, "activity.title.opening_recalculation");
  }

  if (
    activityType === "inventory_risk_detected" ||
    activityType === "menu_item_performance_analyzed"
  ) {
    // Operational findings store free-form English titles; only synthesize the
    // fixed inventory-risk title when structured item projection metadata exists.
    if (
      activityType === "inventory_risk_detected" &&
      metaString(metadata, "itemName") &&
      metaNumber(metadata, "projectedQuantity") != null
    ) {
      return translate(locale, ACTIVITY_TITLE_KEYS.inventory_risk_detected);
    }
    return title;
  }

  if (
    activityType === "task_created" ||
    activityType === "task_completed" ||
    activityType === "task_reopened" ||
    activityType === "task_unblocked"
  ) {
    // Task builders pass operator-facing titles that may already be localized
    // or restaurant-specific; keep the durable string.
    return title;
  }

  return translate(locale, ACTIVITY_TITLE_KEYS[activityType]);
}

/**
 * Locale-aware activity summary. Synthesize from structured metadata when
 * present so historical English rows still localize; otherwise keep the
 * durable English summary (audit / opaque finding copy).
 */
export function presentActivitySummary(locale: AppLocale, event: ActivityCopySource): string {
  const { activityType, metadata, summary, errorMessage } = event;
  const itemName = metaString(metadata, "itemName");
  const supplierName = metaString(metadata, "supplierName");
  const unit = metaString(metadata, "unit");
  const quantity = metaNumber(metadata, "quantity");
  const quantityReceived = metaNumber(metadata, "quantityReceived");
  const projectedQuantity = metaNumber(metadata, "projectedQuantity");
  const itemCount = metaNumber(metadata, "itemCount");
  const recordsProcessed = metaNumber(metadata, "recordsProcessed");
  const provider = metaString(metadata, "provider");
  const canonicalUnit = metaString(metadata, "canonicalUnit");
  const cycle = metaString(metadata, "cycle");
  const attempt = metaNumber(metadata, "attempt");
  const operatingDate = metaString(metadata, "operatingDate");
  const itemsSold = metaNumber(metadata, "itemsSold");
  const deltaPercent = metaNumber(metadata, "deltaPercent");

  switch (activityType) {
    case "approval_required": {
      if (itemName && unit && quantity != null) {
        return translate(locale, "activity.summary.approval_required", {
          quantity: formatQuantity(locale, quantity),
          unit,
          itemName
        });
      }
      break;
    }
    case "recommendation_created": {
      if (itemName) {
        return translate(locale, "activity.summary.recommendation_created", { itemName });
      }
      break;
    }
    case "order_approved": {
      if (itemName && unit && quantity != null) {
        return translate(locale, "activity.summary.order_approved", {
          itemName,
          quantity: formatQuantity(locale, quantity),
          unit
        });
      }
      break;
    }
    case "recommendation_dismissed": {
      if (itemName) {
        return translate(locale, "activity.summary.recommendation_dismissed", { itemName });
      }
      break;
    }
    case "order_prepared": {
      if (supplierName && itemCount != null && itemCount > 0) {
        return translate(
          locale,
          itemCount === 1
            ? "activity.summary.order_prepared.count.one"
            : "activity.summary.order_prepared.count.other",
          {
            supplierName,
            count: formatLocalizedNumber(locale, itemCount)
          }
        );
      }
      if (supplierName) {
        return translate(locale, "activity.summary.order_prepared", { supplierName });
      }
      break;
    }
    case "order_sent": {
      if (supplierName) {
        return translate(locale, "activity.summary.order_sent", { supplierName });
      }
      break;
    }
    case "inventory_count_recorded": {
      if (itemName && unit && quantity != null) {
        return translate(locale, "activity.summary.inventory_count_recorded", {
          itemName,
          quantity: formatQuantity(locale, quantity),
          unit
        });
      }
      break;
    }
    case "delivery_logged": {
      if (itemName && unit && quantityReceived != null) {
        return translate(locale, "activity.summary.delivery_logged", {
          quantity: formatQuantity(locale, quantityReceived),
          unit,
          itemName
        });
      }
      break;
    }
    case "waste_analysis_completed": {
      if (itemName && canonicalUnit && quantity != null) {
        return translate(locale, "activity.summary.waste_recorded", {
          quantity: formatQuantity(locale, quantity),
          unit: canonicalUnit,
          itemName
        });
      }
      break;
    }
    case "pos_sync_completed": {
      if (recordsProcessed != null) {
        const countKey =
          recordsProcessed === 1
            ? "activity.summary.pos_sync.one"
            : "activity.summary.pos_sync.other";
        if (provider) {
          return translate(
            locale,
            recordsProcessed === 1
              ? "activity.summary.pos_sync.provider.one"
              : "activity.summary.pos_sync.provider.other",
            {
              count: formatLocalizedNumber(locale, recordsProcessed),
              provider
            }
          );
        }
        return translate(locale, countKey, {
          count: formatLocalizedNumber(locale, recordsProcessed)
        });
      }
      break;
    }
    case "forecast_updated": {
      if (cycle) {
        return translate(locale, "activity.summary.opening_recalculation");
      }
      if (deltaPercent != null) {
        const abs = Math.abs(deltaPercent);
        return translate(
          locale,
          deltaPercent >= 0
            ? "activity.summary.forecast_updated.higher"
            : "activity.summary.forecast_updated.lower",
          { percent: formatLocalizedNumber(locale, abs) }
        );
      }
      if (operatingDate && itemsSold != null) {
        return translate(locale, "activity.summary.forecast_updated.refresh", {
          count: formatLocalizedNumber(locale, itemsSold),
          date: operatingDate
        });
      }
      break;
    }
    case "automation_failed": {
      if (cycle && attempt != null) {
        const detail =
          (errorMessage && errorMessage.trim()) ||
          translate(locale, "activity.summary.automation_failed.no_reason");
        return translate(locale, "activity.summary.automation_failed", {
          attempt: formatLocalizedNumber(locale, attempt),
          cycle: cycleLabel(locale, cycle),
          detail
        });
      }
      break;
    }
    case "inventory_risk_detected": {
      if (itemName && unit && projectedQuantity != null) {
        return translate(locale, "activity.summary.inventory_risk", {
          itemName,
          quantity: formatQuantity(locale, projectedQuantity),
          unit
        });
      }
      break;
    }
    case "restaurant_memory_updated": {
      return translate(locale, "activity.summary.restaurant_memory_updated");
    }
    default:
      break;
  }

  return summary;
}
