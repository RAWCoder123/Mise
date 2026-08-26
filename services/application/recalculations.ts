import { addDaysToDateKey } from "../../utils/format";
import {
  buildCloseReconciliation,
  closeReconciliationInsights,
  mergeCloseReconciliationInsights
} from "../domain/closeReconciliation";
import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import type { RecalculationCycle } from "../domain/recalculationSchedule";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/** How far back close reconciliation reads waste/count/correction evidence. */
const CLOSE_LEDGER_LOOKBACK_DAYS = 14;
const CLOSE_LEDGER_LIMIT = 500;

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
    data.providerMappings
  );
  await repository.replacePendingRecommendations(restaurantId, inserts);
}

/**
 * Refreshes recommendations and insights. When the cycle is `close`, also merges
 * waste / count-variance / carryover stock findings so the closing pass is not
 * identical to open and mid-shift recomputes.
 */
export async function regenerateOperationalSignals(
  restaurantId: string,
  options: { cycle?: RecalculationCycle } = {}
) {
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
    data.providerMappings
  );
  let insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    {},
    data.providerMappings
  );

  if (options.cycle === "close") {
    const since = `${addDaysToDateKey(data.operatingDate, -CLOSE_LEDGER_LOOKBACK_DAYS)}T00:00:00.000Z`;
    const events = await repository.listInventoryEvents(restaurantId, {
      eventTypes: ["waste", "count", "correction", "usage", "receipt", "adjustment", "transfer"],
      since,
      limit: CLOSE_LEDGER_LIMIT
    });
    const stockRiskItemIds = insights
      .filter(
        (insight) =>
          insight.presentation.code === "insight.rule.inventory.stock_risk" &&
          (insight.severity === "urgent" || insight.severity === "warning")
      )
      .map((insight) => insight.id.replace(/^insight_low_/, ""))
      .filter((id) => id.length > 0 && !id.startsWith("insight_"));

    const reconciliation = buildCloseReconciliation({
      restaurantId,
      operatingDate: data.operatingDate,
      restaurantTimeZone: data.timeZone,
      inventoryItems: data.inventoryItems,
      inventoryEvents: events,
      stockRiskItemIds,
      generatedAt: new Date().toISOString()
    });
    insights = mergeCloseReconciliationInsights(
      insights,
      closeReconciliationInsights(reconciliation)
    );
  }

  await repository.replaceOperationalSignals(restaurantId, recommendations, insights);
}
