import type { Outcome } from "./miseActions";
import type { SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryRecord } from "./supplierReliability";

export type DeliveryOutcomeKind =
  | "matched"
  | "discrepancy"
  | "partial"
  | "failed"
  | "unverified"
  | "unknown";

export type DeliveryOutcomeLessonCode = "matched" | "review_reliability" | "custom";

export type DeliveryOutcomeStatusFilter = "all" | "attention";

export interface PersistedActionOutcomeRow {
  id: string;
  restaurant_id: string;
  action_id: string;
  expected_result: Record<string, unknown> | null;
  actual_result: Record<string, unknown> | null;
  variance?: Record<string, unknown> | null;
  measured_at: string;
  lesson?: string | null;
  idempotency_key?: string | null;
  created_at?: string | null;
}

/** Operator-facing supplier-delivery lesson joined from append-only outcomes. */
export interface SupplierDeliveryOutcomeView {
  id: string;
  restaurantId: string;
  actionId: string;
  deliveryId: string | null;
  supplierOrderId: string | null;
  supplierName: string | null;
  kind: DeliveryOutcomeKind;
  lessonCode: DeliveryOutcomeLessonCode;
  lessonText: string | null;
  lineCount: number | null;
  measuredAt: string;
}

const MATCHED_LESSONS = new Set([
  "The supplier order was received as expected."
]);

const REVIEW_LESSONS = new Set([
  "Review this supplier outcome before adjusting reliability.",
  "Review this supplier outcome before using it to adjust supplier reliability."
]);

function requireRestaurantId(value: string): string {
  const restaurantId = value.trim();
  if (!restaurantId) throw new Error("Action outcomes require a restaurant workspace.");
  return restaurantId;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function actionOutcomeFromPersistedRow(row: PersistedActionOutcomeRow): Outcome {
  const restaurantId = requireRestaurantId(row.restaurant_id);
  const actionId = readString(row.action_id);
  if (!actionId) throw new Error("Action outcomes require an action id.");
  const measuredAt = new Date(row.measured_at);
  if (!Number.isFinite(measuredAt.getTime())) {
    throw new Error("Action outcomes require a measured timestamp.");
  }
  return {
    id: row.id,
    actionId,
    restaurantId,
    expectedResult: asObject(row.expected_result),
    actualResult: asObject(row.actual_result),
    variance: asObject(row.variance),
    measuredAt: measuredAt.toISOString(),
    lesson: readString(row.lesson)
  };
}

export function isSupplierDeliveryOutcome(outcome: Outcome): boolean {
  return Boolean(readString(outcome.actualResult.deliveryId));
}

export function deliveryOutcomeKind(outcome: Outcome): DeliveryOutcomeKind {
  const status = readString(outcome.actualResult.deliveryStatus)?.toLowerCase() ?? null;
  if (status === "received") return "matched";
  if (status === "discrepancy") return "discrepancy";
  if (status === "partially_received") return "partial";
  if (status === "failed") return "failed";
  if (status === "unverified") return "unverified";

  const matched = readBoolean(outcome.variance.deliveryStatusMatched);
  if (matched === true) return "matched";
  if (matched === false) {
    if (readBoolean(outcome.variance.hasPartialReceipt) === true) return "partial";
    if (readBoolean(outcome.variance.hasDiscrepancy) === true) return "discrepancy";
  }
  return "unknown";
}

export function deliveryOutcomeLessonCode(outcome: Outcome): DeliveryOutcomeLessonCode {
  const lesson = outcome.lesson?.trim() ?? "";
  if (!lesson) {
    const kind = deliveryOutcomeKind(outcome);
    return kind === "matched" ? "matched" : "review_reliability";
  }
  if (MATCHED_LESSONS.has(lesson)) return "matched";
  if (REVIEW_LESSONS.has(lesson)) return "review_reliability";
  return "custom";
}

export function assertActionOutcomesTenant(
  restaurantId: string,
  outcomes: readonly Outcome[]
): void {
  const normalized = requireRestaurantId(restaurantId);
  if (outcomes.some((outcome) => outcome.restaurantId !== normalized)) {
    throw new Error("Action outcomes failed restaurant scope validation.");
  }
}

export function buildSupplierDeliveryOutcomeViews(input: {
  restaurantId: string;
  outcomes: readonly Outcome[];
  deliveries: readonly SupplierDeliveryRecord[];
  orders: readonly SupplierOrder[];
}): SupplierDeliveryOutcomeView[] {
  const restaurantId = requireRestaurantId(input.restaurantId);
  assertActionOutcomesTenant(restaurantId, input.outcomes);
  if (input.deliveries.some((delivery) => delivery.restaurant_id !== restaurantId)) {
    throw new Error("Supplier deliveries failed restaurant scope validation.");
  }
  if (input.orders.some((order) => order.restaurant_id !== restaurantId)) {
    throw new Error("Supplier orders failed restaurant scope validation.");
  }

  const deliveriesById = new Map(input.deliveries.map((delivery) => [delivery.id, delivery]));
  const ordersById = new Map(input.orders.map((order) => [order.id, order]));

  return input.outcomes
    .filter(isSupplierDeliveryOutcome)
    .map((outcome) => {
      const deliveryId = readString(outcome.actualResult.deliveryId);
      const delivery = deliveryId ? deliveriesById.get(deliveryId) ?? null : null;
      const order = delivery ? ordersById.get(delivery.supplier_order_id) ?? null : null;
      const lessonCode = deliveryOutcomeLessonCode(outcome);
      return {
        id: outcome.id,
        restaurantId,
        actionId: outcome.actionId,
        deliveryId,
        supplierOrderId: delivery?.supplier_order_id ?? null,
        supplierName: order?.supplier_name?.trim() || null,
        kind: deliveryOutcomeKind(outcome),
        lessonCode,
        lessonText: lessonCode === "custom" ? outcome.lesson : null,
        lineCount: readFiniteNumber(outcome.actualResult.lineCount),
        measuredAt: outcome.measuredAt
      } satisfies SupplierDeliveryOutcomeView;
    })
    .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt));
}

export function filterSupplierDeliveryOutcomeViews(
  views: readonly SupplierDeliveryOutcomeView[],
  filter: DeliveryOutcomeStatusFilter
): SupplierDeliveryOutcomeView[] {
  if (filter === "all") return [...views];
  return views.filter((view) => view.kind !== "matched" && view.kind !== "unknown");
}

export function outcomeLessonForDelivery(
  outcomes: readonly Outcome[],
  deliveryId: string
): { lessonCode: DeliveryOutcomeLessonCode; lessonText: string | null; kind: DeliveryOutcomeKind } | null {
  const normalizedDeliveryId = deliveryId.trim();
  if (!normalizedDeliveryId) return null;
  const match = outcomes.find(
    (outcome) => readString(outcome.actualResult.deliveryId) === normalizedDeliveryId
  );
  if (!match) return null;
  const lessonCode = deliveryOutcomeLessonCode(match);
  return {
    lessonCode,
    lessonText: lessonCode === "custom" ? match.lesson : null,
    kind: deliveryOutcomeKind(match)
  };
}
