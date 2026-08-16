import type { SupplierOrder } from "../../types/mise";
import {
  buildSupplierOrderMessage,
  createId,
  type RecommendationWorkflowResult,
  type SupplierOrderSentWorkflowResult
} from "../domain/miseDomain";
import {
  calculateOperationalSignals,
  recommendationEvidenceIsCurrent
} from "../domain/operationalSignals";
import { nextDateKeyInTimeZone, toDateKeyInTimeZone } from "../../utils/format";
import { DEMO_RESTAURANT_TIME_ZONE, type DemoState } from "./replaceableDemoData";

function demoOperatingDate(state: DemoState, restaurantId: string) {
  const timeZone =
    state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ??
    DEMO_RESTAURANT_TIME_ZONE;
  return toDateKeyInTimeZone(new Date(), timeZone);
}

export function rebuildPurchaseRecommendations(state: DemoState, restaurantId: string) {
  const signals = demoOperationalSignals(state, restaurantId);
  const pendingByItem = new Map(
    state.purchaseRecommendations
      .filter(
        (recommendation) =>
          recommendation.restaurant_id === restaurantId && recommendation.status === "pending"
      )
      .map((recommendation) => [recommendation.inventory_item_id, recommendation] as const)
  );
  state.purchaseRecommendations = [
    ...state.purchaseRecommendations.filter(
      (recommendation) =>
        recommendation.restaurant_id !== restaurantId || recommendation.status !== "pending"
    ),
    ...signals.recommendations.map((recommendation) => {
      const existing = pendingByItem.get(recommendation.inventory_item_id);
      const evidenceGenerationUnchanged =
        existing?.source_evidence.generatedAt === recommendation.source_evidence.generatedAt &&
        existing?.source_evidence.countEvent?.countEventId ===
          recommendation.source_evidence.countEvent?.countEventId;
      return {
        ...recommendation,
        id: existing?.id ?? createId("rec"),
        created_at: evidenceGenerationUnchanged
          ? existing.created_at
          : recommendation.source_evidence.generatedAt
      };
    })
  ];
}

export function rebuildInsights(state: DemoState, restaurantId: string) {
  const generated = demoOperationalSignals(state, restaurantId).insights;
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
  assertRecommendationEvidenceCurrent(state, recommendation);

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

  linked
    .filter((recommendation) => recommendation.status === "approved")
    .forEach((recommendation) => assertRecommendationEvidenceCurrent(state, recommendation));

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

function demoOperationalSignals(state: DemoState, restaurantId: string) {
  const generatedAt = state.inventoryEvents
    .filter((event) => event.restaurantId === restaurantId)
    .map((event) => event.recordedAt)
    .sort()
    .at(-1) ?? state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.created_at ?? new Date().toISOString();
  return calculateOperationalSignals({
    restaurantId,
    operatingDate: demoOperatingDate(state, restaurantId),
    inventoryItems: state.inventoryItems,
    sales: state.posSales,
    menuItemIngredients: state.menuItemIngredients,
    recommendationHistory: state.purchaseRecommendations,
    inventoryEvents: state.inventoryEvents,
    verifiedRecipeMappings: [],
    planningMode: "demo",
    selectedPosLocationId: null,
    planningRevision: null,
    generatedAt,
    correlationId: crypto.randomUUID()
  });
}

function assertRecommendationEvidenceCurrent(
  state: DemoState,
  recommendation: DemoState["purchaseRecommendations"][number]
) {
  if (
    recommendation.confidence === "blocked" ||
    !recommendationEvidenceIsCurrent({
      restaurantId: recommendation.restaurant_id,
      inventoryItemId: recommendation.inventory_item_id,
      evidence: recommendation.source_evidence,
      inventoryEvents: state.inventoryEvents,
      now: recommendation.source_evidence.generatedAt
    })
  ) {
    throw new Error("Recommendation evidence is stale or incomplete. Regenerate the plan before continuing.");
  }
}
