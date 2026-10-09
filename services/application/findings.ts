import { buildDailyOperationalBrief } from "../domain/operationalFindings";
import { requireCanonicalFindingsWorkspaceId } from "../domain/findingsRestaurantIdentity";
import { toDateKeyInTimeZone } from "../../utils/format";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** MISE-005LV: ASCII-C restaurant workspace identity for findings entry points. */
function requireRestaurantId(restaurantId: string) {
  return requireCanonicalFindingsWorkspaceId(restaurantId);
}

export async function fetchDailyOperationalBrief(restaurantId: string) {
  const normalizedRestaurantId = requireRestaurantId(restaurantId);

  const [restaurantData, decisions] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchOperationalFindingDecisions(normalizedRestaurantId)
  ]);

  return buildDailyOperationalBrief({
    restaurantId: normalizedRestaurantId,
    operatingDate: toDateKeyInTimeZone(new Date(), restaurantData.restaurant.timezone),
    sales: restaurantData.sales,
    inventoryItems: restaurantData.inventoryItems,
    mappings: restaurantData.menuItemIngredients,
    recommendations: restaurantData.purchaseRecommendations,
    insights: restaurantData.insights,
    decisions
  });
}
