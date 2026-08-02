import type { RecommendationStatus, SupplierOrder } from "../../types/mise";
import {
  buildOrderQueueSummary,
  buildSupplierEmailPayload
} from "../domain/miseDomain";
import {
  SUPPLIER_ORDER_RECEIVE_SUMMARY_LINE_MAX,
  buildCompletedSupplierOrderReceiveSummary,
  defaultReceiveLinesFromRecommendations,
  linkedOrderedRecommendationsForOrder,
  planSupplierOrderReceive
} from "../domain/supplierOrderReceiving";
import { buildSupplierRecipientDirectory } from "../domain/supplierRecipients";
import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import {
  requireOptionalDismissReason,
  requireRecommendationApprovalQuantity,
  requireSupplierOperatorNote,
  requireSupplierOrderReceiveLines,
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
  return result.recommendation;
}

export async function dismissPurchaseRecommendation(
  restaurantId: string,
  recommendationId: string,
  dismissReason?: string | null
) {
  const result = await repository.dismissPurchaseRecommendation(
    restaurantId,
    recommendationId,
    requireOptionalDismissReason(dismissReason)
  );
  return result.recommendation;
}

export async function generateSupplierOrderDraft(_restaurantId: string, _supplierName?: string) {
  throw new Error(
    "Supplier drafts are created by approving a recommendation. Direct draft generation is disabled."
  );
}

export async function rebuildSupplierDraftForRecommendationUndo(_restaurantId: string, _supplierName: string) {
  throw new Error(
    "Supplier draft rebuild runs inside the recommendation undo RPC. Direct draft writes are disabled."
  );
}

export async function undoPurchaseRecommendationAction(restaurantId: string, recommendationId: string) {
  const result = await repository.undoPurchaseRecommendationAction(restaurantId, recommendationId);
  return result.recommendation;
}

export async function fetchSupplierOrders(restaurantId: string) {
  return repository.fetchSupplierOrders(restaurantId);
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

export async function confirmSupplierOrderPlaced(restaurantId: string, orderId: string) {
  return repository.confirmSupplierOrderPlaced(
    requireWorkflowId(restaurantId, "restaurant"),
    requireWorkflowId(orderId, "supplier order")
  );
}

export async function fetchSupplierOrderReceivePreview(restaurantId: string, orderId: string) {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const normalizedOrderId = requireWorkflowId(orderId, "supplier order");
  const [order, recommendations, inventoryItems] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);
  const linked = linkedOrderedRecommendationsForOrder(normalizedOrderId, recommendations);
  const planned = planSupplierOrderReceive({
    order,
    recommendations,
    inventoryItems,
    receiveLines: defaultReceiveLinesFromRecommendations(linked)
  });
  return { order, linkedRecommendations: linked, planned };
}

export async function fetchSupplierOrderReceiveSummary(restaurantId: string, orderId: string) {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const normalizedOrderId = requireWorkflowId(orderId, "supplier order");
  const [order, recommendations, inventoryItems, movements] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchInventoryItems(normalizedRestaurantId),
    repository.fetchSupplierOrderReceiveMovements(
      normalizedRestaurantId,
      normalizedOrderId,
      SUPPLIER_ORDER_RECEIVE_SUMMARY_LINE_MAX
    )
  ]);
  const linked = linkedOrderedRecommendationsForOrder(normalizedOrderId, recommendations);
  const summary = buildCompletedSupplierOrderReceiveSummary({
    orderId: normalizedOrderId,
    movements,
    recommendations: linked,
    inventoryItems
  });
  return { order, linkedRecommendations: linked, summary };
}

export async function receiveSupplierOrder(
  restaurantId: string,
  orderId: string,
  receiveLines: unknown
) {
  const normalizedRestaurantId = requireWorkflowId(restaurantId, "restaurant");
  const normalizedOrderId = requireWorkflowId(orderId, "supplier order");
  const normalizedLines = requireSupplierOrderReceiveLines(receiveLines);
  const [order, recommendations, data, recommendationHistory, storageLocations] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchPlanningData(normalizedRestaurantId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchStorageLocations(normalizedRestaurantId)
  ]);
  const planned = planSupplierOrderReceive({
    order,
    recommendations,
    inventoryItems: data.inventoryItems,
    receiveLines: normalizedLines,
    // Hosted reads are pure and may be empty before the first write seeds Main.
    // SQL receiving still defaults omitted locations to Main.
    storageLocations: storageLocations.length > 0 ? storageLocations : undefined
  });
  const resolvedLines = planned.lines.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    quantityReceived: line.quantityReceived,
    note: line.note ?? null,
    storageLocationId: line.storageLocationId ?? normalizedLines.find(
      (entry) => entry.inventoryItemId === line.inventoryItemId
    )?.storageLocationId ?? null
  }));
  const now = new Date().toISOString();
  const planningInventory = data.inventoryItems.map((item) => {
    const line = planned.lines.find((entry) => entry.inventoryItemId === item.id);
    return line
      ? { ...item, current_quantity: line.quantityAfter, last_updated: now }
      : item;
  });
  const inFlightReceivingHistory = planned.lines.map((line) => ({
    inventoryItemId: line.inventoryItemId,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: line.quantityReceived,
    discrepancy: line.discrepancy,
    createdAt: now,
    supplierOrderId: normalizedOrderId
  }));
  const receivingHistory = [...inFlightReceivingHistory, ...(data.receivingHistory ?? [])];
  const nextRecommendations = buildRecommendationInserts(
    normalizedRestaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId,
    receivingHistory,
    data.wasteHistory,
    data.countVarianceHistory,
    data.managerCorrectionHistory
  );
  const nextInsights = buildInsightsFromData(
    normalizedRestaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId,
    receivingHistory,
    data.wasteHistory,
    data.countVarianceHistory,
    data.managerCorrectionHistory,
    recommendationHistory
  );
  return repository.receiveSupplierOrderAndSignals(
    normalizedRestaurantId,
    normalizedOrderId,
    resolvedLines,
    nextRecommendations,
    nextInsights
  );
}

function requireWorkflowId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 128) throw new Error(`Missing ${label}.`);
  return normalized;
}
