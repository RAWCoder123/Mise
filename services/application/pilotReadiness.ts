import { buildPilotReadiness, type PilotReadiness } from "../domain/pilotReadiness";
import { requireCanonicalPilotReadinessWorkspaceId } from "../domain/pilotReadinessRestaurantIdentity";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** MISE-005LO: ASCII-C restaurant workspace identity for pilot-readiness entry points. */
function requireRestaurantId(restaurantId: string) {
  return requireCanonicalPilotReadinessWorkspaceId(restaurantId);
}

export type { PilotReadiness };

export async function fetchPilotReadiness(restaurantId: string): Promise<PilotReadiness> {
  const normalizedRestaurantId = requireRestaurantId(restaurantId);
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
