import {
  buildInventoryOutlooks,
  buildSetupReadinessSummary
} from "../domain/miseDomain";
import {
  buildDailyOperatingPlan,
  prepWindowsFromProfile,
  type DailyOperatingPlan
} from "../domain/operatingPlan";
import { deriveOperationalTodayTasks } from "../domain/todayTasks";
import { visibleRestaurantTasksForToday } from "../domain/restaurantTasks";
import { demandFallbackForRestaurant } from "../demoData";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  fetchInventoryLedgerEvidence,
  inventoryCountEvidenceFor
} from "./inventoryEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export type { DailyOperatingPlan };

/**
 * Screen-ready Daily Operating Plan composed from restaurant-scoped
 * authoritative sources. Demo and hosted share the same pure builder.
 *
 * Codex seam: when central `restaurantTasks` land, merge those durable tasks
 * into `buildDailyOperatingPlan` inputs here (same tenant scope checks) without
 * changing the Today presentation contract.
 */
export async function fetchDailyOperatingPlan(
  restaurantId: string,
  options: { includeCompletedTasks?: boolean } = {}
): Promise<DailyOperatingPlan> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [
    data,
    ordersResult,
    emailConnectionResult,
    posIntegrationsResult,
    activityResult,
    centralTasksResult,
    ledger
  ] =
    await Promise.all([
      repository.fetchRestaurantData(normalizedRestaurantId),
      repository.fetchSupplierOrders(normalizedRestaurantId),
      repository.fetchEmailConnectionState(normalizedRestaurantId),
      repository.fetchPosIntegrations(normalizedRestaurantId),
      repository.listActivityEvents(normalizedRestaurantId, { limit: 80 }).catch(() => []),
      repository.listRestaurantTasks(normalizedRestaurantId),
      fetchInventoryLedgerEvidence(normalizedRestaurantId)
    ]);

  if (data.restaurant.id !== normalizedRestaurantId) {
    throw new Error("Operating plan failed restaurant scope validation.");
  }

  const sales = requireRestaurantScoped(data.sales, normalizedRestaurantId);
  const inventoryItems = requireRestaurantScoped(data.inventoryItems, normalizedRestaurantId);
  const recommendations = requireRestaurantScoped(
    data.purchaseRecommendations,
    normalizedRestaurantId
  );
  const insights = requireRestaurantScoped(data.insights, normalizedRestaurantId);
  const mappings = requireRestaurantScoped(data.menuItemIngredients, normalizedRestaurantId);
  const orders = requireRestaurantScoped(ordersResult, normalizedRestaurantId);
  const posIntegrations = requireRestaurantScoped(posIntegrationsResult, normalizedRestaurantId);
  const emailConnection = emailConnectionResult
    ? requireRestaurantScoped([emailConnectionResult], normalizedRestaurantId)[0] ?? null
    : null;
  const activityEvents = activityResult.filter(
    (event) => event.restaurantId === normalizedRestaurantId
  );
  const tenantCentralTasks = centralTasksResult.filter(
    (task) => task.restaurantId === normalizedRestaurantId
  );
  if (tenantCentralTasks.length !== centralTasksResult.length) {
    throw new Error("Operating plan failed restaurant task scope validation.");
  }
  const includeCompleted = options.includeCompletedTasks ?? true;
  const centralTasks = visibleRestaurantTasksForToday(tenantCentralTasks, { includeCompleted });

  const operatingDate = toDateKeyInTimeZone(new Date(), data.restaurant.timezone);
  const demandFallback = demandFallbackForRestaurant(normalizedRestaurantId);
  const outlooks = buildInventoryOutlooks(
    normalizedRestaurantId,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    demandFallback,
    inventoryCountEvidenceFor({
      restaurantId: normalizedRestaurantId,
      inventoryItems,
      ledgerEvents: ledger.events,
      ledgerComplete: ledger.complete,
      timeZone: data.restaurant.timezone
    }),
    data.providerMappings
  );
  const setupReadiness = buildSetupReadinessSummary({
    restaurant: data.restaurant,
    sales,
    inventoryItems,
    mappings,
    orders,
    emailConnection
  });
  const tasks = deriveOperationalTodayTasks({
    restaurantId: normalizedRestaurantId,
    restaurantTimeZone: data.restaurant.timezone,
    inventoryOutlooks: outlooks,
    recommendations,
    orders,
    setupReadiness,
    posIntegrations,
    insights,
    includeCompleted
  });

  return buildDailyOperatingPlan({
    restaurantId: normalizedRestaurantId,
    restaurantTimeZone: data.restaurant.timezone,
    operatingDate,
    prepWindows: prepWindowsFromProfile(data.restaurant.operational_profile),
    tasks,
    orders,
    recommendations,
    activityEvents,
    centralTasks
  });
}

function requireRestaurantScoped<T extends { restaurant_id: string }>(
  records: readonly T[],
  restaurantId: string
): T[] {
  if (records.some((record) => record.restaurant_id !== restaurantId)) {
    throw new Error("Operating plan failed restaurant scope validation.");
  }
  return [...records];
}
