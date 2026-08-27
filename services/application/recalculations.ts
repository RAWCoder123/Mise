import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

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
    data.purchaseLoopCountHistory
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
    data.purchaseLoopCountHistory
  );
  await repository.replacePendingRecommendations(restaurantId, inserts);
}

export async function regenerateOperationalSignals(restaurantId: string) {
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const recommendations = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    {},
    data.providerMappings,
    data.purchaseLoopCountHistory
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    {},
    data.providerMappings,
    data.purchaseLoopCountHistory
  );
  await repository.replaceOperationalSignals(restaurantId, recommendations, insights);
}
