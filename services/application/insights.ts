import {
  buildConditionalAnalyticsSummary,
  buildInsightSummary,
  buildLearningMemorySummary
} from "../domain/miseDomain";
import {
  buildInsightsSalesAnalytics,
  type InsightsSalesAnalytics
} from "../domain/insightsSalesAnalytics";
import {
  buildRecordedSalesTrend,
  type RecordedSalesTrendPoint
} from "../domain/salesTrends";
import type { PosSale } from "../../types/mise";
import { generateInsightsFromSalesAndInventory } from "./recalculations";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export { generateInsightsFromSalesAndInventory };
export type { InsightsSalesAnalytics };

export async function fetchConditionalAnalytics(restaurantId: string) {
  const [data, orders] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchSupplierOrders(restaurantId)
  ]);
  return buildConditionalAnalyticsSummary(
    restaurantId,
    data.sales,
    data.menuItemIngredients,
    data.inventoryItems,
    orders
  );
}

export async function fetchInsights(restaurantId: string) {
  return repository.fetchInsights(restaurantId);
}

export type InsightsSalesTrendPoint = RecordedSalesTrendPoint;

/** Returns recorded POS gross sales for the latest service days; no forecast values are introduced. */
export async function fetchInsightsSalesTrend(restaurantId: string): Promise<InsightsSalesTrendPoint[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const data = await repository.fetchPlanningData(normalizedRestaurantId);
  if (data.sales.some((sale) => sale.restaurant_id !== normalizedRestaurantId)) {
    throw new Error("Sales trend failed restaurant scope validation.");
  }
  return buildInsightsSalesTrend(normalizedRestaurantId, data.sales, 7, data.operatingDate);
}

export function buildInsightsSalesTrend(
  restaurantId: string,
  sales: readonly PosSale[],
  limit = 7,
  throughDate?: string | null
): InsightsSalesTrendPoint[] {
  return buildRecordedSalesTrend(restaurantId, sales, { limit, throughDate });
}

/** Category / weekday / source mix and best sellers from recorded POS (no invented demographics). */
export async function fetchInsightsSalesAnalytics(
  restaurantId: string
): Promise<InsightsSalesAnalytics> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const data = await repository.fetchPlanningData(normalizedRestaurantId);
  if (data.sales.some((sale) => sale.restaurant_id !== normalizedRestaurantId)) {
    throw new Error("Sales analytics failed restaurant scope validation.");
  }
  return buildInsightsSalesAnalytics({
    restaurantId: normalizedRestaurantId,
    sales: data.sales,
    throughDate: data.operatingDate,
    lookbackDays: 7
  });
}

export function summarizeInsights(restaurantId: string, insights: Awaited<ReturnType<typeof fetchInsights>>) {
  return buildInsightSummary(restaurantId, insights);
}

export async function fetchLearningMemorySummary(restaurantId: string) {
  const [data, orders] = await Promise.all([
    repository.fetchRestaurantData(restaurantId),
    repository.fetchSupplierOrders(restaurantId)
  ]);
  return buildLearningMemorySummary(
    data.restaurant,
    data.sales,
    data.inventoryItems,
    data.purchaseRecommendations,
    data.insights,
    data.menuItemIngredients,
    orders
  );
}
