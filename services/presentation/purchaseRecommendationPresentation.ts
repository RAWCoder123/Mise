import { formatLocalizedNumber } from "../../i18n/formatters";
import { translate, type AppLocale } from "../../i18n/catalog";
import type { PurchaseRecommendation, Urgency } from "../../types/mise";
import type { PurchaseRecommendationPresentationDescriptor } from "../../types/presentation";

type RecommendationReasonSource = Pick<
  PurchaseRecommendation,
  | "item_name"
  | "recommended_quantity"
  | "unit"
  | "supplier_name"
  | "urgency"
  | "reason"
  | "presentation"
>;

function formatQuantity(locale: AppLocale, value: number) {
  return formatLocalizedNumber(locale, value, { maximumFractionDigits: 3 });
}

function statusFromUrgency(urgency: Urgency): "Low" | "Critical" {
  return urgency === "high" ? "Critical" : "Low";
}

/**
 * Prefer a durable presentation descriptor. When hosted storage strips it,
 * synthesize from structured recommendation fields so ES/zh-Hans operators
 * never see a frozen English reason on Orders/Home.
 */
export function purchaseRecommendationReasonDescriptor(
  recommendation: RecommendationReasonSource
): PurchaseRecommendationPresentationDescriptor {
  if (recommendation.presentation) return recommendation.presentation;
  const rawReason = recommendation.reason?.trim();
  if (rawReason && !recommendation.item_name?.trim()) {
    return { code: "purchase.recommendation.opaque", values: { rawReason } };
  }
  return {
    code: "purchase.recommendation.stock_risk",
    values: {
      itemName: recommendation.item_name,
      suggestedOrderQuantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      supplierName: recommendation.supplier_name,
      status: statusFromUrgency(recommendation.urgency),
      learnedQuantity: null
    }
  };
}

export function presentPurchaseRecommendationReason(
  locale: AppLocale,
  recommendation: RecommendationReasonSource
): string {
  const descriptor = purchaseRecommendationReasonDescriptor(recommendation);
  if (descriptor.code === "purchase.recommendation.opaque") {
    return descriptor.values.rawReason;
  }

  const { values } = descriptor;
  const quantity = formatQuantity(locale, values.suggestedOrderQuantity);
  const baseKey =
    values.status === "Critical"
      ? "orders.recommendation.reason.critical"
      : "orders.recommendation.reason.low";
  const base = translate(locale, baseKey, {
    item: values.itemName,
    quantity,
    unit: values.unit,
    supplier: values.supplierName
  });
  if (values.learnedQuantity == null) return base;
  return (
    base +
    " " +
    translate(locale, "orders.recommendation.reason.learned", {
      learned: formatQuantity(locale, values.learnedQuantity),
      unit: values.unit
    })
  );
}
