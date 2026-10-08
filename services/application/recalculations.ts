import {
  enrichInsightsWithCloseReconciliation
} from "../domain/closeReconciliation";
import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import type { RecalculationCycle } from "../domain/recalculationSchedule";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/**
 * Close variance needs prior baselines and intervening usage/receipts. A short
 * calendar lookback can drop that evidence and invent blocked or material
 * results. Match the inventory-evidence bound and report incompleteness when
 * the read hits the ceiling instead of pretending the history is whole.
 */
export const CLOSE_RECONCILIATION_LEDGER_LIMIT = 2000;

const CLOSE_LEDGER_EVENT_TYPES = [
  "waste",
  "count",
  "correction",
  "usage",
  "receipt",
  "adjustment",
  "transfer"
] as const;

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
 *
 * Demo persists the enriched insights directly. Hosted mode passes `cycle` into
 * operational-workflows so the Edge refresh recomputes and merges the same
 * close findings server-side instead of discarding client-computed evidence.
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
    const events = await repository.listInventoryEvents(restaurantId, {
      eventTypes: [...CLOSE_LEDGER_EVENT_TYPES],
      limit: CLOSE_RECONCILIATION_LEDGER_LIMIT
    });
    const enriched = enrichInsightsWithCloseReconciliation({
      restaurantId,
      operatingDate: data.operatingDate,
      restaurantTimeZone: data.timeZone,
      inventoryItems: data.inventoryItems,
      inventoryEvents: events,
      ledgerComplete: events.length < CLOSE_RECONCILIATION_LEDGER_LIMIT,
      planningInsights: insights,
      generatedAt: new Date().toISOString()
    });
    insights = enriched.insights;
  }

  await repository.replaceOperationalSignals(restaurantId, recommendations, insights, {
    cycle: options.cycle
  });
}
