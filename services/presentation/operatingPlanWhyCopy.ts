import { translate, type AppLocale } from "../../i18n/catalog";
import { formatLocalizedDate } from "../../i18n/formatters";
import type { OperatingPlanItem } from "../domain/operatingPlan";

/**
 * Locale-aware operating-plan why copy.
 *
 * Builds from structured order delivery dates on the Today-task presentation
 * descriptor so durable English `OperatingPlanItem.why` can stay audit-stable.
 * Freeform recommendation reasons and operator-authored copy remain evidence.
 */
export function presentOperatingPlanWhy(
  locale: AppLocale,
  item: Pick<OperatingPlanItem, "why" | "sourceTask">,
  localizedDetail?: string
): string {
  const task = item.sourceTask;
  const descriptor = task?.presentation;
  if (descriptor) {
    const { code, values } = descriptor;
    if (
      (code === "today.order.send" || code === "today.order.review") &&
      values.deliveryDate
    ) {
      const english = englishDeliveryScheduledWhy(values.deliveryDate);
      if (item.why === english) {
        return translate(locale, "today.plan.whyBody.deliveryScheduled", {
          date: formatDeliveryDate(locale, values.deliveryDate)
        });
      }
    }
  }

  // When why is the English task detail and presentation already localized the
  // detail, reuse that copy instead of freezing the durable English string.
  if (task && item.why === task.detail && localizedDetail && localizedDetail !== task.detail) {
    return localizedDetail;
  }

  return item.why;
}

export function englishDeliveryScheduledWhy(deliveryDate: string): string {
  return `Supplier delivery is scheduled for ${deliveryDate}.`;
}

function formatDeliveryDate(locale: AppLocale, deliveryDate: string): string {
  // Date-only keys are noon-anchored in UTC so the calendar day does not shift
  // when the restaurant timezone is west of UTC.
  return formatLocalizedDate(locale, `${deliveryDate}T12:00:00.000Z`, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
