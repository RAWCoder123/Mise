import {
  confirmationForResolution,
  type SupplierEmailDeliveryResolution,
  type SupplierEmailDeliveryReview
} from "../domain/supplierEmailDeliveryReview";
import type { SupplierEmailDeliveryResolutionResult } from "../repositories/repositoryContracts";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchSupplierEmailDeliveryReview(
  restaurantId: string,
  orderId: string
): Promise<SupplierEmailDeliveryReview> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = orderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");
  if (!repository.fetchSupplierEmailDeliveryReview) {
    throw new Error("Supplier email delivery review is unavailable.");
  }
  return repository.fetchSupplierEmailDeliveryReview(
    normalizedRestaurantId,
    normalizedOrderId
  );
}

export async function resolveSupplierEmailDelivery(
  restaurantId: string,
  orderId: string,
  resolution: SupplierEmailDeliveryResolution,
  providerMessageId?: string | null
): Promise<SupplierEmailDeliveryResolutionResult> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = orderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");
  if (resolution !== "confirm_sent" && resolution !== "allow_retry") {
    throw new Error("Unsupported supplier email delivery resolution.");
  }
  if (!repository.resolveSupplierEmailDelivery) {
    throw new Error("Supplier email delivery resolution is unavailable.");
  }
  const result = await repository.resolveSupplierEmailDelivery(
    normalizedRestaurantId,
    normalizedOrderId,
    resolution,
    confirmationForResolution(resolution),
    providerMessageId?.trim() || null
  );
  if (result.order.restaurant_id !== normalizedRestaurantId || result.order.id !== normalizedOrderId) {
    throw new Error("Supplier email delivery resolution failed restaurant scope validation.");
  }
  return result;
}

export type { SupplierEmailDeliveryResolution, SupplierEmailDeliveryReview };
export type { SupplierEmailDeliveryResolutionResult };
