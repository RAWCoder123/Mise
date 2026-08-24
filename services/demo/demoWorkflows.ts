import {
  SUPPLIER_SEND_CONTENT_VERSION,
  type SupplierOrder
} from "../../types/mise";
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
import { buildInventoryCountEvidence } from "../domain/inventoryCountAuthority";
import { nextDateKeyInTimeZone, toDateKeyInTimeZone } from "../../utils/format";
import { demoDemandFallback } from "./demandFallback";
import { DEMO_RESTAURANT_TIME_ZONE, type DemoState } from "./replaceableDemoData";

function demoTimeZone(state: DemoState, restaurantId: string) {
  return (
    state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ??
    DEMO_RESTAURANT_TIME_ZONE
  );
}

function demoOperatingDate(state: DemoState, restaurantId: string) {
  return toDateKeyInTimeZone(new Date(), demoTimeZone(state, restaurantId));
}

/**
 * Ledger `count` rows are the only physical-count evidence in demo mode too, and the
 * full local ledger is passed so out-of-order projection contamination is detectable.
 * Demo state holds the complete ledger, so the read is never truncated.
 */
function demoCountEvidence(state: DemoState, restaurantId: string) {
  const timeZone = demoTimeZone(state, restaurantId);
  return buildInventoryCountEvidence({
    restaurantId,
    items: state.inventoryItems.filter((item) => item.restaurant_id === restaurantId),
    ledgerEvents: state.inventoryEvents ?? [],
    ledgerComplete: true,
    resolveOperatingDate: (iso) => toDateKeyInTimeZone(new Date(iso), timeZone)
  });
}

