import { buildPilotReadiness, type PilotReadiness } from "../domain/pilotReadiness";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { PilotReadiness };
export {
  assertPilotCanRecommend,
  isPilotReadinessBlockedError,
  isPilotReadinessUnavailableError,
  isPilotReadinessRpcBlockedError,
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
