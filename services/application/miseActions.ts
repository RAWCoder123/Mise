import type { MiseAction } from "../domain/miseActions";
import { approvePurchaseRecommendation, sendSupplierOrderEmail } from "./orders";
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

/**
 * One-tap Home/Orders approval path:
 * - recommendation approvals use the existing purchase-recommendation workflow
 * - prepared Mise actions use decide_mise_action
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
    if (action.actionType === "send_supplier_order") {
      const orderId = action.expectedImpact?.orderId;
      if (typeof orderId !== "string" || !orderId.trim()) {
        throw new Error("Approved supplier-send action is missing its order reference.");
      }
      const sendResult = await sendSupplierOrderEmail(restaurantId, orderId);
      return { kind: "action_executed" as const, action, sendResult };
    }
    return { kind: "action" as const, action };
  }
  throw new Error("Approval requires a recommendation or action id.");
}
