import type { RecommendationStatus, SupplierOrder } from "../../types/mise";
import {
  buildOrderQueueSummary,
  buildSupplierEmailPayload
} from "../domain/miseDomain";
import {
  assessOrderAutomation,
  type OrderAutomationAssessment,
  type OrderAutomationPolicy
} from "../domain/orderAutomation";
import { buildSupplierRecipientDirectory } from "../domain/supplierRecipients";
import { buildSupplierSpendTrend, type SupplierSpendTrendPoint } from "../domain/supplierSpend";
import {
  PurchaseAuthorityBlockedError,
  type PurchaseAuthorityResult
} from "../domain/purchaseAuthority";
import {
  buildSupplierReliabilitySummary,
  buildSupplierOrderDeliveryEvidence,
  type SupplierOrderDeliveryEvidence,
  type SupplierReliabilitySummary
} from "../domain/supplierReliability";
import {
  requireRecommendationApprovalQuantity,
  requireSupplierOperatorNote,
  requireSupplierRecipientInput
} from "../miseValidation";
import { getMiseRepository } from "./repository";
import { GmailIntegrationError } from "../repositories/miseRepository";
import type {
  GmailConnectionWorkflowResult,
  GmailDisconnectWorkflowResult,
  GmailIntegrationErrorStatus,
  SupplierOrderEmailSendResult
} from "../repositories/miseRepository";

export { GmailIntegrationError };
export type {
  GmailConnectionWorkflowResult,
  GmailDisconnectWorkflowResult,
  GmailIntegrationErrorStatus,
  SupplierOrderEmailSendResult
};

const repository = getMiseRepository();

export async function fetchPurchaseRecommendations(
  restaurantId: string,
  status: RecommendationStatus | "all" = "pending"
) {
  return repository.fetchPurchaseRecommendations(restaurantId, status);
}

export async function fetchPurchaseRecommendationAuthorities(
  restaurantId: string
): Promise<Record<string, PurchaseAuthorityResult>> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  return repository.fetchPurchaseRecommendationAuthorities(normalizedRestaurantId);
}

export async function approvePurchaseRecommendation(
  restaurantId: string,
  recommendationId: string,
  recommendedQuantity?: number
) {
  const result = await repository.approvePurchaseRecommendation(
    restaurantId,
    recommendationId,
    recommendedQuantity === undefined
      ? undefined
      : requireRecommendationApprovalQuantity(recommendedQuantity)
  );
  if (result.outcome === "blocked" || result.authority?.ready === false) {
    throw new PurchaseAuthorityBlockedError(result.authority ?? {
      ready: false,
      blockers: [],
      evaluatedAt: new Date().toISOString(),
      planningRevision: null,
      evidence: {
        recommendationId,
        inventoryItemId: result.recommendation.inventory_item_id,
        countEventId: null,
        countedAt: null,
        projectedQuantity: null,
        canonicalUnit: null,
        providerWindowFrom: null,
        providerWindowTo: null,
        providerWindowCompletedAt: null,
        recipeRevisions: {},
        basis: "physical_count_reorder_policy"
      }
    });
  }
  return result.recommendation;
}

export async function dismissPurchaseRecommendation(restaurantId: string, recommendationId: string) {
  const result = await repository.dismissPurchaseRecommendation(restaurantId, recommendationId);
  return result.recommendation;
}

export async function generateSupplierOrderDraft(restaurantId: string, supplierName?: string) {
  void restaurantId;
  void supplierName;
  throw new Error("Supplier drafts are created only by the server-authoritative recommendation approval workflow.");
}

export async function undoPurchaseRecommendationAction(restaurantId: string, recommendationId: string) {
  const result = await repository.undoPurchaseRecommendationAction(restaurantId, recommendationId);
  return result.recommendation;
}

export async function fetchSupplierOrders(restaurantId: string) {
  return repository.fetchSupplierOrders(restaurantId);
}

export type { SupplierOrderDeliveryEvidence };

