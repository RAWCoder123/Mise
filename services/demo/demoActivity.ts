import {
  activityIdempotencyKey,
  fromInventoryWasteRecorded,
  fromPurchaseRecommendationApproved,
  fromPurchaseRecommendationCreated,
  fromPurchaseRecommendationDismissed,
  fromSupplierOrderDrafted,
  fromPurchaseLinesRecorded,
  fromSupplierOrderSent,
  type ActivityEvent
} from "../domain/activityEvents";
import type { PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import { addDaysToDateKey, toDateKeyInTimeZone } from "../../utils/format";
import type { DemoState } from "./replaceableDemoData";

function upsertActivity(state: DemoState, event: ActivityEvent) {
  if (!Array.isArray(state.activityEvents)) state.activityEvents = [];
  const key = activityIdempotencyKey(event);
  const existingIndex = state.activityEvents.findIndex(
    (entry) =>
      entry.restaurantId === event.restaurantId && activityIdempotencyKey(entry) === key
  );
  if (existingIndex >= 0) {
    state.activityEvents[existingIndex] = {
      ...event,
      id: state.activityEvents[existingIndex]!.id
    };
    return state.activityEvents[existingIndex]!;
  }
  state.activityEvents.push(event);
  return event;
}

export function appendDemoRecommendationActivity(
  state: DemoState,
  recommendation: PurchaseRecommendation,
  previousStatus?: PurchaseRecommendation["status"] | null
) {
  if (!previousStatus) {
    return upsertActivity(state, fromPurchaseRecommendationCreated(recommendation, {
      sequenceId: `inventory-order:${recommendation.inventory_item_id}`
    }));
  }
  if (previousStatus === recommendation.status) return null;
  if (recommendation.status === "approved") {
    return upsertActivity(
      state,
      fromPurchaseRecommendationApproved(recommendation, {
        occurredAt: new Date().toISOString(),
        sequenceId: `inventory-order:${recommendation.inventory_item_id}`
      })
    );
  }
  if (recommendation.status === "dismissed") {
    return upsertActivity(
      state,
      fromPurchaseRecommendationDismissed(recommendation, {
        occurredAt: new Date().toISOString(),
        sequenceId: `inventory-order:${recommendation.inventory_item_id}`
      })
    );
  }
  if (recommendation.status === "ordered") {
    return upsertActivity(
      state,
      fromPurchaseRecommendationApproved(recommendation, {
        occurredAt: new Date().toISOString(),
        sequenceId: `inventory-order:${recommendation.inventory_item_id}`
      })
    );
  }
  return null;
}

export function appendDemoSupplierOrderActivity(
  state: DemoState,
  order: SupplierOrder,
  options: { previousStatus?: SupplierOrder["status"] | null; itemCount?: number } = {}
) {
  if (!options.previousStatus) {
    return upsertActivity(
      state,
      fromSupplierOrderDrafted(order, {
        itemCount: options.itemCount,
        sequenceId: `supplier-order:${order.id}`
      })
    );
  }
  if (options.previousStatus !== order.status && order.status === "sent") {
    return upsertActivity(
      state,
      fromSupplierOrderSent(order, {
        occurredAt: new Date().toISOString(),
        sequenceId: `supplier-order:${order.id}`
      })
    );
  }
  return null;
}

export function seedDemoActivityFromState(state: DemoState) {
  if (!Array.isArray(state.activityEvents)) state.activityEvents = [];
  const shouldSeedExistingOperationalActivity = state.activityEvents.length === 0;
  const restaurantTimeZones = new Map(
    state.restaurants.map((restaurant) => [restaurant.id, restaurant.timezone])
  );
  const wasteEvents = (state.inventoryEvents ?? [])
    .filter((event) => event.eventType === "waste")
    .sort(
      (left, right) =>
        left.effectiveAt.localeCompare(right.effectiveAt) || left.sequence - right.sequence
    );

  // Schema upgrades can add an inventory ledger to demo states that already
  // have other activity. Upsert every historical waste event independently so
  // the activity trail never depends on whether that older activity existed.
  for (const event of wasteEvents) {
    const item = state.inventoryItems.find(
      (entry) =>
        entry.restaurant_id === event.restaurantId && entry.id === event.inventoryItemId
    );
    if (!item) continue;
    const timeZone = restaurantTimeZones.get(event.restaurantId) ?? "UTC";
    const eventDate = toDateKeyInTimeZone(new Date(event.effectiveAt), timeZone);
    const windowStart = addDaysToDateKey(eventDate, -6);
    const distinctWasteDays = new Set(
      wasteEvents
        .filter(
          (candidate) =>
            candidate.restaurantId === event.restaurantId &&
            candidate.inventoryItemId === event.inventoryItemId &&
            candidate.effectiveAt <= event.effectiveAt
        )
        .map((candidate) =>
          toDateKeyInTimeZone(new Date(candidate.effectiveAt), timeZone)
        )
        .filter((date) => date >= windowStart && date <= eventDate)
    );
    upsertActivity(
      state,
      fromInventoryWasteRecorded(item, {
        occurredAt: event.effectiveAt,
        quantity: event.quantity,
        canonicalUnit: event.canonicalUnit,
        repeatedRecently: distinctWasteDays.size >= 2,
        eventId: event.id,
        sequenceId: `inventory-item:${event.inventoryItemId}`
      })
    );
  }

  if (!shouldSeedExistingOperationalActivity) return;

  for (const recommendation of state.purchaseRecommendations) {
    appendDemoRecommendationActivity(state, recommendation, null);
    if (recommendation.status === "approved" || recommendation.status === "ordered") {
      appendDemoRecommendationActivity(state, recommendation, "pending");
    }
    if (recommendation.status === "dismissed") {
      appendDemoRecommendationActivity(state, recommendation, "pending");
    }
  }
  for (const order of state.supplierOrders) {
    appendDemoSupplierOrderActivity(state, order, { previousStatus: null });
    if (order.status === "sent" || order.status === "completed") {
      appendDemoSupplierOrderActivity(state, { ...order, status: "sent" }, {
        previousStatus: "draft"
      });
    }
  }
}

export function appendDemoPurchaseLineActivity(
  state: DemoState,
  input: Parameters<typeof fromPurchaseLinesRecorded>[0]
) {
  return upsertActivity(state, fromPurchaseLinesRecorded(input)).id;
}
