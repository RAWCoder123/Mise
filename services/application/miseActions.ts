import type { MiseAction } from "../domain/miseActions";
import { requireSupplierSendContentFingerprint } from "../miseValidation";
import { approvePurchaseRecommendation } from "./orders";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchMiseActions(
  restaurantId: string,
  options: { status?: MiseAction["status"] | "awaiting_decision"; limit?: number } = {}
) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const actions = await repository.listMiseActions(normalizedRestaurantId, options);
  if (actions.some((action) => action.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Mise actions failed restaurant scope validation.");
  }
  return actions;
}

export async function fetchSupplierSendAction(restaurantId: string, orderId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = orderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");
  if (!repository.fetchSupplierSendAction) {
    throw new Error("Supplier send action lookup is unavailable.");
  }
  const action = await repository.fetchSupplierSendAction(
    normalizedRestaurantId,
    normalizedOrderId
  );
  if (action && action.restaurantId !== normalizedRestaurantId) {
    throw new Error("Supplier send action failed restaurant scope validation.");
  }
  return action;
}

export async function decideMiseAction(
  restaurantId: string,
  actionId: string,
  decision: "approved" | "rejected"
) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const action = await repository.decideMiseAction(normalizedRestaurantId, actionId, decision);
  if (action.restaurantId !== normalizedRestaurantId) {
    throw new Error("Mise action failed restaurant scope validation.");
  }
  return action;
}

export async function approveSupplierSendContent(
  restaurantId: string,
  actionId: string,
  orderId: string,
  contentFingerprint: string
) {
  const normalizedRestaurantId = requireSupplierSendApprovalId(
    restaurantId,
    "restaurant workspace"
  );
  const normalizedActionId = requireSupplierSendApprovalId(actionId, "supplier send action");
  const normalizedOrderId = requireSupplierSendApprovalId(orderId, "supplier order");
  const normalizedFingerprint = requireSupplierSendContentFingerprint(contentFingerprint);
  const result = await repository.approveSupplierSendContent(
    normalizedRestaurantId,
    normalizedActionId,
    normalizedOrderId,
    normalizedFingerprint
  );
  if (
    (result.outcome === "applied" || result.outcome === "already_applied") &&
    (
      result.action.restaurantId !== normalizedRestaurantId ||
      result.action.id !== normalizedActionId ||
      result.contentFingerprint !== normalizedFingerprint
    )
  ) {
    throw new Error("Supplier send approval failed restaurant scope validation.");
  }
  return result;
}

function requireSupplierSendApprovalId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`Missing ${label}.`);
  }
  return normalized;
}

/**
 * One-tap Home/Orders approval path:
 * - recommendation approvals use the existing purchase-recommendation workflow
 * - prepared Mise actions record the explicit decision only; external execution
 *   stays in the destination-review workflow that owns the final send.
 */
export async function approveOperatingDecision(
  restaurantId: string,
  input: { recommendationId?: string | null; actionId?: string | null; quantity?: number }
) {
  if (input.recommendationId) {
    const recommendation = await approvePurchaseRecommendation(
      restaurantId,
      input.recommendationId,
      input.quantity
    );
    return { kind: "recommendation" as const, recommendation };
  }
  if (input.actionId) {
    const action = await decideMiseAction(restaurantId, input.actionId, "approved");
    return { kind: "action" as const, action };
  }
  throw new Error("Approval requires a recommendation or action id.");
}