export async function fetchSupplierOrderOperationalDetail(
  restaurantId: string,
  orderId: string
): Promise<{ order: SupplierOrder; deliveryEvidence: SupplierOrderDeliveryEvidence[] }> {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const normalizedOrderId = requireWorkflowId(orderId, "supplier order");
  const [order, history, restaurant] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchSupplierDeliveryHistory(normalizedRestaurantId),
    repository.fetchRestaurant(normalizedRestaurantId)
  ]);
  if (order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order belongs to another restaurant.");
  }
  return {
    order,
    deliveryEvidence: buildSupplierOrderDeliveryEvidence({
      restaurantId: normalizedRestaurantId,
      restaurantTimeZone: restaurant.timezone,
      order,
      deliveries: history.deliveries,
      items: history.items
    })
  };
}

export type { SupplierReliabilitySummary };

/**
 * Deterministic supplier performance from promised dates and verified receipt
 * evidence. This never changes supplier preference or ordering state.
 */
export async function fetchSupplierReliabilitySummary(
  restaurantId: string
): Promise<SupplierReliabilitySummary> {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const [orders, history, restaurant] = await Promise.all([
    repository.fetchSupplierOrders(normalizedRestaurantId),
    repository.fetchSupplierDeliveryHistory(normalizedRestaurantId),
    repository.fetchRestaurant(normalizedRestaurantId)
  ]);
  return buildSupplierReliabilitySummary({
    restaurantId: normalizedRestaurantId,
    restaurantTimeZone: restaurant.timezone,
    orders,
    deliveries: history.deliveries,
    items: history.items
  });
}

export type { SupplierSpendTrendPoint };

/**
 * Estimated spend per day for sent/completed supplier orders, priced from
 * the bounded recommendation history and current inventory unit costs.
 */
export async function fetchSupplierSpendTrend(restaurantId: string): Promise<SupplierSpendTrendPoint[]> {
  const [orders, recommendationHistory, inventoryItems, restaurant] = await Promise.all([
    repository.fetchSupplierOrders(restaurantId),
    repository.fetchRecommendationHistory(restaurantId),
    repository.fetchInventoryItems(restaurantId),
    repository.fetchRestaurant(restaurantId)
  ]);
  return buildSupplierSpendTrend(restaurantId, orders, recommendationHistory, inventoryItems, {
    timeZone: restaurant.timezone
  });
}

/**
 * Evaluates whether pending recommendations have enough bounded evidence for
 * future automatic drafting or sending. This is intentionally read-only and
 * never changes recommendation or supplier-order state.
 */
export async function fetchOrderAutomationAssessment(
  restaurantId: string,
  supplierName: string,
  policy?: OrderAutomationPolicy
): Promise<OrderAutomationAssessment> {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const normalizedSupplierName = supplierName.trim();
  if (!normalizedSupplierName || normalizedSupplierName.length > 160) {
    throw new Error("Missing supplier.");
  }

  const [pendingRecommendations, recommendationHistory, inventoryItems, emailConnection, recipients] =
    await Promise.all([
      repository.fetchPurchaseRecommendations(normalizedRestaurantId, "pending"),
      repository.fetchRecommendationHistory(normalizedRestaurantId),
      repository.fetchInventoryItems(normalizedRestaurantId),
      repository.fetchEmailConnectionState(normalizedRestaurantId),
      repository.fetchSupplierRecipients(normalizedRestaurantId)
    ]);
  const supplierKey = normalizedSupplierName.toLocaleLowerCase();
  const recipientConfigured = recipients.some(
    (recipient) =>
      recipient.supplier_name.trim().toLocaleLowerCase() === supplierKey &&
      Boolean(recipient.email?.trim())
  );

  return assessOrderAutomation({
    restaurantId: normalizedRestaurantId,
    supplierName: normalizedSupplierName,
    candidates: pendingRecommendations.filter(
      (recommendation) => recommendation.supplier_name.trim().toLocaleLowerCase() === supplierKey
    ),
    inventoryItems,
    recommendationHistory,
    policy,
    delivery: {
      emailConnected: emailConnection?.status === "connected",
      supplierRecipientConfigured: recipientConfigured
    }
  });
}

