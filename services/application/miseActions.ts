import type { MiseAction } from "../domain/miseActions";
import type { SupplierSendEnvelope } from "../repositories/repositoryContracts";
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

export async function approveSupplierSendEnvelope(
  restaurantId: string,
  actionId: string,
  orderId: string,
  envelope: SupplierSendEnvelope
) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedActionId = actionId.trim();
  const normalizedOrderId = orderId.trim();
  const normalizedEnvelope = {
    from: envelope.from.trim().toLowerCase(),
    to: envelope.to.trim().toLowerCase(),
    subject: envelope.subject.trim()
  };
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedActionId) throw new Error("Missing supplier send action.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");
  if (!normalizedEnvelope.from || !normalizedEnvelope.to || !normalizedEnvelope.subject) {
    throw new Error("Supplier send approval requires the reviewed sender, recipient, and subject.");
  }
  if (!repository.approveSupplierSendEnvelope) {
    throw new Error("Supplier send envelope approval is unavailable.");
  }
  const action = await repository.approveSupplierSendEnvelope(
    normalizedRestaurantId,
    normalizedActionId,
    normalizedOrderId,
    normalizedEnvelope
  );
  if (action.restaurantId !== normalizedRestaurantId || action.id !== normalizedActionId) {
    throw new Error("Supplier send approval failed restaurant scope validation.");
  }
  return action;
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
