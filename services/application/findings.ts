import { buildDailyOperationalBrief } from "../domain/operationalFindings";
import { toDateKeyInTimeZone } from "../../utils/format";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchDailyOperationalBrief(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [restaurantData, decisions, purchaseLineNets] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchOperationalFindingDecisions(normalizedRestaurantId),
    // Fail closed to unknown: a failed net read must not invent “no unmatched credits.”
    repository.fetchPurchaseLineNetByItem(normalizedRestaurantId).catch(() => null)
  ]);

  return buildDailyOperationalBrief({
    restaurantId: normalizedRestaurantId,
    operatingDate: toDateKeyInTimeZone(new Date(), restaurantData.restaurant.timezone),
    sales: restaurantData.sales,
    inventoryItems: restaurantData.inventoryItems,
    mappings: restaurantData.menuItemIngredients,
    recommendations: restaurantData.purchaseRecommendations,
    insights: restaurantData.insights,
    decisions,
    ...(purchaseLineNets ? { purchaseLineNets } : {})
  });
}
