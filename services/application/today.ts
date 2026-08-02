import {
  buildInventoryOutlooks,
  buildDemoReadinessSummary,
  buildRecipeBaselineSummary,
  buildSetupReadinessSummary,
  buildTodaySummary
} from "../domain/miseDomain";
import {
  deriveOperationalTodayTasks,
  type OperationalTodayTask
} from "../domain/todayTasks";
import {
  buildChronicAcceptanceEditInsightInput,
  buildAcceptanceEditBiasByItem,
  extractAcceptanceEditSamplesFromRecommendations
} from "../domain/acceptanceEditLearning";
import {
  buildChronicDismissalInsightInput,
  buildDismissalFeedbackByItem,
  extractDismissalSamplesFromRecommendations
} from "../domain/recommendationDismissalLearning";
import {
  buildChronicShortShipInsightInput,
  buildReceiveFillBiasByItem
} from "../domain/receiveDiscrepancyLearning";
import {
  buildChronicCountShrinkInsightInput,
  buildChronicManagerCorrectionInsightInput,
  buildChronicWasteInsightInput,
  buildCountShrinkBiasByItem,
  buildManagerCorrectionBiasByItem,
  buildWasteBiasByItem
} from "../domain/wasteVarianceLearning";
import type { InventoryStatus, TodaySummary } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";
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

  const [data, ordersResult, emailConnectionResult, posIntegrationsResult, planning, openCountSession] =
    await Promise.all([
      repository.fetchRestaurantData(normalizedRestaurantId),
      repository.fetchSupplierOrders(normalizedRestaurantId),
      repository.fetchEmailConnectionState(normalizedRestaurantId),
      repository.fetchPosIntegrations(normalizedRestaurantId),
      repository.fetchPlanningData(normalizedRestaurantId),
      repository.fetchOpenInventoryCountSession(normalizedRestaurantId)
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
  const operatingDate = planning.operatingDate || toDateKeyInTimeZone(new Date(), data.restaurant.timezone);
  const outlooks = buildInventoryOutlooks(
    normalizedRestaurantId,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    planning.appliedTodayConsumptionByItemId
  );
  const setupReadiness = buildSetupReadinessSummary({
    restaurant: data.restaurant,
    sales,
    inventoryItems,
    mappings,
    orders,
    emailConnection
  });
  const recipeBaseline = buildRecipeBaselineSummary(
    normalizedRestaurantId,
    sales,
    mappings,
    inventoryItems,
    operatingDate
  );
  const summary = buildTodaySummary(
    data.restaurant,
    sales,
    inventoryItems,
    recommendations,
    insights,
    mappings,
    operatingDate,
    planning.appliedTodayConsumptionByItemId
  );
  const receiveBiasByItem = buildReceiveFillBiasByItem(planning.receivingHistory ?? []);
  const chronicShortShipItems = inventoryItems.flatMap((item) => {
    const bias = receiveBiasByItem.get(item.id);
    const marker = bias ? buildChronicShortShipInsightInput(bias) : null;
    if (!bias || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      supplierName: item.supplier_name,
      fillPercent: marker.fillPercent,
      sampleCount: bias.sampleCount
    }];
  });
  const wasteBiasByItem = buildWasteBiasByItem(planning.wasteHistory ?? []);
  const chronicWasteItems = inventoryItems.flatMap((item) => {
    const bias = wasteBiasByItem.get(item.id);
    const marker = bias ? buildChronicWasteInsightInput(bias) : null;
    if (!bias || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      lossPercent: marker.lossPercent,
      sampleCount: bias.sampleCount
    }];
  });
  const countShrinkBiasByItem = buildCountShrinkBiasByItem(planning.countVarianceHistory ?? []);
  const chronicCountShrinkItems = inventoryItems.flatMap((item) => {
    const bias = countShrinkBiasByItem.get(item.id);
    const marker = bias ? buildChronicCountShrinkInsightInput(bias) : null;
    if (!bias || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      lossPercent: marker.lossPercent,
      sampleCount: bias.sampleCount
    }];
  });
  const managerCorrectionBiasByItem = buildManagerCorrectionBiasByItem(
    planning.managerCorrectionHistory ?? []
  );
  const chronicManagerCorrectionItems = inventoryItems.flatMap((item) => {
    const bias = managerCorrectionBiasByItem.get(item.id);
    const marker = bias ? buildChronicManagerCorrectionInsightInput(bias) : null;
    if (!bias || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      lossPercent: marker.lossPercent,
      sampleCount: bias.sampleCount
    }];
  });
  const acceptanceEditBiasByItem = buildAcceptanceEditBiasByItem(
    extractAcceptanceEditSamplesFromRecommendations(recommendations)
  );
  const chronicAcceptanceEditItems = inventoryItems.flatMap((item) => {
    const bias = acceptanceEditBiasByItem.get(item.id);
    const marker = bias ? buildChronicAcceptanceEditInsightInput(bias) : null;
    if (!bias || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      acceptPercent: marker.acceptPercent,
      direction: marker.direction,
      sampleCount: bias.sampleCount
    }];
  });
  const dismissalFeedbackByItem = buildDismissalFeedbackByItem(
    extractDismissalSamplesFromRecommendations(recommendations)
  );
  const chronicDismissalItems = inventoryItems.flatMap((item) => {
    const feedback = dismissalFeedbackByItem.get(item.id);
    const marker = feedback ? buildChronicDismissalInsightInput(feedback) : null;
    if (!feedback || !marker) return [];
    return [{
      inventoryItemId: item.id,
      itemName: item.item_name,
      category: marker.category,
      sampleCount: marker.sampleCount,
      categoryCount: marker.categoryCount
    }];
  });

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
      unmappedPosMenuItems: recipeBaseline.posItemsMissingRecipes,
      incompatibleRecipeMenuItems: recipeBaseline.posItemsWithIncompatibleUnits,
      chronicShortShipItems,
      chronicWasteItems,
      chronicCountShrinkItems,
      chronicManagerCorrectionItems,
      chronicAcceptanceEditItems,
      chronicDismissalItems,
      insights,
      openCountSession: openCountSession?.session ?? null
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
    orders
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
