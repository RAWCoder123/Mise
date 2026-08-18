import {
  buildInventoryOutlooks,
  buildDemoReadinessSummary,
  buildSetupReadinessSummary,
  buildTodaySummary
} from "../domain/miseDomain";
import {
  deriveOperationalTodayTasks,
  sortOperationalTodayTasks,
  type OperationalTodayTask
} from "../domain/todayTasks";
import {
  fetchOpenInventoryCountSession
} from "./inventory";
import {
  operationalTodayTaskFromRestaurantTask,
  visibleRestaurantTasksForToday
} from "../domain/restaurantTasks";
import type { InventoryStatus, TodaySummary } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  DEMO_DATASET,
  demandFallbackForRestaurant,
  isDemoDatasetRestaurantName
} from "../demoData";
import {
  fetchInventoryLedgerEvidence,
  inventoryCountEvidenceFor
} from "./inventoryEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export interface TodayInventoryHealthCounts {
  good: number;
  watch: number;
  low: number;
  critical: number;
}

/** Screen-ready Today data composed from restaurant-scoped authoritative sources. */
export interface TodayCommandCenterSummary extends TodaySummary {
  inventoryHealth: TodayInventoryHealthCounts;
  operationalTasks: OperationalTodayTask[];
  operatingDate: string;
  restaurantTimeZone: string;
  restaurantCurrency: string;
}

export async function fetchTodaySummary(
  restaurantId: string,
  options: { includeCompletedTasks?: boolean } = {}
): Promise<TodayCommandCenterSummary> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [
    data,
    ordersResult,
    emailConnectionResult,
    posIntegrationsResult,
    restaurantTasksResult,
    openCountSession,
    ledger
  ] =
    await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchSupplierOrders(normalizedRestaurantId),
    repository.fetchEmailConnectionState(normalizedRestaurantId),
    repository.fetchPosIntegrations(normalizedRestaurantId),
    repository.listRestaurantTasks(normalizedRestaurantId),
    fetchOpenInventoryCountSession(normalizedRestaurantId).catch(() => null),
    fetchInventoryLedgerEvidence(normalizedRestaurantId)
  ]);

  if (data.restaurant.id !== normalizedRestaurantId) {
    throw new Error("Today data failed restaurant scope validation.");
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
  if (restaurantTasksResult.some((task) => task.restaurantId !== normalizedRestaurantId)) {
    throw new Error("Today data failed restaurant task scope validation.");
  }
  const operatingDate = toDateKeyInTimeZone(new Date(), data.restaurant.timezone);
  const demandFallback = demandFallbackForRestaurant(normalizedRestaurantId);
  const countEvidence = inventoryCountEvidenceFor({
    restaurantId: normalizedRestaurantId,
    inventoryItems,
    ledgerEvents: ledger.events,
    ledgerComplete: ledger.complete,
    timeZone: data.restaurant.timezone
  });
  const outlooks = buildInventoryOutlooks(
    normalizedRestaurantId,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    demandFallback,
    countEvidence,
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
  const summary = buildTodaySummary(
    data.restaurant,
    sales,
    inventoryItems,
    recommendations,
    insights,
    mappings,
    operatingDate,
    demandFallback,
    countEvidence,
    data.providerMappings
  );

  const projectedTasks = deriveOperationalTodayTasks({
    restaurantId: normalizedRestaurantId,
    restaurantTimeZone: data.restaurant.timezone,
    inventoryOutlooks: outlooks,
    recommendations,
    orders,
    setupReadiness,
    posIntegrations,
    insights,
    openCountSession: openCountSession?.session ?? null,
    includeCompleted: options.includeCompletedTasks
  });
  const sharedTasks = visibleRestaurantTasksForToday(restaurantTasksResult, {
    includeCompleted: options.includeCompletedTasks
  }).map(operationalTodayTaskFromRestaurantTask);

  return {
    ...summary,
    inventoryHealth: inventoryHealthCounts(outlooks.map(({ prediction }) => prediction.projectedStatus)),
    operationalTasks: sortOperationalTodayTasks([...projectedTasks, ...sharedTasks], {
      restaurantTimeZone: data.restaurant.timezone
    }),
    operatingDate,
    restaurantTimeZone: data.restaurant.timezone,
    restaurantCurrency: data.restaurant.currency
  };
}

export async function fetchDemoReadinessSummary(restaurantId: string) {
  const [data, orders, ledger] = await Promise.all([
    repository.fetchRestaurantData(restaurantId),
    repository.fetchSupplierOrders(restaurantId),
    fetchInventoryLedgerEvidence(restaurantId)
  ]);
  return buildDemoReadinessSummary(
    data.restaurant,
    data.sales,
    data.inventoryItems,
    data.purchaseRecommendations,
    data.insights,
    data.menuItemIngredients,
    orders,
    {
      demandFallback: demandFallbackForRestaurant(restaurantId),
      demoProfileName: isDemoDatasetRestaurantName(data.restaurant.name)
        ? DEMO_DATASET.restaurant.name
        : null,
      countEvidence: inventoryCountEvidenceFor({
        restaurantId,
        inventoryItems: data.inventoryItems,
        ledgerEvents: ledger.events,
        ledgerComplete: ledger.complete,
        timeZone: data.restaurant.timezone
      })
    }
  );
}

export async function fetchSetupReadiness(restaurantId: string) {
  const [data, orders, emailConnection] = await Promise.all([
    repository.fetchRestaurantData(restaurantId),
    repository.fetchSupplierOrders(restaurantId),
    repository.fetchEmailConnectionState(restaurantId)
  ]);
  return buildSetupReadinessSummary({
    restaurant: data.restaurant,
    sales: data.sales,
    inventoryItems: data.inventoryItems,
    mappings: data.menuItemIngredients,
    orders,
    emailConnection
  });
}

function requireRestaurantScoped<T extends { restaurant_id: string }>(
  records: readonly T[],
  restaurantId: string
): T[] {
  if (records.some((record) => record.restaurant_id !== restaurantId)) {
    throw new Error("Today data failed restaurant scope validation.");
  }
  return [...records];
}

function inventoryHealthCounts(statuses: readonly InventoryStatus[]): TodayInventoryHealthCounts {
  return statuses.reduce<TodayInventoryHealthCounts>(
    (counts, status) => {
      if (status === "Good") counts.good += 1;
      else if (status === "Watch") counts.watch += 1;
      else if (status === "Low") counts.low += 1;
      else counts.critical += 1;
      return counts;
    },
    { good: 0, watch: 0, low: 0, critical: 0 }
  );
}
