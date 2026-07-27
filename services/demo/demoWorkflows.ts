import type { SupplierOrder } from "../../types/mise";
import {
  boundedLearnedQuantity,
  buildInsightsFromData,
  buildInventoryOutlooks,
  buildLearnedOrderQuantities,
  buildSupplierOrderMessage,
  createId,
  learnedRecommendationReason,
  shouldSuppressRecommendationForItem,
  type RecommendationWorkflowResult,
  type SupplierOrderSentWorkflowResult
} from "../domain/miseDomain";
import { nextDateKeyInTimeZone, toDateKeyInTimeZone } from "../../utils/format";
import { demoDemandFallback } from "./demandFallback";
import { DEMO_RESTAURANT_TIME_ZONE, type DemoState } from "./replaceableDemoData";

function demoOperatingDate(state: DemoState, restaurantId: string) {
  const timeZone =
    state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ??
    DEMO_RESTAURANT_TIME_ZONE;
  return toDateKeyInTimeZone(new Date(), timeZone);
}

export function rebuildPurchaseRecommendations(state: DemoState, restaurantId: string) {
  const now = new Date().toISOString();
  const recommendationHistory = [...state.purchaseRecommendations];
  const learnedQuantities = buildLearnedOrderQuantities(restaurantId, recommendationHistory);
  const lowOutlooks = buildInventoryOutlooks(
    restaurantId,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(state, restaurantId),
    demoDemandFallback
  ).filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low");
  const lowItemIds = new Set(lowOutlooks.map(({ item }) => item.id));
  const kept = state.purchaseRecommendations.filter((recommendation) => {
    if (recommendation.restaurant_id !== restaurantId) return true;
    if (recommendation.status !== "pending") return true;
    return lowItemIds.has(recommendation.inventory_item_id);
  });

  lowOutlooks.forEach(({ item, prediction }) => {
    const pending = kept.find(
      (recommendation) =>
        recommendation.restaurant_id === restaurantId &&
        recommendation.inventory_item_id === item.id &&
        recommendation.status === "pending"
    );
    if (!pending && shouldSuppressRecommendationForItem(restaurantId, item, recommendationHistory)) return;

    const learnedQuantity = boundedLearnedQuantity(item, prediction, learnedQuantities);
    const recommendedQuantity = learnedQuantity ?? prediction.suggestedOrderQuantity;
    const reason = learnedRecommendationReason(item, prediction, learnedQuantity);

    if (pending) {
      pending.item_name = item.item_name;
      pending.supplier_name = item.supplier_name;
      pending.recommended_quantity = recommendedQuantity;
      pending.unit = item.unit;
      pending.reason = reason;
      pending.urgency = prediction.urgency;
      if (pending.created_at.localeCompare(item.last_updated) < 0) {
        pending.created_at = now;
      }
      return;
    }

    kept.push({
      id: createId("rec"),
      restaurant_id: restaurantId,
      inventory_item_id: item.id,
      item_name: item.item_name,
      supplier_name: item.supplier_name,
      recommended_quantity: recommendedQuantity,
      unit: item.unit,
      reason,
      urgency: prediction.urgency,
      status: "pending",
      supplier_order_id: null,
      created_at: now
    });
  });

  state.purchaseRecommendations = kept;
}

export function rebuildInsights(state: DemoState, restaurantId: string) {
  const generated = buildInsightsFromData(
    restaurantId,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(state, restaurantId),
    demoDemandFallback
  );
  state.insights = [
    ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
    ...generated
  ];
}

export function approveRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string,
  recommendedQuantity?: number
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "dismissed" || recommendation.status === "ordered") {
    throw new Error("Already handled.");
  }
  if (recommendation.status === "pending" && recommendedQuantity !== undefined) {
    if (
      !Number.isFinite(recommendedQuantity) ||
      recommendedQuantity <= 0 ||
      recommendedQuantity > 1_000_000
    ) {
      throw new Error("Enter a valid order quantity.");
    }
    recommendation.recommended_quantity = recommendedQuantity;
  }

  let order = recommendation.supplier_order_id
    ? state.supplierOrders.find(
        (entry) =>
          entry.id === recommendation.supplier_order_id &&
          entry.restaurant_id === restaurantId
      ) ?? null
    : null;
  if (order && order.status !== "draft") {
    throw new Error("Already handled.");
  }
  if (!order) {
    order = state.supplierOrders.find(
      (entry) =>
        entry.restaurant_id === restaurantId &&
        entry.supplier_name === recommendation.supplier_name &&
        entry.status === "draft"
    ) ?? null;
  }
  if (!order) {
    const timeZone =
      state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ??
      DEMO_RESTAURANT_TIME_ZONE;
    const now = new Date();
    order = {
      id: createId("order"),
      restaurant_id: restaurantId,
      supplier_name: recommendation.supplier_name,
      order_message: "",
      operator_note: null,
      status: "draft",
      delivery_date: nextDateKeyInTimeZone(now, timeZone),
      created_at: now.toISOString()
    };
    state.supplierOrders.push(order);
  }

  recommendation.status = "approved";
  recommendation.supplier_order_id = order.id;
  rebuildDemoDraftMessage(state, order);
  return {
    outcome: previousStatus === "approved" ? "already_applied" : "applied",
    recommendation,
    order,
    previousStatus
  };
}

