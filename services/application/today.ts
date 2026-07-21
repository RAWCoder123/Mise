import {
  buildInventoryOutlooks,
  buildDemoReadinessSummary,
  buildSetupReadinessSummary,
  buildTodaySummary
} from "../domain/miseDomain";
import {
  deriveOperationalTodayTasks,
  type OperationalTodayTask
} from "../domain/todayTasks";
import type { InventoryStatus, TodaySummary } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";
import {
  DEMO_DATASET,
  demandFallbackForRestaurant,
  isDemoDatasetRestaurantName
} from "../demoData";
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

export async function fetchTodaySummary(restaurantId: string): Promise<TodayCommandCenterSummary> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const [data, ordersResult, emailConnectionResult, posIntegrationsResult] = await Promise.all([
    repository.fetchRestaurantData(normalizedRestaurantId),
    repository.fetchSupplierOrders(normalizedRestaurantId),
    repository.fetchEmailConnectionState(normalizedRestaurantId),
    repository.fetchPosIntegrations(normalizedRestaurantId)
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
  const operatingDate = toDateKeyInTimeZone(new Date(), data.restaurant.timezone);
  const demandFallback = demandFallbackForRestaurant(normalizedRestaurantId);
  const outlooks = buildInventoryOutlooks(
    normalizedRestaurantId,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    demandFallback
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
    demandFallback
  );

  return {
    ...summary,
    inventoryHealth: inventoryHealthCounts(outlooks.map(({ prediction }) => prediction.projectedStatus)),
    operationalTasks: deriveOperationalTodayTasks({
      restaurantId: normalizedRestaurantId,
      restaurantTimeZone: data.restaurant.timezone,
      inventoryOutlooks: outlooks,
      recommendations,
      orders,
      setupReadiness,
      posIntegrations,
      insights
    }),
    operatingDate,
    restaurantTimeZone: data.restaurant.timezone,
    restaurantCurrency: data.restaurant.currency
  };
}

export async function fetchDemoReadinessSummary(restaurantId: string) {
  const [data, orders] = await Promise.all([
    repository.fetchRestaurantData(restaurantId),
    repository.fetchSupplierOrders(restaurantId)
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
        : null
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
