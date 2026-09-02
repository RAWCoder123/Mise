import { buildDailyOperationalBrief } from "../domain/operationalFindings";
import { toDateKeyInTimeZone } from "../../utils/format";
import { fetchInventoryLedgerEvidence } from "./inventoryEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchDailyOperationalBrief(restaurantId: string) {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [restaurantData, decisions, ledger] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchOperationalFindingDecisions(normalizedRestaurantId),
    fetchInventoryLedgerEvidence(normalizedRestaurantId)
  ]);

  return buildDailyOperationalBrief({
    restaurantId: normalizedRestaurantId,
    operatingDate: toDateKeyInTimeZone(new Date(), restaurantData.restaurant.timezone),
    sales: restaurantData.sales,
    inventoryItems: restaurantData.inventoryItems,
    mappings: restaurantData.menuItemIngredients,
    providerMappings: restaurantData.providerMappings,
    recommendations: restaurantData.purchaseRecommendations,
    insights: restaurantData.insights,
    decisions,
    inventoryLedgerEvents: ledger.events,
    ledgerComplete: ledger.complete
  });
}
