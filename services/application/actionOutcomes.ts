import {
  assertActionOutcomesTenant,
  buildSupplierDeliveryOutcomeViews,
  countAttentionSupplierDeliveryOutcomes,
  outcomeLessonForDelivery,
  type DeliveryOutcomeStatusFilter,
  type SupplierDeliveryOutcomeView
} from "../domain/actionOutcomes";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { DeliveryOutcomeStatusFilter, SupplierDeliveryOutcomeView };

function requireWorkflowId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Missing ${label}.`);
  return normalized;
}

/**
 * Lightweight attention count for Insights/Daily Report CTAs.
 * Reads append-only outcomes only — no delivery/order join and no Memory mutation.
 */
export async function fetchAttentionSupplierDeliveryOutcomeCount(
  restaurantId: string,
  options: { limit?: number } = {}
): Promise<number> {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant workspace");
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const outcomes = await repository.listActionOutcomes(normalizedRestaurantId, { limit });
  assertActionOutcomesTenant(normalizedRestaurantId, outcomes);
  return countAttentionSupplierDeliveryOutcomes(outcomes);
}

/**
 * Read-only supplier-delivery lessons from append-only action_outcomes.
 * Joins delivery and order presentation fields without mutating Memory or orders.
 */
export async function fetchSupplierDeliveryOutcomes(
  restaurantId: string,
  options: { limit?: number } = {}
): Promise<SupplierDeliveryOutcomeView[]> {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant workspace");
  const limit = Math.min(Math.max(options.limit ?? 80, 1), 200);
  const [outcomes, history, orders] = await Promise.all([
    repository.listActionOutcomes(normalizedRestaurantId, { limit }),
    repository.fetchSupplierDeliveryHistory(normalizedRestaurantId),
    repository.fetchSupplierOrders(normalizedRestaurantId)
  ]);
  assertActionOutcomesTenant(normalizedRestaurantId, outcomes);
  return buildSupplierDeliveryOutcomeViews({
    restaurantId: normalizedRestaurantId,
    outcomes,
    deliveries: history.deliveries,
    orders
  });
}

export function mapOutcomesByDeliveryId(
  outcomes: Awaited<ReturnType<typeof repository.listActionOutcomes>>
): Map<
  string,
  {
    lessonCode: "matched" | "review_reliability" | "custom";
    lessonText: string | null;
    kind: "matched" | "discrepancy" | "partial" | "failed" | "unverified" | "unknown";
  }
> {
  const map = new Map<
    string,
    {
      lessonCode: "matched" | "review_reliability" | "custom";
      lessonText: string | null;
      kind: "matched" | "discrepancy" | "partial" | "failed" | "unverified" | "unknown";
    }
  >();
  for (const outcome of outcomes) {
    const deliveryId =
      typeof outcome.actualResult.deliveryId === "string"
        ? outcome.actualResult.deliveryId.trim()
        : "";
    if (!deliveryId || map.has(deliveryId)) continue;
    const lesson = outcomeLessonForDelivery([outcome], deliveryId);
    if (!lesson) continue;
    map.set(deliveryId, lesson);
  }
  return map;
}
