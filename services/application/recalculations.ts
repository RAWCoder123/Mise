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
    planningContext(data)
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
    planningContext(data)
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
    planningContext(data)
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    planningContext(data)
  );
  await repository.replaceOperationalSignals(restaurantId, recommendations, insights);
}

function planningContext(data: Awaited<ReturnType<typeof repository.fetchPlanningData>>) {
  return {
    inventoryEvents: data.inventoryEvents,
    verifiedRecipeMappings: data.verifiedRecipeMappings,
    planningMode: data.planningMode,
    selectedPosLocationId: data.selectedPosLocationId,
    planningRevision: data.planningRevision,
    generatedAt: data.generatedAt,
    correlationId: data.correlationId
  };
}
