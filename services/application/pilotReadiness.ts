import { buildPilotReadiness, type PilotReadiness } from "../domain/pilotReadiness";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { PilotReadiness };

export async function fetchPilotReadiness(restaurantId: string): Promise<PilotReadiness> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  const [data, planning, posIntegrations, squareIntegration, supplierRecipients, emailConnection] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchPlanningData(normalizedRestaurantId),
    repository.fetchPosIntegrations(normalizedRestaurantId),
    repository.fetchSquarePosIntegration(normalizedRestaurantId),
    repository.fetchSupplierRecipients(normalizedRestaurantId),
    repository.fetchEmailConnectionState(normalizedRestaurantId)
  ]);
  if (data.restaurant.id !== normalizedRestaurantId) {
    throw new Error("Pilot readiness failed restaurant scope validation.");
  }
  const enrichedIntegrations = posIntegrations.map((integration) =>
    integration.provider === "square" && squareIntegration ? squareIntegration : integration
  );
  if (squareIntegration && !enrichedIntegrations.some((integration) => integration.id === squareIntegration.id)) {
    enrichedIntegrations.push(squareIntegration);
  }
  return buildPilotReadiness({
    restaurantId: normalizedRestaurantId,
    posIntegrations: enrichedIntegrations,
    sales: planning.sales,
    inventoryItems: planning.inventoryItems,
    countEvents: planning.inventoryEvents,
    recipeMappings: planning.menuItemIngredients,
    verifiedRecipeMappings: planning.verifiedRecipeMappings,
    supplierRecipients,
    emailConnection
  });
}
