import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import { buildVerifiedPackByInventoryItemId } from "../domain/supplierPackQuantity";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

function verifiedPacksForRestaurant(
  restaurantId: string,
  data: Awaited<ReturnType<typeof repository.fetchPlanningData>>
) {
  return [...buildVerifiedPackByInventoryItemId(
    restaurantId,
    data.inventoryItems,
    data.supplierItems
  ).entries()].map(([inventoryItemId, packQuantity]) => ({ inventoryItemId, packQuantity }));
}

export async function generateInsightsFromSalesAndInventory(restaurantId: string) {
  const data = await repository.fetchPlanningData(restaurantId);
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    {},
    data.providerMappings,
    verifiedPacksForRestaurant(restaurantId, data)
  );
  await repository.replaceInsights(restaurantId, insights);
  return insights;
}

export async function generatePurchaseRecommendations(restaurantId: string) {
  const data = await repository.fetchPlanningData(restaurantId);
  const recommendationHistory = await repository.fetchRecommendationHistory(restaurantId);
  const inserts = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    {},
    data.providerMappings,
    verifiedPacksForRestaurant(restaurantId, data)
  );
  await repository.replacePendingRecommendations(restaurantId, inserts);
}

export async function regenerateOperationalSignals(restaurantId: string) {
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const packs = verifiedPacksForRestaurant(restaurantId, data);
  const recommendations = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    {},
    data.providerMappings,
    packs
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    {},
    data.providerMappings,
    packs
  );
  await repository.replaceOperationalSignals(restaurantId, recommendations, insights);
}