export function rebuildPurchaseRecommendations(state: DemoState, restaurantId: string) {
  const now = new Date().toISOString();
  const recommendationHistory = [...state.purchaseRecommendations];
  const learnedQuantities = buildLearnedOrderQuantities(restaurantId, recommendationHistory);
  const countEvidence = demoCountEvidence(state, restaurantId);
  const lowOutlooks = buildInventoryOutlooks(
    restaurantId,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(state, restaurantId),
    demoDemandFallback,
    countEvidence
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
    if (!pending && shouldSuppressRecommendationForItem(restaurantId, item, recommendationHistory, countEvidence)) {
      return;
    }

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
      // Re-stamp only when a verified count superseded the pending row, never on a
      // policy or cost edit.
      const countedAt = countEvidence.get(item.id)?.countedAt;
      if (countedAt && pending.created_at.localeCompare(countedAt) < 0) {
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
    demoDemandFallback,
    demoCountEvidence(state, restaurantId)
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
  const executedAction = state.miseActions.find(
    (action) =>
      action.restaurantId === restaurantId &&
      action.actionType === "send_supplier_order" &&
      action.status === "executed" &&
      action.result?.supplierOrderId === orderId
  );
  const result = executedAction?.result;
  const approvedContent = executedAction?.expectedImpact?.approvedSendContent as
    | Record<string, unknown>
    | null
    | undefined;
  const recommendationIds = result?.recommendationIds;
  const durableEvidenceReady =
    (order.status === "sent" || order.status === "completed") &&
    executedAction?.executedAt !== null &&
    typeof executedAction?.executedAt === "string" &&
    Number.isFinite(Date.parse(executedAction.executedAt)) &&
    result?.provider === "demo" &&
    result?.simulated === true &&
    result?.providerMessageId === `demo-gmail:${orderId}` &&
    result?.contentVersion === SUPPLIER_SEND_CONTENT_VERSION &&
    typeof result?.contentFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(result.contentFingerprint) &&
    typeof result?.contentRevision === "number" &&
    Number.isInteger(result.contentRevision) &&
    result.contentRevision > 0 &&
    approvedContent !== null &&
    typeof approvedContent === "object" &&
    !Array.isArray(approvedContent) &&
    approvedContent.version === result.contentVersion &&
    approvedContent.fingerprint === result.contentFingerprint &&
    approvedContent.contentRevision === result.contentRevision &&
    Array.isArray(recommendationIds) &&
    recommendationIds.length > 0 &&
    recommendationIds.length <= 250 &&
    recommendationIds.every((id) => typeof id === "string") &&
    new Set(recommendationIds).size === recommendationIds.length;

  if (!durableEvidenceReady) {
    throw new Error("Provider acceptance is required before marking this order sent");
  }
  return markClaimedSupplierOrderSentInDemoState(
    state,
    restaurantId,
    orderId,
    recommendationIds as string[]
  );
}

export function demoSupplierSendContentRevision(state: DemoState, orderId: string) {
  const current = state.supplierSendContentRevisions[orderId];
  if (typeof current === "number" && Number.isInteger(current) && current > 0) return current;
  state.supplierSendContentRevisions[orderId] = 1;
  return 1;
}

export function bumpDemoSupplierSendContentRevision(state: DemoState, orderId: string) {
  const next = demoSupplierSendContentRevision(state, orderId) + 1;
  state.supplierSendContentRevisions[orderId] = next;
  return next;
}

/**
 * External delivery identity is part of the reviewed supplier-send snapshot,
 * even though it is stored outside supplier_orders. Advancing every affected
 * draft's monotonic token prevents a sender, recipient, or restaurant-name
 * A -> B -> A change from reviving an earlier approval in local demo mode.
 */
export function bumpDemoSupplierSendContentForExternalChange(
  state: DemoState,
  restaurantId: string,
  supplierNames?: readonly string[]
) {
  const supplierKeys = supplierNames
    ? new Set(supplierNames.map((name) => name.trim().toLowerCase()))
    : null;
  const bumpedOrderIds: string[] = [];

  for (const order of state.supplierOrders) {
    if (
      order.restaurant_id !== restaurantId ||
      order.status !== "draft" ||
      (supplierKeys && !supplierKeys.has(order.supplier_name.trim().toLowerCase()))
    ) {
      continue;
    }
    bumpDemoSupplierSendContentRevision(state, order.id);
    bumpedOrderIds.push(order.id);
  }

  return bumpedOrderIds;
}

/**
 * Demo sends are atomic, but completion still uses the exact line identifiers
 * captured by the simulated claim. This prevents demo mode from teaching the
 * old "mark every currently approved supplier line ordered" behavior.
 */
export function markClaimedSupplierOrderSentInDemoState(
  state: DemoState,
  restaurantId: string,
  orderId: string,
  claimedRecommendationIds: readonly string[]
): SupplierOrderSentWorkflowResult {
  const uniqueClaimedIds = [...new Set(claimedRecommendationIds)].sort();
  if (
    uniqueClaimedIds.length === 0 ||
    uniqueClaimedIds.length > 250 ||
    uniqueClaimedIds.length !== claimedRecommendationIds.length
  ) {
    throw new Error("The simulated supplier send claim has an invalid line set.");
  }

  const order = state.supplierOrders.find(
    (entry) => entry.restaurant_id === restaurantId && entry.id === orderId
  );
  if (!order) throw new Error("Order draft not found");

  const claimed = uniqueClaimedIds.map((recommendationId) => {
    const recommendation = state.purchaseRecommendations.find(
      (entry) =>
        entry.id === recommendationId &&
        entry.restaurant_id === restaurantId &&
        entry.supplier_order_id === orderId
    );
    if (!recommendation) throw new Error("The simulated supplier send line set changed.");
    return recommendation;
  });
  if (order.status === "sent" || order.status === "completed") {
    const currentOrderedIds = state.purchaseRecommendations
      .filter(
        (recommendation) =>
          recommendation.restaurant_id === restaurantId &&
          recommendation.supplier_order_id === orderId &&
          recommendation.status === "ordered"
      )
      .map((recommendation) => recommendation.id)
      .sort();
    if (
      claimed.some((recommendation) => recommendation.status !== "ordered") ||
      currentOrderedIds.length !== uniqueClaimedIds.length ||
      currentOrderedIds.some((id, index) => id !== uniqueClaimedIds[index])
    ) {
      throw new Error("The simulated supplier send completion is inconsistent.");
    }
    return { outcome: "already_applied", order, orderedRecommendations: claimed };
  }

  const currentApprovedIds = state.purchaseRecommendations
    .filter(
      (recommendation) =>
        recommendation.restaurant_id === restaurantId &&
        recommendation.supplier_order_id === orderId &&
        recommendation.status === "approved"
    )
    .map((recommendation) => recommendation.id)
    .sort();
  if (
    currentApprovedIds.length !== uniqueClaimedIds.length ||
    currentApprovedIds.some((id, index) => id !== uniqueClaimedIds[index]) ||
    claimed.some((recommendation) => recommendation.status !== "approved")
  ) {
    throw new Error("The simulated supplier send line set changed.");
  }

  order.status = "sent";
  claimed.forEach((recommendation) => {
    recommendation.status = "ordered";
  });
  return { outcome: "applied", order, orderedRecommendations: claimed };
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