export function dismissRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "approved" || recommendation.status === "ordered") {
    throw new Error("Already handled.");
  }
  if (recommendation.status === "pending") {
    recommendation.status = "dismissed";
    recommendation.supplier_order_id = null;
  }
  return {
    outcome: previousStatus === "dismissed" ? "already_applied" : "applied",
    recommendation,
    order: null,
    previousStatus
  };
}

export function undoRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "ordered") {
    throw new Error("This recommendation is already in supplier history and cannot be undone.");
  }
  if (recommendation.status === "pending") {
    return { outcome: "already_applied", recommendation, order: null, previousStatus };
  }
  const newerPending = state.purchaseRecommendations.find(
    (entry) =>
      entry.id !== recommendation.id &&
      entry.restaurant_id === restaurantId &&
      entry.inventory_item_id === recommendation.inventory_item_id &&
      entry.status === "pending"
  );
  if (newerPending) throw new Error("A newer recommendation is already pending.");

  const order = recommendation.supplier_order_id
    ? state.supplierOrders.find(
        (entry) => entry.restaurant_id === restaurantId && entry.id === recommendation.supplier_order_id
      ) ?? null
    : null;
  if (previousStatus === "approved" && order && order.status !== "draft") {
    throw new Error("This recommendation is already in supplier history and cannot be undone.");
  }

  recommendation.status = "pending";
  recommendation.supplier_order_id = null;
  if (previousStatus === "approved" && order) {
    const remaining = linkedApprovedRecommendations(state, order.id);
    if (remaining.length === 0) {
      state.supplierOrders = state.supplierOrders.filter((entry) => entry.id !== order.id);
    } else {
      order.order_message = buildSupplierOrderMessage(order.supplier_name, remaining, order.operator_note);
    }
  }
  return { outcome: "applied", recommendation, order, previousStatus };
}

export function markSupplierOrderSentInDemoState(
  state: DemoState,
  restaurantId: string,
  orderId: string
): SupplierOrderSentWorkflowResult {
  const order = state.supplierOrders.find(
    (entry) => entry.restaurant_id === restaurantId && entry.id === orderId
  );
  if (!order) throw new Error("Order draft not found");
  const linked = state.purchaseRecommendations.filter(
    (recommendation) =>
      recommendation.restaurant_id === restaurantId &&
      recommendation.supplier_order_id === orderId
  );
  if (order.status === "sent" || order.status === "completed") {
    return {
      outcome: "already_applied",
      order,
      orderedRecommendations: linked.filter((recommendation) => recommendation.status === "ordered")
    };
  }

  order.status = "sent";
  const orderedRecommendations = linked.filter((recommendation) => recommendation.status === "approved");
  orderedRecommendations.forEach((recommendation) => {
    recommendation.status = "ordered";
  });
  return { outcome: "applied", order, orderedRecommendations };
}

function findRecommendationForWorkflow(state: DemoState, restaurantId: string, recommendationId: string) {
  const recommendation = state.purchaseRecommendations.find(
    (entry) => entry.restaurant_id === restaurantId && entry.id === recommendationId
  );
  if (!recommendation) throw new Error("Recommendation not found.");
  return recommendation;
}

function linkedApprovedRecommendations(state: DemoState, orderId: string) {
  return state.purchaseRecommendations.filter(
    (recommendation) =>
      recommendation.supplier_order_id === orderId && recommendation.status === "approved"
  );
}

function rebuildDemoDraftMessage(state: DemoState, order: SupplierOrder) {
  order.order_message = buildSupplierOrderMessage(
    order.supplier_name,
    linkedApprovedRecommendations(state, order.id),
    order.operator_note
  );
}