export async function fetchEmailConnectionState(restaurantId: string) {
  return repository.fetchEmailConnectionState(restaurantId);
}

export async function connectRestaurantGmail(restaurantId: string): Promise<GmailConnectionWorkflowResult> {
  return repository.connectRestaurantGmail(requireWorkflowId(restaurantId, "restaurant"));
}

export async function disconnectRestaurantGmail(restaurantId: string): Promise<GmailDisconnectWorkflowResult> {
  return repository.disconnectRestaurantGmail(requireWorkflowId(restaurantId, "restaurant"));
}

export async function sendSupplierOrderEmail(
  restaurantId: string,
  orderId: string
): Promise<SupplierOrderEmailSendResult> {
  return repository.sendSupplierOrderEmail(
    requireWorkflowId(restaurantId, "restaurant"),
    requireWorkflowId(orderId, "supplier order")
  );
}

export function isGmailIntegrationError(error: unknown): error is GmailIntegrationError {
  return error instanceof GmailIntegrationError;
}

export async function fetchSupplierRecipients(restaurantId: string) {
  return repository.fetchSupplierRecipients(requireWorkflowId(restaurantId, "restaurant"));
}

export async function fetchSupplierRecipientDirectory(restaurantId: string) {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const [inventoryItems, recipients] = await Promise.all([
    repository.fetchInventoryItems(normalizedRestaurantId),
    repository.fetchSupplierRecipients(normalizedRestaurantId)
  ]);
  return buildSupplierRecipientDirectory(
    normalizedRestaurantId,
    inventoryItems.map((item) => item.supplier_name),
    recipients
  );
}

export async function saveSupplierRecipient(
  restaurantId: string,
  supplierName: string,
  email: string
) {
  const input = requireSupplierRecipientInput({
    restaurant_id: requireWorkflowId(restaurantId, "restaurant"),
    supplier_name: supplierName,
    email
  });
  return repository.upsertSupplierRecipient(input);
}

export async function prepareSupplierEmailPayload(restaurantId: string, orderId: string) {
  const [restaurant, order, emailConnection, recipients] = await Promise.all([
    repository.fetchRestaurant(restaurantId),
    repository.fetchSupplierOrder(restaurantId, orderId),
    repository.fetchEmailConnectionState(restaurantId),
    repository.fetchSupplierRecipients(restaurantId)
  ]);
  return buildSupplierEmailPayload(restaurant, order, emailConnection, recipients);
}

export function summarizeOrderQueue(
  restaurantId: string,
  recommendations: Awaited<ReturnType<typeof fetchPurchaseRecommendations>>,
  orders: Awaited<ReturnType<typeof fetchSupplierOrders>>
) {
  return buildOrderQueueSummary(restaurantId, recommendations, orders);
}

export async function fetchSupplierOrder(restaurantId: string, orderId: string) {
  return repository.fetchSupplierOrder(restaurantId, orderId);
}

export async function updateSupplierOrder(
  restaurantId: string,
  orderId: string,
  patch: Partial<Pick<SupplierOrder, "operator_note" | "delivery_date">>
) {
  const normalizedPatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "operator_note")) {
    normalizedPatch.operator_note = requireSupplierOperatorNote(patch.operator_note);
  }
  return repository.updateSupplierOrder(restaurantId, orderId, normalizedPatch);
}

export async function markSupplierOrderSent(restaurantId: string, orderId: string) {
  const { order, orderedRecommendations } = await repository.markSupplierOrderSent(restaurantId, orderId);
  return { order, orderedRecommendations };
}

function requireWorkflowId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 128) throw new Error(`Missing ${label}.`);
  return normalized;
}
