import {
  assertPilotCanRecommend,
  buildPilotReadiness,
  isPilotReadinessBlockedError,
  PilotReadinessUnavailableError,
  type PilotReadiness
} from "../domain/pilotReadiness";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { PilotReadiness };
export {
  assertPilotCanRecommend,
  isPilotReadinessBlockedError,
  isPilotReadinessUnavailableError,
  PilotReadinessBlockedError,
  PilotReadinessUnavailableError
} from "../domain/pilotReadiness";

export async function fetchPilotReadiness(restaurantId: string): Promise<PilotReadiness> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const [data, posIntegrations, countEvents, supplierRecipients, emailConnection] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchPosIntegrations(normalizedRestaurantId),
    repository.listInventoryEvents(normalizedRestaurantId, { eventTypes: ["count"], limit: 2000 }),
    repository.fetchSupplierRecipients(normalizedRestaurantId),
    repository.fetchEmailConnectionState(normalizedRestaurantId)
  ]);
  if (data.restaurant.id !== normalizedRestaurantId) {
    throw new Error("Pilot readiness failed restaurant scope validation.");
  }
  return buildPilotReadiness({
    restaurantId: normalizedRestaurantId,
    posIntegrations,
    sales: data.sales,
    inventoryItems: data.inventoryItems,
    countEvents,
    recipeMappings: data.menuItemIngredients,
    supplierRecipients,
    emailConnection
  });
}

/**
 * Fail closed before any recommendation write. UI gates are not authorization.
 * Propagates blocked/unavailable errors unchanged; wraps other failures.
 */
export async function requirePilotCanRecommend(restaurantId: string): Promise<PilotReadiness> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  let readiness: PilotReadiness;
  try {
    readiness = await fetchPilotReadiness(normalizedRestaurantId);
  } catch (error) {
    if (isPilotReadinessBlockedError(error) || error instanceof PilotReadinessUnavailableError) {
      throw error;
    }
    throw new PilotReadinessUnavailableError(
      error instanceof Error && error.message.trim()
        ? error.message
        : "Pilot readiness could not be verified for this restaurant."
    );
  }
  assertPilotCanRecommend(readiness);
  return readiness;
}
