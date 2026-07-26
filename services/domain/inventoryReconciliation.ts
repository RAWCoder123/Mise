import {
  projectInventoryEvents,
  type InventoryEvent,
  type InventoryProjection
} from "./inventoryLedger";

export interface InventoryReconciliationThresholds {
  absoluteQuantity: number;
  percentage: number;
  percentageFloorQuantity: number;
}

export type InventoryReconciliation =
  | {
      status: "aligned" | "material_variance";
      restaurantId: string;
      inventoryItemId: string;
      countEventId: string;
      expectedQuantity: number;
      observedQuantity: number;
      varianceQuantity: number;
      variancePercentage: number;
      projection: InventoryProjection;
    }
  | {
      status: "blocked";
      restaurantId: string;
      inventoryItemId: string;
      countEventId: string;
      reasons: string[];
    };

export function reconcileInventoryCount(input: {
  events: readonly InventoryEvent[];
  countEventId: string;
  thresholds: InventoryReconciliationThresholds;
}): InventoryReconciliation {
  validateThresholds(input.thresholds);
  const count = input.events.find((event) => event.id === input.countEventId);
  if (!count) throw new Error("count_event_not_found");
  if (count.eventType !== "count") throw new Error("event_is_not_count");

  const scopedEvents = input.events.filter(
    (event) =>
      event.restaurantId === count.restaurantId &&
      event.inventoryItemId === count.inventoryItemId
  );
  const priorEvents = scopedEvents.filter((event) => event.sequence < count.sequence);
  const duplicateSequence = scopedEvents.some(
    (event) => event.id !== count.id && event.sequence === count.sequence
  );
  const laterEffectivePriorEvent = priorEvents.some(
    (event) => Date.parse(event.effectiveAt) > Date.parse(count.effectiveAt)
  );
  const projection = projectInventoryEvents(
    count.restaurantId,
    count.inventoryItemId,
    priorEvents
  );
  const reasons = [...projection.conflicts];
  if (priorEvents.length === 0) reasons.push("missing_prior_inventory_evidence");
  if (projection.canonicalUnit && projection.canonicalUnit !== count.canonicalUnit) {
    reasons.push("count_unit_mismatch");
  }
  if (duplicateSequence) reasons.push("duplicate_authoritative_sequence");
  if (laterEffectivePriorEvent) reasons.push("out_of_order_effective_time");

  if (reasons.length > 0) {
    return {
      status: "blocked",
      restaurantId: count.restaurantId,
      inventoryItemId: count.inventoryItemId,
      countEventId: count.id,
      reasons
    };
  }

  const varianceQuantity = count.quantity - projection.quantity;
  const percentageDenominator = Math.max(
    Math.abs(projection.quantity),
    input.thresholds.percentageFloorQuantity
  );
  const variancePercentage = Math.abs(varianceQuantity) / percentageDenominator;
  const material =
    Math.abs(varianceQuantity) >= input.thresholds.absoluteQuantity &&
    variancePercentage >= input.thresholds.percentage;

  return {
    status: material ? "material_variance" : "aligned",
    restaurantId: count.restaurantId,
    inventoryItemId: count.inventoryItemId,
    countEventId: count.id,
    expectedQuantity: projection.quantity,
    observedQuantity: count.quantity,
    varianceQuantity,
    variancePercentage,
    projection
  };
}

function validateThresholds(thresholds: InventoryReconciliationThresholds) {
  if (
    !Number.isFinite(thresholds.absoluteQuantity) ||
    thresholds.absoluteQuantity < 0 ||
    !Number.isFinite(thresholds.percentage) ||
    thresholds.percentage < 0 ||
    !Number.isFinite(thresholds.percentageFloorQuantity) ||
    thresholds.percentageFloorQuantity <= 0
  ) {
    throw new Error("invalid_reconciliation_thresholds");
  }
}
