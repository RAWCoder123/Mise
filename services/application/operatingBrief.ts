import { buildInventoryOutlooks } from "../domain/miseDomain";
import { buildOperatingBrief, type OperatingBrief } from "../domain/operatingBrief";
import { buildDailyOperationalBrief } from "../domain/operationalFindings";
import { demandFallbackForRestaurant, isDemoDatasetRestaurantName } from "../demoData";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  fetchInventoryLedgerEvidence,
  inventoryCountEvidenceFor
} from "./inventoryEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { OperatingBrief };

export async function fetchOperatingBrief(
  restaurantId: string,
  options: { lastSeenAt?: string | null } = {}
): Promise<OperatingBrief> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  // Auxiliary feeds (activity, awaiting decisions, finding decisions) must fail
  // closed with the brief. Swallowing them as [] hides approvals and invents an
  // empty "what changed" feed while the hub still looks healthy.
  const [data, orders, activityEvents, miseActions, findingDecisions, ledger] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchSupplierOrders(normalizedRestaurantId),
    repository.listActivityEvents(normalizedRestaurantId, { limit: 80 }),
    repository.listMiseActions(normalizedRestaurantId, { status: "awaiting_decision", limit: 40 }),
    repository.fetchOperationalFindingDecisions(normalizedRestaurantId),
    fetchInventoryLedgerEvidence(normalizedRestaurantId)
  ]);

  if (data.restaurant.id !== normalizedRestaurantId) {
    throw new Error("Operating brief failed restaurant scope validation.");
  }

  const operatingDate = toDateKeyInTimeZone(new Date(), data.restaurant.timezone);
  const demandFallback = demandFallbackForRestaurant(normalizedRestaurantId);
  const countEvidence = inventoryCountEvidenceFor({
    restaurantId: normalizedRestaurantId,
    inventoryItems: data.inventoryItems,
    ledgerEvents: ledger.events,
    ledgerComplete: ledger.complete,
    timeZone: data.restaurant.timezone
  });
  const inventoryOutlooks = buildInventoryOutlooks(
    normalizedRestaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    operatingDate,
    demandFallback,
    countEvidence,
    data.providerMappings
  );
  const findings = buildDailyOperationalBrief({
    restaurantId: normalizedRestaurantId,
    operatingDate,
    sales: data.sales,
    inventoryItems: data.inventoryItems,
    mappings: data.menuItemIngredients,
    providerMappings: data.providerMappings,
    recommendations: data.purchaseRecommendations,
    insights: data.insights,
    decisions: findingDecisions,
    inventoryLedgerEvents: ledger.events,
    ledgerComplete: ledger.complete
  }).findings;

  return buildOperatingBrief({
    restaurant: data.restaurant,
    operatingDate,
    lastSeenAt: options.lastSeenAt ?? null,
    sales: data.sales,
    inventoryItems: data.inventoryItems,
    recommendations: data.purchaseRecommendations,
    orders,
    insights: data.insights,
    findings,
    activityEvents,
    miseActions,
    inventoryOutlooks,
    demoLabeled: isDemoDatasetRestaurantName(data.restaurant.name)
  });
}
