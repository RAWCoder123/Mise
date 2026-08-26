import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import {
  isPilotReadinessBlockedError,
  isPilotReadinessUnavailableError,
  requirePilotCanRecommend
} from "./pilotReadiness";
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
    data.providerMappings
  );
  await repository.replaceInsights(restaurantId, insights);
  return insights;
}

export async function generatePurchaseRecommendations(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  // Fail closed: unverified POS/count/recipe evidence must not create pending orders.
  await requirePilotCanRecommend(normalizedRestaurantId);

  const data = await repository.fetchPlanningData(normalizedRestaurantId);
  const recommendationHistory = await repository.fetchRecommendationHistory(normalizedRestaurantId);
  const inserts = buildRecommendationInserts(
    normalizedRestaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    {},
    data.providerMappings
  );
  await repository.replacePendingRecommendations(normalizedRestaurantId, inserts);
}

export async function regenerateOperationalSignals(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(normalizedRestaurantId),
    repository.fetchRecommendationHistory(normalizedRestaurantId)
  ]);
  const insights = buildInsightsFromData(
    normalizedRestaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    {},
    data.providerMappings
  );

  // Insights remain useful before the operating loop is ready. Pending purchase
  // recommendations do not: publish an empty set when readiness is incomplete
  // or unverifiable so operators never see untrustworthy order suggestions.
  let recommendations: ReturnType<typeof buildRecommendationInserts> = [];
  try {
    await requirePilotCanRecommend(normalizedRestaurantId);
    recommendations = buildRecommendationInserts(
      normalizedRestaurantId,
      data.inventoryItems,
      data.sales,
      data.menuItemIngredients,
      recommendationHistory,
      data.operatingDate,
      {},
      data.providerMappings
    );
  } catch (error) {
    if (!isPilotReadinessBlockedError(error) && !isPilotReadinessUnavailableError(error)) {
      throw error;
    }
    recommendations = [];
  }

  await repository.replaceOperationalSignals(normalizedRestaurantId, recommendations, insights);
}
