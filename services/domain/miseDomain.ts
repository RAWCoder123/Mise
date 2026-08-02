import type {
  AttentionCard,
  DemoReadinessCheck,
  DemoReadinessSummary,
  DemoReadinessStatus,
  DemoWalkthroughCheck,
  ConditionalAnalyticsSummary,
  Insight,
  InsightSeverity,
  InsightSummary,
  LearningMemorySummary,
  InventoryControlSummary,
  InventoryItem,
  InventoryOutlookItem,
  InventoryPrediction,
  InventoryStatus,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation,
  OrderQueueSummary,
  RecipeBaselineSummary,
  RecommendationStatus,
  Restaurant,
  RestaurantEmailConnection,
  SetupReadinessSummary,
  SetupReadinessStatus,
  SupplierEmailPayload,
  SupplierOrder,
  SupplierRecipient,
  SupplierOrderStatus,
  TodaySummary,
  Urgency
} from "../../types/mise";
import { formatQuantity, nextDateKeyInTimeZone, toDateKey, toDateKeyInTimeZone } from "../../utils/format";
import { getInventoryStatus, getInventoryStatusForQuantity } from "../../utils/inventory";
import { ORDER_MESSAGE_MAX_BYTES, truncateUtf8 } from "./securityLimits";
import { inventoryUnitsAreCompatible } from "./inventoryUnits";
import {
  buildAppliedTodayConsumptionByItemId,
  projectedQuantityAfterSales
} from "./posConsumption";
import {
  applyReceiveFillBias,
  buildChronicShortShipInsightInput,
  buildReceiveFillBiasByItem,
  extractReceiveSamplesFromMovements,
  receiveFillBiasReasonFragment
} from "./receiveDiscrepancyLearning";
import {
  applyLossBias,
  buildChronicCountShrinkInsightInput,
  buildChronicManagerCorrectionInsightInput,
  buildChronicWasteInsightInput,
  buildCountShrinkBiasByItem,
  buildManagerCorrectionBiasByItem,
  buildWasteBiasByItem,
  extractCountVarianceSamplesFromMovements,
  extractManagerCorrectionSamplesFromMovements,
  extractWasteSamplesFromMovements,
  lossBiasReasonFragment
} from "./wasteVarianceLearning";
import { buildRecordedSalesTrend } from "./salesTrends";
import {
  DEMO_DATASET,
  DEMO_RESTAURANT_ID,
  DEMO_RESTAURANT_TIME_ZONE,
  isDemoDatasetRestaurantName,
  salesBaselines,
  type DemoState
} from "../demoData";

function defaultOperatingDate(restaurantId: string) {
  return restaurantId === DEMO_RESTAURANT_ID
    ? toDateKeyInTimeZone(new Date(), DEMO_RESTAURANT_TIME_ZONE)
    : toDateKey(new Date());
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isToday(sale: PosSale, operatingDate = toDateKey(new Date())) {
  return sale.sale_date === operatingDate;
}

function roundOrderQuantity(value: number) {
  return Math.max(1, Math.ceil(value));
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export interface HistoricalDemandBaseline {
  dailyQuantity: number;
  sampleDays: number;
  observedDays: number;
}

const historicalDemandServiceDays = 28;
const minimumHistoricalServiceDays = 7;
const minimumObservedItemDays = 3;

export function buildHistoricalDemandBaselines(
  restaurantId: string,
  sales: PosSale[],
  operatingDate = defaultOperatingDate(restaurantId)
): Map<string, HistoricalDemandBaseline> {
  const historicalSales = sales.filter(
    (sale) =>
      sale.restaurant_id === restaurantId &&
      sale.sale_date < operatingDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(sale.sale_date) &&
      Number.isFinite(sale.quantity_sold) &&
      sale.quantity_sold > 0
  );
  const serviceDays = [...new Set(historicalSales.map((sale) => sale.sale_date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, historicalDemandServiceDays);
  if (serviceDays.length < minimumHistoricalServiceDays) return new Map();

  const selectedDays = new Set(serviceDays);
  const quantitiesByItemAndDay = new Map<string, Map<string, number>>();
  historicalSales
    .filter((sale) => selectedDays.has(sale.sale_date))
    .forEach((sale) => {
      const itemKey = normalizeMenuItemKey(sale.item_name);
      if (!itemKey) return;
      const daily = quantitiesByItemAndDay.get(itemKey) ?? new Map<string, number>();
      daily.set(sale.sale_date, (daily.get(sale.sale_date) ?? 0) + sale.quantity_sold);
      quantitiesByItemAndDay.set(itemKey, daily);
    });

  const baselines = new Map<string, HistoricalDemandBaseline>();
  quantitiesByItemAndDay.forEach((daily, itemKey) => {
    if (daily.size < minimumObservedItemDays) return;
    const serviceDayQuantities = serviceDays.map((date) => daily.get(date) ?? 0);
    const dailyQuantity = robustDailyAverage(serviceDayQuantities);
    if (!Number.isFinite(dailyQuantity) || dailyQuantity <= 0) return;
    baselines.set(itemKey, {
      dailyQuantity,
      sampleDays: serviceDays.length,
      observedDays: daily.size
    });
  });
  return baselines;
}

function robustDailyAverage(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const trimCount = sorted.length >= 10 ? Math.max(1, Math.floor(sorted.length * 0.1)) : 1;
  const trimmed = sorted.length - trimCount * 2 >= 3
    ? sorted.slice(trimCount, sorted.length - trimCount)
    : sorted;
  return Math.round((trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length) * 10000) / 10000;
}

function normalizeMenuItemKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function recommendationReason(item: InventoryItem, prediction?: InventoryPrediction) {
  if (prediction) {
    return `${prediction.coverageLabel}. ${prediction.whyItMatters}`;
  }
  return `${item.item_name} ${verbForItem(item.item_name)} below reorder level. Mise recommends bringing it back to par before the next rush.`;
}

function learnedRecommendationReason(
  item: InventoryItem,
  prediction: InventoryPrediction,
  learnedQuantity: number | undefined,
  receiveBiasReason?: string
) {
  const reason = recommendationReason(item, prediction);
  const withApprovalLearning =
    learnedQuantity === undefined || learnedQuantity === prediction.suggestedOrderQuantity
      ? reason
      : `${reason} Mise is using a stable median from recent approved orders: ${formatQuantity(learnedQuantity)} ${item.unit}.`;
  return receiveBiasReason ? `${withApprovalLearning} ${receiveBiasReason}` : withApprovalLearning;
}

export type StackedOrderLearningResult = {
  recommendedQuantity: number;
  learnedQuantity: number | undefined;
  reasonFragments: string[];
};

/**
 * Apply approval-median, receive-fill, waste, and count-shrink learning in the same
 * order used by generated recommendation rebuilds. Manual "Add to order" must use
 * this so operator-initiated drafts match restaurant-learning behavior.
 */
export function applyStackedOrderLearning(input: {
  item: InventoryItem;
  prediction: InventoryPrediction;
  learnedQuantities: Map<string, number>;
  receiveBias?: ReturnType<typeof buildReceiveFillBiasByItem> extends Map<string, infer V> ? V : never;
  wasteBias?: ReturnType<typeof buildWasteBiasByItem> extends Map<string, infer V> ? V : never;
  countShrinkBias?: ReturnType<typeof buildCountShrinkBiasByItem> extends Map<string, infer V>
    ? V
    : never;
  managerCorrectionBias?: ReturnType<typeof buildManagerCorrectionBiasByItem> extends Map<
    string,
    infer V
  >
    ? V
    : never;
}): StackedOrderLearningResult {
  const learnedQuantity = boundedLearnedQuantity(
    input.item,
    input.prediction,
    input.learnedQuantities
  );
  const afterApprovalLearning = learnedQuantity ?? input.prediction.suggestedOrderQuantity;
  const bounds = {
    calculated: input.prediction.suggestedOrderQuantity,
    par: input.item.par_level
  };
  const afterReceive = applyReceiveFillBias(afterApprovalLearning, input.receiveBias, bounds);
  const afterWaste = applyLossBias(afterReceive ?? afterApprovalLearning, input.wasteBias, bounds);
  const afterShrink = applyLossBias(
    afterWaste ?? afterReceive ?? afterApprovalLearning,
    input.countShrinkBias,
    bounds
  );
  const afterManagerCorrection = applyLossBias(
    afterShrink ?? afterWaste ?? afterReceive ?? afterApprovalLearning,
    input.managerCorrectionBias,
    bounds
  );
  const recommendedQuantity =
    afterManagerCorrection ??
    afterShrink ??
    afterWaste ??
    afterReceive ??
    afterApprovalLearning;
  const reasonFragments: string[] = [];
  if (
    input.receiveBias?.isChronic &&
    afterReceive != null &&
    afterReceive !== afterApprovalLearning
  ) {
    reasonFragments.push(receiveFillBiasReasonFragment(input.receiveBias));
  }
  if (
    input.wasteBias?.isChronic &&
    afterWaste != null &&
    afterWaste !== (afterReceive ?? afterApprovalLearning)
  ) {
    reasonFragments.push(lossBiasReasonFragment(input.wasteBias));
  }
  if (
    input.countShrinkBias?.isChronic &&
    afterShrink != null &&
    afterShrink !== (afterWaste ?? afterReceive ?? afterApprovalLearning)
  ) {
    reasonFragments.push(lossBiasReasonFragment(input.countShrinkBias));
  }
  if (
    input.managerCorrectionBias?.isChronic &&
    afterManagerCorrection != null &&
    afterManagerCorrection !==
      (afterShrink ?? afterWaste ?? afterReceive ?? afterApprovalLearning)
  ) {
    reasonFragments.push(lossBiasReasonFragment(input.managerCorrectionBias));
  }
  return { recommendedQuantity, learnedQuantity, reasonFragments };
}

/**
 * Plan a single pending recommendation for an explicit operator "Add to order"
 * action. Unlike rebuild filters, this does not require Critical/Low status.
 */
export function planManualPendingRecommendation(input: {
  restaurantId: string;
  item: InventoryItem;
  prediction: InventoryPrediction;
  recommendationHistory?: PurchaseRecommendation[];
  receivingHistory?: Parameters<typeof buildReceiveFillBiasByItem>[0];
  wasteHistory?: Parameters<typeof buildWasteBiasByItem>[0];
  countVarianceHistory?: Parameters<typeof buildCountShrinkBiasByItem>[0];
  managerCorrectionHistory?: Parameters<typeof buildManagerCorrectionBiasByItem>[0];
}): {
  recommended_quantity: number;
  reason: string;
  urgency: Urgency;
} {
  const learnedQuantities = buildLearnedOrderQuantities(
    input.restaurantId,
    input.recommendationHistory ?? []
  );
  const receiveBias = buildReceiveFillBiasByItem(input.receivingHistory ?? []).get(input.item.id);
  const wasteBias = buildWasteBiasByItem(input.wasteHistory ?? []).get(input.item.id);
  const countShrinkBias = buildCountShrinkBiasByItem(input.countVarianceHistory ?? []).get(
    input.item.id
  );
  const managerCorrectionBias = buildManagerCorrectionBiasByItem(
    input.managerCorrectionHistory ?? []
  ).get(input.item.id);
  const learned = applyStackedOrderLearning({
    item: input.item,
    prediction: input.prediction,
    learnedQuantities,
    receiveBias,
    wasteBias,
    countShrinkBias,
    managerCorrectionBias
  });
  return {
    recommended_quantity: learned.recommendedQuantity,
    reason: learnedRecommendationReason(
      input.item,
      input.prediction,
      learned.learnedQuantity,
      learned.reasonFragments.length ? learned.reasonFragments.join(" ") : undefined
    ),
    urgency: input.prediction.urgency
  };
}

function buildLearnedOrderQuantities(restaurantId: string, history: PurchaseRecommendation[] = []) {
  const samples = new Map<string, Array<{ quantity: number; createdAt: string }>>();
  history
    .filter((recommendation) => recommendation.restaurant_id === restaurantId)
    .filter((recommendation) => recommendation.status === "approved" || recommendation.status === "ordered")
    .filter((recommendation) => Number.isFinite(recommendation.recommended_quantity) && recommendation.recommended_quantity > 0)
    .forEach((recommendation) => {
      const key = learnedQuantityKey(recommendation.inventory_item_id, recommendation.unit);
      const current = samples.get(key) ?? [];
      current.push({
          quantity: recommendation.recommended_quantity,
          createdAt: recommendation.created_at
      });
      samples.set(key, current);
    });

  const learned = new Map<string, number>();
  samples.forEach((entries, key) => {
    const ordered = entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const now = Date.now();
    const oldestAccepted = now - 180 * 24 * 60 * 60 * 1000;
    const newestAccepted = now + 24 * 60 * 60 * 1000;
    const recent = ordered
      .filter((entry) => {
        const createdAt = new Date(entry.createdAt).getTime();
        return Number.isFinite(createdAt) && createdAt >= oldestAccepted && createdAt <= newestAccepted;
      })
      .slice(0, 8)
      .map((entry) => entry.quantity)
      .sort((a, b) => a - b);
    if (recent.length < 3) return;
    const middle = Math.floor(recent.length / 2);
    const median = recent.length % 2 === 0
      ? (recent[middle - 1]! + recent[middle]!) / 2
      : recent[middle]!;
    if (Number.isFinite(median)) learned.set(key, median);
  });
  return learned;
}

function learnedQuantityKey(itemId: string, unit: string) {
  return `${itemId}::${unit.trim().toLowerCase()}`;
}

function boundedLearnedQuantity(
  item: InventoryItem,
  prediction: InventoryPrediction,
  learnedQuantities: Map<string, number>
) {
  const learned = learnedQuantities.get(learnedQuantityKey(item.id, item.unit));
  if (learned === undefined) return undefined;
  const calculated = Math.max(1, prediction.suggestedOrderQuantity);
  const maximum = Math.max(calculated * 1.75, item.par_level * 1.25, 1);
  const minimum = Math.max(1, calculated * 0.5);
  if (learned < minimum || learned > maximum) return undefined;
  return Math.max(1, Math.ceil(learned));
}

function isHandledRecommendation(recommendation: PurchaseRecommendation) {
  return recommendation.status === "approved" || recommendation.status === "dismissed" || recommendation.status === "ordered";
}

function latestHandledRecommendationForItem(
  restaurantId: string,
  itemId: string,
  history: PurchaseRecommendation[] = []
) {
  return history
    .filter((recommendation) => recommendation.restaurant_id === restaurantId)
    .filter((recommendation) => recommendation.inventory_item_id === itemId)
    .filter(isHandledRecommendation)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function shouldSuppressRecommendationForItem(
  restaurantId: string,
  item: InventoryItem,
  history: PurchaseRecommendation[] = []
) {
  const handled = latestHandledRecommendationForItem(restaurantId, item.id, history);
  if (!handled) return false;
  return handled.created_at.localeCompare(item.last_updated) >= 0;
}

function verbForItem(itemName: string) {
  const normalized = itemName.trim().toLowerCase();
  if (normalized.endsWith("s") && !normalized.endsWith("mix")) return "are";
  return "is";
}

export function buildInventoryOutlooks(
  restaurantId: string,
  inventoryItems: InventoryItem[],
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  operatingDate = defaultOperatingDate(restaurantId),
  appliedTodayConsumptionByItemId: ReadonlyMap<string, number> | Record<string, number> = {}
): InventoryOutlookItem[] {
  const historicalBaselines = buildHistoricalDemandBaselines(restaurantId, sales, operatingDate);
  const appliedLookup =
    appliedTodayConsumptionByItemId instanceof Map
      ? appliedTodayConsumptionByItemId
      : new Map(Object.entries(appliedTodayConsumptionByItemId));
  return inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .map((item) => ({
      item,
      prediction: buildInventoryPrediction(item, sales, mappings, operatingDate, historicalBaselines, {
        appliedTodayConsumption: appliedLookup.get(item.id) ?? 0
      })
    }))
    .sort((a, b) => {
      const rankDelta = predictionRank(b.prediction) - predictionRank(a.prediction);
      if (rankDelta !== 0) return rankDelta;

      const aCoverage = a.prediction.daysCoverage ?? Number.POSITIVE_INFINITY;
      const bCoverage = b.prediction.daysCoverage ?? Number.POSITIVE_INFINITY;
      if (aCoverage !== bCoverage) return aCoverage - bCoverage;

      return a.item.item_name.localeCompare(b.item.item_name);
    });
}

export function buildInventoryControlSummary(
  restaurantId: string,
  outlooks: InventoryOutlookItem[]
): InventoryControlSummary {
  const restaurantOutlooks = outlooks.filter(({ item }) => item.restaurant_id === restaurantId);
  const statusCounts = restaurantOutlooks.reduce(
    (current, { prediction }) => {
      current[prediction.projectedStatus] += 1;
      return current;
    },
    { Critical: 0, Low: 0, Watch: 0, Good: 0 } satisfies Record<InventoryStatus, number>
  );
  const categoryCounts = restaurantOutlooks.reduce(
    (current, { item }) => {
      const category = item.category.toLowerCase();
      if (category.includes("protein")) current.proteins += 1;
      else if (category.includes("produce")) current.produce += 1;
      else if (category.includes("dry")) current.dryGoods += 1;
      else if (category.includes("dairy")) current.dairy += 1;
      else current.other += 1;
      return current;
    },
    { proteins: 0, produce: 0, dryGoods: 0, dairy: 0, other: 0 }
  );
  const needOrderCount = statusCounts.Critical + statusCounts.Low;
  const readinessLabel =
    needOrderCount > 0
      ? "Order risk is visible"
      : statusCounts.Watch > 0
        ? "Counts need a look"
        : "Inventory is holding";
  const operatorCopy =
    needOrderCount > 0
      ? `Mise found ${needOrderCount} item${needOrderCount === 1 ? "" : "s"} near reorder risk across the kitchen.`
      : statusCounts.Watch > 0
        ? `Mise found ${statusCounts.Watch} watch item${statusCounts.Watch === 1 ? "" : "s"} that may need a count update.`
        : "Mise is not seeing immediate supplier risk in current projected stock.";
  const nextStep =
    statusCounts.Critical > 0
      ? "Update counts and review supplier recommendations before the next service window."
      : needOrderCount > 0
        ? "Review low coverage items and add what you want to the supplier queue."
        : statusCounts.Watch > 0
          ? "Confirm watch-list counts before approving any extra purchasing."
          : "Keep counts current after service so Mise can maintain reorder timing.";

  return {
    itemCount: restaurantOutlooks.length,
    wellStockedPercent:
      restaurantOutlooks.length > 0
        ? Math.round((statusCounts.Good / restaurantOutlooks.length) * 100)
        : 0,
    needOrderCount,
    criticalCount: statusCounts.Critical,
    lowCount: statusCounts.Low,
    watchCount: statusCounts.Watch,
    stableCount: statusCounts.Good,
    categoryCounts,
    readinessLabel,
    operatorCopy,
    nextStep
  };
}

export function buildInventoryPrediction(
  item: InventoryItem,
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  operatingDate = defaultOperatingDate(item.restaurant_id),
  historicalBaselines = buildHistoricalDemandBaselines(item.restaurant_id, sales, operatingDate),
  options?: { appliedTodayConsumption?: number }
): InventoryPrediction {
  const safeItem: InventoryItem = {
    ...item,
    current_quantity: finiteNonNegative(item.current_quantity),
    par_level: finiteNonNegative(item.par_level),
    reorder_threshold: finiteNonNegative(item.reorder_threshold)
  };
  const todaySales = sales.filter(
    (sale) => sale.restaurant_id === item.restaurant_id && isToday(sale, operatingDate)
  );
  const relevantMappings = mappings.filter(
    (mapping) =>
      mapping.restaurant_id === item.restaurant_id &&
      mapping.inventory_item_id === item.id &&
      inventoryUnitsAreCompatible(safeItem.unit, mapping.unit)
  );
  const recentUsage = relevantMappings.reduce((sum, mapping) => {
    const sold = todaySales
      .filter((sale) => normalizeMenuItemKey(sale.item_name) === normalizeMenuItemKey(mapping.menu_item_name))
      .reduce((saleSum, sale) => saleSum + finiteNonNegative(sale.quantity_sold), 0);
    return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
  }, 0);
  let historySampleDays = 0;
  let hasRestaurantHistory = false;
  let hasDemoFallback = false;
  const baselineUsage = relevantMappings.reduce((sum, mapping) => {
    const learned = historicalBaselines.get(normalizeMenuItemKey(mapping.menu_item_name));
    if (learned) {
      historySampleDays = Math.max(historySampleDays, learned.sampleDays);
      hasRestaurantHistory = true;
    }
    const demoFallback = item.restaurant_id === DEMO_RESTAURANT_ID
      ? salesBaselines[mapping.menu_item_name] ?? 0
      : 0;
    if (!learned && demoFallback > 0) hasDemoFallback = true;
    const baseline = learned?.dailyQuantity ?? demoFallback;
    return sum + baseline * finiteNonNegative(mapping.quantity_used_per_sale);
  }, 0);
  const averageDailyUsage =
    recentUsage > 0 && baselineUsage > 0
      ? recentUsage * 0.35 + baselineUsage * 0.65
      : recentUsage || baselineUsage;
  const appliedTodayConsumption = finiteNonNegative(options?.appliedTodayConsumption ?? 0);
  const { projectedQuantity } = projectedQuantityAfterSales(
    safeItem.current_quantity,
    recentUsage,
    appliedTodayConsumption
  );
  const daysCoverage = averageDailyUsage > 0 ? projectedQuantity / averageDailyUsage : null;
  const projectedStatus = getInventoryStatusForQuantity(safeItem, projectedQuantity);
  const demandTrend = getDemandTrend(recentUsage, baselineUsage);
  const suggestedOrderQuantity = roundOrderQuantity(safeItem.par_level - projectedQuantity);
  const coverageLabel = getCoverageLabel(safeItem, daysCoverage, averageDailyUsage, projectedQuantity);
  const trendLabel = getTrendLabel(demandTrend);
  const suggestedAction = getSuggestedAction(safeItem, suggestedOrderQuantity, daysCoverage, projectedStatus);
  const urgency = projectedStatus === "Critical" ? "high" : projectedStatus === "Low" ? "medium" : "low";
  const historySource: InventoryPrediction["historySource"] = hasRestaurantHistory
    ? "restaurant_history"
    : hasDemoFallback
      ? "demo_fallback"
      : recentUsage > 0
        ? "current_day"
        : "none";
  const basis = hasRestaurantHistory
    ? recentUsage > 0
      ? `Based on today's mapped POS sales and ${historySampleDays} recent service days`
      : `Based on ${historySampleDays} recent service days mapped through recipe baselines`
    : hasDemoFallback
      ? "Based on the demo demand pattern and mapped recipe baselines"
      : recentUsage > 0
        ? "Based on today's POS sales mapped through recipe baselines"
        : "Mise is still learning this item";
  const depletionCopy =
    recentUsage > 0
      ? `POS sales have depleted about ${formatQuantity(recentUsage)} ${item.unit} today. Projected on hand is ${formatQuantity(projectedQuantity)} ${item.unit}.`
      : "No mapped POS depletion has been recorded for this item today.";
  const confidenceCopy = hasRestaurantHistory
    ? `Demand memory uses a trimmed rolling average, so one unusual day cannot set the baseline.`
    : averageDailyUsage > 0
      ? "Confidence improves after at least seven service days and three observations of this menu item."
      : "Recommendation is based on current par level until enough sales history builds up.";
  const whyItMatters = getWhyItMatters(safeItem, daysCoverage, demandTrend, recentUsage, projectedQuantity);
  const recommendationCopy = getRecommendationCopy(safeItem, suggestedOrderQuantity, coverageLabel, demandTrend, projectedStatus, recentUsage);

  return {
    averageDailyUsage,
    historySampleDays,
    historySource,
    todayDepletion: recentUsage,
    projectedQuantity,
    projectedStatus,
    daysCoverage,
    coverageLabel,
    demandTrend,
    trendLabel,
    suggestedOrderQuantity,
    suggestedAction,
    urgency,
    basis,
    depletionCopy,
    confidenceCopy,
    recommendationCopy,
    whyItMatters
  };
}

function getDemandTrend(recentUsage: number, baselineUsage: number) {
  if (recentUsage <= 0 && baselineUsage <= 0) return "learning" as const;
  if (baselineUsage <= 0) return "normal" as const;
  if (recentUsage > baselineUsage * 1.15) return "rising" as const;
  if (recentUsage < baselineUsage * 0.8) return "falling" as const;
  return "normal" as const;
}

function getTrendLabel(trend: InventoryPrediction["demandTrend"]) {
  if (trend === "rising") return "Demand rising";
  if (trend === "falling") return "Demand easing";
  if (trend === "learning") return "Mise is learning";
  return "Normal demand";
}

function getCoverageLabel(
  item: InventoryItem,
  daysCoverage: number | null,
  averageDailyUsage: number,
  projectedQuantity: number
) {
  if (daysCoverage === null || averageDailyUsage <= 0) return "Mise is still learning this pattern";
  if (projectedQuantity > item.par_level * 1.35 || daysCoverage >= 8) return "Unusually high stock";
  if (daysCoverage <= 0.75) return "May run out today";
  if (daysCoverage <= 1.5) return "May run low tomorrow";
  if (daysCoverage <= 3) return `Likely enough for ${Math.max(2, Math.ceil(daysCoverage))} days`;
  if (daysCoverage >= 5) return `Likely enough for ${Math.floor(daysCoverage)} days`;
  return "Likely enough for several days";
}

function getSuggestedAction(
  item: InventoryItem,
  suggestedOrderQuantity: number,
  daysCoverage: number | null,
  status: InventoryStatus
) {
  if (status === "Critical" || status === "Low") {
    return `Order ${formatQuantity(suggestedOrderQuantity)} ${item.unit}`;
  }
  if (status === "Watch") return "Update count before ordering";
  if (daysCoverage && daysCoverage >= 8) return "Delay next order";
  return "No order needed";
}

function getWhyItMatters(
  item: InventoryItem,
  daysCoverage: number | null,
  trend: InventoryPrediction["demandTrend"],
  todayDepletion: number,
  projectedQuantity: number
) {
  if (todayDepletion > 0 && projectedQuantity <= item.reorder_threshold) {
    return "Mapped POS sales have pushed projected stock below the reorder threshold.";
  }
  if (daysCoverage === null) return "Mise needs more sales history before it can predict coverage with confidence.";
  if (daysCoverage <= 1.5) return "Current stock may not cover tomorrow's projected demand.";
  if (trend === "rising") return `${item.item_name} may move faster than your usual ordering rhythm.`;
  if (daysCoverage >= 8) return "This may tie up cash or create waste risk before the next order cycle.";
  return "Current stock appears aligned with recent usage.";
}

function getRecommendationCopy(
  item: InventoryItem,
  suggestedOrderQuantity: number,
  coverageLabel: string,
  trend: InventoryPrediction["demandTrend"],
  status: InventoryStatus,
  todayDepletion: number
) {
  if (status === "Critical" || status === "Low") {
    const trendCopy = trend === "rising" ? " and related menu items are moving faster than usual" : "";
    const depletionCopy = todayDepletion > 0 ? " after mapped POS depletion" : "";
    const coverageReason = coverageLabel.toLowerCase().startsWith("may")
      ? `it ${coverageLabel.toLowerCase()}`
      : `current coverage is ${coverageLabel.toLowerCase()}`;
    return `Mise recommends ordering ${formatQuantity(suggestedOrderQuantity)} ${item.unit} of ${item.item_name.toLowerCase()} because ${coverageReason}${depletionCopy}${trendCopy}.`;
  }
  if (status === "Watch") {
    return `Mise recommends updating the count before ordering. ${item.item_name} ${verbForItem(item.item_name)} near the normal operating level.`;
  }
  return `Mise does not recommend an order right now. ${item.item_name} ${verbForItem(item.item_name)} within the normal operating range.`;
}

function predictionRank(prediction: InventoryPrediction) {
  if (prediction.urgency === "high") return 30;
  if (prediction.urgency === "medium") return 20;
  if (prediction.suggestedAction === "Update count before ordering") return 10;
  return 0;
}

function predictionHeadline(item: InventoryItem, prediction: InventoryPrediction) {
  const coverage = prediction.coverageLabel.charAt(0).toLowerCase() + prediction.coverageLabel.slice(1);
  return `${item.item_name} ${coverage}`;
}

function buildCredibilitySummary({
  recipeBaseline,
  mappedDepletionItems,
  pendingOrderItems,
  signalCount
}: {
  recipeBaseline: RecipeBaselineSummary;
  mappedDepletionItems: number;
  pendingOrderItems: number;
  signalCount: number;
}) {
  const recipeScore = recipeBaseline.coveragePercent * 0.5;
  const depletionScore = Math.min(mappedDepletionItems, 5) * 6;
  const orderScore = Math.min(pendingOrderItems, 5) * 3;
  const signalScore = Math.min(signalCount, 4) * 1.25;
  const score = Math.min(100, Math.round(recipeScore + depletionScore + orderScore + signalScore));
  const label =
    score >= 85
      ? "Automation credibility high"
      : score >= 60
        ? "Credibility building"
        : "More operator evidence needed";
  const evidence = [
    `${recipeBaseline.coveragePercent}% POS recipe coverage`,
    `${mappedDepletionItems} stock item${mappedDepletionItems === 1 ? "" : "s"} depleted from POS today`,
    `${pendingOrderItems} supplier item${pendingOrderItems === 1 ? "" : "s"} ready for review`
  ];
  const nextStep =
    recipeBaseline.coveragePercent < 85
      ? "Add missing recipe baselines before trusting automated ordering."
      : pendingOrderItems > 0
        ? "Approve or adjust the supplier queue so Mise learns your ordering judgment."
        : "Keep updating counts after service so Mise can sharpen reorder timing.";

  return {
    score,
    label,
    evidence,
    nextStep
  };
}

function estimateUsage(
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  inventoryItems: InventoryItem[]
) {
  const itemsById = new Map(inventoryItems.map((item) => [item.id, item]));
  const usage = new Map<string, { itemName: string; quantity: number; unit: string }>();

  sales.forEach((sale) => {
    mappings
      .filter(
        (mapping) =>
          mapping.restaurant_id === sale.restaurant_id &&
          mapping.menu_item_name === sale.item_name
      )
      .forEach((mapping) => {
        const item = itemsById.get(mapping.inventory_item_id);
        if (!item || item.restaurant_id !== sale.restaurant_id) return;
        if (!inventoryUnitsAreCompatible(item.unit, mapping.unit)) return;
        const current = usage.get(mapping.inventory_item_id);
        const quantity = sale.quantity_sold * mapping.quantity_used_per_sale;
        usage.set(mapping.inventory_item_id, {
          itemName: item.item_name,
          quantity: (current?.quantity ?? 0) + quantity,
          unit: item.unit
        });
      });
  });

  return usage;
}

export type RecipeBaselineSummaryOptions = {
  /**
   * Max mapped menu items returned in `items`.
   * Defaults to 6 for compact surfaces; pass `null` for the full settings list.
   */
  itemLimit?: number | null;
};

function displayMenuItemName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildRecipeBaselineSummary(
  restaurantId: string,
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  inventoryItems: InventoryItem[],
  operatingDate = defaultOperatingDate(restaurantId),
  options: RecipeBaselineSummaryOptions = {}
): RecipeBaselineSummary {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurantId);
  const todaySales = restaurantSales.filter((sale) => isToday(sale, operatingDate));
  const restaurantMappings = mappings.filter((mapping) => mapping.restaurant_id === restaurantId);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurantId);
  const itemNames = new Map(restaurantInventory.map((item) => [item.id, item.item_name]));
  const soldMenuItems = new Map<string, string>();
  for (const sale of restaurantSales) {
    const key = normalizeMenuItemKey(sale.item_name);
    if (!key || soldMenuItems.has(key)) continue;
    soldMenuItems.set(key, displayMenuItemName(sale.item_name));
  }
  const mappedMenuItems = new Map<string, string>();
  for (const mapping of restaurantMappings) {
    const key = normalizeMenuItemKey(mapping.menu_item_name);
    if (!key || mappedMenuItems.has(key)) continue;
    mappedMenuItems.set(key, displayMenuItemName(mapping.menu_item_name));
  }
  // Prefer recipe mapping labels for covered dishes so casing/spacing variants collapse cleanly.
  for (const [key, mappedName] of mappedMenuItems) {
    if (soldMenuItems.has(key)) soldMenuItems.set(key, mappedName);
  }
  const inventoryById = new Map(restaurantInventory.map((item) => [item.id, item]));
  const inventoryItemsLinked = new Set(restaurantMappings.map((mapping) => mapping.inventory_item_id));
  const posItemsCovered = [...soldMenuItems.keys()].filter((menuItemKey) => mappedMenuItems.has(menuItemKey)).length;
  const posItemsMissingRecipes = [...soldMenuItems.entries()]
    .filter(([menuItemKey]) => !mappedMenuItems.has(menuItemKey))
    .map(([, menuItemName]) => menuItemName)
    .sort((a, b) => a.localeCompare(b));
  const coveragePercent =
    soldMenuItems.size > 0
      ? Math.round((posItemsCovered / soldMenuItems.size) * 100)
      : mappedMenuItems.size > 0
        ? 100
        : 0;
  const incompatibleMenuItems = new Map<string, string>();
  const items = [...mappedMenuItems.entries()]
    .map(([menuItemKey, menuItemName]) => {
      const linkedMappings = restaurantMappings.filter(
        (mapping) => normalizeMenuItemKey(mapping.menu_item_name) === menuItemKey
      );
      const todayQuantitySold = todaySales
        .filter((sale) => normalizeMenuItemKey(sale.item_name) === menuItemKey)
        .reduce((sum, sale) => sum + sale.quantity_sold, 0);
      const ingredients = linkedMappings
        .map((mapping) => {
          const inventoryItem = inventoryById.get(mapping.inventory_item_id);
          const inventoryUnit = inventoryItem?.unit?.trim() || "";
          const unitCompatible = Boolean(
            inventoryItem && inventoryUnitsAreCompatible(inventoryItem.unit, mapping.unit)
          );
          if (!unitCompatible) {
            incompatibleMenuItems.set(menuItemKey, menuItemName);
          }
          return {
            mappingId: mapping.id,
            inventoryItemId: mapping.inventory_item_id,
            itemName: itemNames.get(mapping.inventory_item_id) ?? "Inventory item",
            quantityUsedPerSale: mapping.quantity_used_per_sale,
            unit: mapping.unit,
            inventoryUnit: inventoryUnit || mapping.unit,
            unitCompatible
          };
        })
        .sort((a, b) => a.itemName.localeCompare(b.itemName));

      return {
        menu_item_name: menuItemName,
        ingredientCount: linkedMappings.length,
        ingredients,
        linkedInventoryItems: linkedMappings
          .map((mapping) => itemNames.get(mapping.inventory_item_id) ?? "Inventory item")
          .sort((a, b) => a.localeCompare(b)),
        todayQuantitySold
      };
    })
    .sort((a, b) => b.todayQuantitySold - a.todayQuantitySold || a.menu_item_name.localeCompare(b.menu_item_name));

  // Prefer sold dishes so Today/Settings repair CTAs start with operational impact.
  const posItemsWithIncompatibleUnits = [...incompatibleMenuItems.entries()]
    .sort(([leftKey, leftName], [rightKey, rightName]) => {
      const leftSold = soldMenuItems.has(leftKey) ? 0 : 1;
      const rightSold = soldMenuItems.has(rightKey) ? 0 : 1;
      return leftSold - rightSold || leftName.localeCompare(rightName);
    })
    .map(([, menuItemName]) => menuItemName);

  const credibilityLabel =
    coveragePercent >= 85
      ? "Recipe baseline strong"
      : coveragePercent >= 50
        ? "Recipe baseline building"
        : "Recipe baseline needed";
  const operatorCopy =
    soldMenuItems.size > 0
      ? `Mise can translate ${posItemsCovered} of ${soldMenuItems.size} POS menu items into ingredient movement.`
      : `${mappedMenuItems.size} menu item${mappedMenuItems.size === 1 ? "" : "s"} mapped to inventory usage.`;
  const itemLimit = options.itemLimit === undefined ? 6 : options.itemLimit;

  return {
    menuItemsTracked: mappedMenuItems.size,
    ingredientMappings: restaurantMappings.length,
    inventoryItemsLinked: inventoryItemsLinked.size,
    posItemsCovered,
    posItemsMissingRecipes,
    posItemsWithIncompatibleUnits,
    coveragePercent,
    credibilityLabel,
    operatorCopy,
    items: itemLimit == null ? items : items.slice(0, itemLimit)
  };
}

export function rebuildPurchaseRecommendations(state: DemoState, restaurantId: string) {
  const now = new Date().toISOString();
  const recommendationHistory = [...state.purchaseRecommendations];
  const learnedQuantities = buildLearnedOrderQuantities(restaurantId, recommendationHistory);
  const operatingDate = defaultOperatingDate(restaurantId);
  const restaurantMovements = (state.inventoryMovements ?? []).filter(
    (movement) => movement.restaurant_id === restaurantId
  );
  const appliedTodayConsumptionByItemId = buildAppliedTodayConsumptionByItemId(
    restaurantMovements,
    operatingDate
  );
  const receiveBiasByItem = buildReceiveFillBiasByItem(
    extractReceiveSamplesFromMovements(restaurantMovements)
  );
  const wasteBiasByItem = buildWasteBiasByItem(extractWasteSamplesFromMovements(restaurantMovements));
  const countShrinkBiasByItem = buildCountShrinkBiasByItem(
    extractCountVarianceSamplesFromMovements(restaurantMovements)
  );
  const managerCorrectionBiasByItem = buildManagerCorrectionBiasByItem(
    extractManagerCorrectionSamplesFromMovements(restaurantMovements)
  );
  const lowOutlooks = buildInventoryOutlooks(
    restaurantId,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    operatingDate,
    appliedTodayConsumptionByItemId
  ).filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low");
  const lowItemIds = new Set(lowOutlooks.map(({ item }) => item.id));
  const kept = state.purchaseRecommendations.filter((recommendation) => {
    if (recommendation.restaurant_id !== restaurantId) return true;
    if (recommendation.status !== "pending") return true;
    return lowItemIds.has(recommendation.inventory_item_id);
  });

  lowOutlooks.forEach(({ item, prediction }) => {
    const pending = kept.find(
      (recommendation) =>
        recommendation.restaurant_id === restaurantId &&
        recommendation.inventory_item_id === item.id &&
        recommendation.status === "pending"
    );
    if (!pending && shouldSuppressRecommendationForItem(restaurantId, item, recommendationHistory)) return;

    const learned = applyStackedOrderLearning({
      item,
      prediction,
      learnedQuantities,
      receiveBias: receiveBiasByItem.get(item.id),
      wasteBias: wasteBiasByItem.get(item.id),
      countShrinkBias: countShrinkBiasByItem.get(item.id),
      managerCorrectionBias: managerCorrectionBiasByItem.get(item.id)
    });
    const reason = learnedRecommendationReason(
      item,
      prediction,
      learned.learnedQuantity,
      learned.reasonFragments.length ? learned.reasonFragments.join(" ") : undefined
    );

    if (pending) {
      pending.item_name = item.item_name;
      pending.supplier_name = item.supplier_name;
      pending.recommended_quantity = learned.recommendedQuantity;
      pending.unit = item.unit;
      pending.reason = reason;
      pending.urgency = prediction.urgency;
      return;
    }

    kept.push({
      id: createId("rec"),
      restaurant_id: restaurantId,
      inventory_item_id: item.id,
      item_name: item.item_name,
      supplier_name: item.supplier_name,
      recommended_quantity: learned.recommendedQuantity,
      original_recommended_quantity: null,
      dismiss_reason: null,
      unit: item.unit,
      reason,
      urgency: prediction.urgency,
      status: "pending",
      supplier_order_id: null,
      created_at: now
    });
  });

  state.purchaseRecommendations = kept;
}

export function buildInsightsFromData(
  restaurantId: string,
  inventoryItems: InventoryItem[],
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  operatingDate = defaultOperatingDate(restaurantId),
  receivingHistory: Parameters<typeof buildReceiveFillBiasByItem>[0] = [],
  wasteHistory: Parameters<typeof buildWasteBiasByItem>[0] = [],
  countVarianceHistory: Parameters<typeof buildCountShrinkBiasByItem>[0] = [],
  managerCorrectionHistory: Parameters<typeof buildManagerCorrectionBiasByItem>[0] = []
) {
  const now = new Date().toISOString();
  const todaySales = sales.filter(
    (sale) => sale.restaurant_id === restaurantId && isToday(sale, operatingDate)
  );
  const historicalBaselines = buildHistoricalDemandBaselines(restaurantId, sales, operatingDate);
  const insights: Insight[] = [];
  const usage = estimateUsage(todaySales, mappings, inventoryItems);
  const outlooks = buildInventoryOutlooks(restaurantId, inventoryItems, sales, mappings, operatingDate);
  const receiveBiasByItem = buildReceiveFillBiasByItem(receivingHistory);
  const wasteBiasByItem = buildWasteBiasByItem(wasteHistory);
  const countShrinkBiasByItem = buildCountShrinkBiasByItem(countVarianceHistory);
  const managerCorrectionBiasByItem = buildManagerCorrectionBiasByItem(managerCorrectionHistory);
  const chronicShortShipInsights = inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .flatMap((item) => {
      const bias = receiveBiasByItem.get(item.id);
      const marker = bias ? buildChronicShortShipInsightInput(bias) : null;
      if (!bias || !marker) return [];
      return [{
        id: `insight_shortship_${item.id}`,
        restaurant_id: restaurantId,
        insight_type: "ordering" as const,
        title: `${item.item_name} is often short-shipped`,
        description: `Recent ${item.supplier_name} deliveries for ${item.item_name} averaged about ${marker.fillPercent}% of the ordered quantity across ${bias.sampleCount} receives.`,
        why_it_matters: "Chronic short-ships leave less on hand than Mise ordered and can create avoidable stockouts.",
        recommended_action: `Order slightly more from ${item.supplier_name}, or confirm counts carefully when receiving.`,
        severity: "warning" as const,
        created_at: now,
        presentation: {
          code: "insight.rule.ordering.chronic_short_ship" as const,
          values: {
            itemName: item.item_name,
            supplierName: item.supplier_name,
            fillPercent: marker.fillPercent,
            sampleCount: bias.sampleCount
          }
        }
      }];
    })
    .slice(0, 2);
  insights.push(...chronicShortShipInsights);
  const chronicLossInsights = inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .flatMap((item) => {
      const entries: Insight[] = [];
      const wasteBias = wasteBiasByItem.get(item.id);
      const wasteMarker = wasteBias ? buildChronicWasteInsightInput(wasteBias) : null;
      if (wasteBias && wasteMarker) {
        entries.push({
          id: `insight_waste_${item.id}`,
          restaurant_id: restaurantId,
          insight_type: "waste",
          title: `${item.item_name} has a chronic waste pattern`,
          description: `Recent waste records for ${item.item_name} averaged about ${wasteMarker.lossPercent}% of on-hand across ${wasteBias.sampleCount} events.`,
          why_it_matters: "Repeated waste silently reduces usable stock and can make par-based orders too light.",
          recommended_action: `Review prep and storage for ${item.item_name}, and confirm the next order covers expected loss.`,
          severity: "warning",
          created_at: now,
          presentation: {
            code: "insight.rule.waste.chronic_waste",
            values: {
              itemName: item.item_name,
              lossPercent: wasteMarker.lossPercent,
              sampleCount: wasteBias.sampleCount
            }
          }
        });
      }
      const shrinkBias = countShrinkBiasByItem.get(item.id);
      const shrinkMarker = shrinkBias ? buildChronicCountShrinkInsightInput(shrinkBias) : null;
      if (shrinkBias && shrinkMarker) {
        entries.push({
          id: `insight_count_shrink_${item.id}`,
          restaurant_id: restaurantId,
          insight_type: "inventory",
          title: `${item.item_name} often shrinks between counts`,
          description: `Recent inventory counts for ${item.item_name} averaged about ${shrinkMarker.lossPercent}% below system across ${shrinkBias.sampleCount} counts.`,
          why_it_matters: "Unexplained shrink means Mise’s on-hand is drifting high and orders may understock the next service.",
          recommended_action: `Investigate count process and theft/spoilage risk for ${item.item_name}, then recount before ordering.`,
          severity: "warning",
          created_at: now,
          presentation: {
            code: "insight.rule.inventory.chronic_count_shrink",
            values: {
              itemName: item.item_name,
              lossPercent: shrinkMarker.lossPercent,
              sampleCount: shrinkBias.sampleCount
            }
          }
        });
      }
      const managerBias = managerCorrectionBiasByItem.get(item.id);
      const managerMarker = managerBias
        ? buildChronicManagerCorrectionInsightInput(managerBias)
        : null;
      if (managerBias && managerMarker) {
        entries.push({
          id: `insight_manager_correction_${item.id}`,
          restaurant_id: restaurantId,
          insight_type: "inventory",
          title: `${item.item_name} is often corrected downward`,
          description: `Recent manager corrections for ${item.item_name} averaged about ${managerMarker.lossPercent}% below system across ${managerBias.sampleCount} edits.`,
          why_it_matters: "Repeated downward corrections mean on-hand is drifting high and Mise may under-order for the next service.",
          recommended_action: `Review why ${item.item_name} keeps needing corrections, then confirm the next count before ordering.`,
          severity: "warning",
          created_at: now,
          presentation: {
            code: "insight.rule.inventory.chronic_manager_correction",
            values: {
              itemName: item.item_name,
              lossPercent: managerMarker.lossPercent,
              sampleCount: managerBias.sampleCount
            }
          }
        });
      }
      return entries;
    })
    .slice(0, 2);
  insights.push(...chronicLossInsights);

  outlooks
    .filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low")
    .slice(0, 3)
    .forEach(({ item, prediction }) => {
      insights.push({
        id: `insight_low_${item.id}`,
        restaurant_id: restaurantId,
        insight_type: "inventory",
        title:
          prediction.projectedStatus === "Critical"
            ? predictionHeadline(item, prediction)
            : `${item.item_name} ${verbForItem(item.item_name)} below normal level`,
        description: `${item.item_name} ${verbForItem(item.item_name)} counted at ${formatQuantity(item.current_quantity)} ${item.unit} and projected at ${formatQuantity(prediction.projectedQuantity)} ${item.unit} after POS sales. ${prediction.coverageLabel}.`,
        why_it_matters: prediction.whyItMatters,
        recommended_action: `Review the ${item.supplier_name} order and add ${formatQuantity(prediction.suggestedOrderQuantity)} ${item.unit}.`,
        severity: prediction.urgency === "high" ? "urgent" : "warning",
        created_at: now,
        presentation: {
          code: "insight.rule.inventory.stock_risk",
          values: {
            itemName: item.item_name,
            projectedQuantity: prediction.projectedQuantity,
            unit: item.unit,
            supplierName: item.supplier_name,
            suggestedOrderQuantity: prediction.suggestedOrderQuantity,
            status: prediction.projectedStatus === "Critical" ? "Critical" : "Low"
          }
        }
      });
    });

  todaySales.forEach((sale) => {
    const baseline = historicalBaselines.get(normalizeMenuItemKey(sale.item_name))?.dailyQuantity ??
      (restaurantId === DEMO_RESTAURANT_ID ? salesBaselines[sale.item_name] : undefined);
    if (!baseline) return;
    const lift = Math.round(((sale.quantity_sold - baseline) / baseline) * 100);
    if (lift < 20) return;

    insights.push({
      id: `insight_spike_${sale.item_name.replace(/\s+/g, "_").toLowerCase()}`,
      restaurant_id: restaurantId,
      insight_type: "sales",
      title: `${sale.item_name} demand is rising`,
      description: `${sale.item_name} sold ${lift}% more than its usual day so far.`,
      why_it_matters: "You may run through linked ingredients faster than your usual ordering rhythm.",
      recommended_action: `Review inventory tied to ${sale.item_name.toLowerCase()} before tomorrow's prep.`,
      severity: "warning",
      created_at: now,
      presentation: {
        code: "insight.rule.sales.demand_rising",
        values: {
          itemName: sale.item_name,
          liftPercent: lift
        }
      }
    });
  });

  const topSale = [...todaySales].sort((a, b) => b.quantity_sold - a.quantity_sold)[0];
  if (topSale) {
    const lowIngredientOutlook = outlooks.find(({ item, prediction }) => {
      const isLinked = mappings.some(
        (mapping) => mapping.menu_item_name === topSale.item_name && mapping.inventory_item_id === item.id
      );
      return isLinked && (prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low");
    });

    if (lowIngredientOutlook) {
      const lowIngredient = lowIngredientOutlook.item;
      insights.push({
        id: `insight_prep_${topSale.item_name.replace(/\s+/g, "_").toLowerCase()}`,
        restaurant_id: restaurantId,
        insight_type: "prep",
        title: `${topSale.item_name} depends on low stock`,
        description: `${topSale.item_name} is one of today's best sellers and uses ${lowIngredient.item_name.toLowerCase()}, which is below reorder level.`,
        why_it_matters: "A strong seller depends on an ingredient that may not cover tomorrow's demand.",
        recommended_action: `Review tomorrow's ${lowIngredient.supplier_name} order.`,
        severity: "urgent",
        created_at: now,
        presentation: {
          code: "insight.rule.prep.low_stock",
          values: {
            menuItemName: topSale.item_name,
            inventoryItemName: lowIngredient.item_name,
            supplierName: lowIngredient.supplier_name
          }
        }
      });
    }
  }

  inventoryItems
    .filter((item) => item.restaurant_id === restaurantId && getInventoryStatus(item) !== "Low")
    .forEach((item) => {
      const itemUsage = usage.get(item.id);
      if (!itemUsage || itemUsage.quantity <= 0) return;
      if (item.current_quantity <= itemUsage.quantity * 3) return;

      insights.push({
        id: `insight_overstock_${item.id}`,
        restaurant_id: restaurantId,
        insight_type: "waste",
        title: `${item.item_name} may be overstocked`,
        description: `You have about ${formatQuantity(item.current_quantity)} ${item.unit} of ${item.item_name.toLowerCase()}, more than the last few days of projected use.`,
        why_it_matters: "Holding more than expected can tie up cash or create waste risk.",
        recommended_action: `Delay the next ${item.item_name.toLowerCase()} order unless sales increase.`,
        severity: "info",
        created_at: now,
        presentation: {
          code: "insight.rule.waste.overstock",
          values: {
            itemName: item.item_name,
            quantity: item.current_quantity,
            unit: item.unit
          }
        }
      });
    });

  return insights.slice(0, 8);
}

export function rebuildInsights(state: DemoState, restaurantId: string) {
  const restaurantMovements = (state.inventoryMovements ?? []).filter(
    (movement) => movement.restaurant_id === restaurantId
  );
  const receivingHistory = extractReceiveSamplesFromMovements(restaurantMovements);
  const wasteHistory = extractWasteSamplesFromMovements(restaurantMovements);
  const countVarianceHistory = extractCountVarianceSamplesFromMovements(restaurantMovements);
  const managerCorrectionHistory =
    extractManagerCorrectionSamplesFromMovements(restaurantMovements);
  const generated = buildInsightsFromData(
    restaurantId,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    defaultOperatingDate(restaurantId),
    receivingHistory,
    wasteHistory,
    countVarianceHistory,
    managerCorrectionHistory
  );
  state.insights = [
    ...state.insights.filter((insight) => insight.restaurant_id !== restaurantId),
    ...generated
  ];
}

export function buildTodaySummary(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  recommendations: PurchaseRecommendation[],
  insights: Insight[],
  mappings: MenuItemIngredient[] = [],
  operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone),
  appliedTodayConsumptionByItemId: ReadonlyMap<string, number> | Record<string, number> = {}
): TodaySummary {
  const todaySales = sales.filter(
    (sale) => sale.restaurant_id === restaurant.id && isToday(sale, operatingDate)
  );
  const salesToday = todaySales.reduce((sum, sale) => sum + sale.gross_sales, 0);
  const netSalesToday = todaySales.reduce((sum, sale) => sum + sale.net_sales, 0);
  const itemsSold = todaySales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
  const topItems = [...todaySales].sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 3);
  const outlooks = buildInventoryOutlooks(
    restaurant.id,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    appliedTodayConsumptionByItemId
  );
  const recipeBaseline = buildRecipeBaselineSummary(restaurant.id, sales, mappings, inventoryItems, operatingDate);
  const workflow = {
    posMenuItemsCovered: recipeBaseline.posItemsCovered,
    recipeLinks: recipeBaseline.ingredientMappings,
    projectedDepletedItems: outlooks.filter(({ prediction }) => prediction.todayDepletion > 0).length,
    pendingOrderItems: recommendations.filter(
      (recommendation) => recommendation.restaurant_id === restaurant.id && recommendation.status === "pending"
    ).length
  };
  const credibility = buildCredibilitySummary({
    recipeBaseline,
    mappedDepletionItems: workflow.projectedDepletedItems,
    pendingOrderItems: workflow.pendingOrderItems,
    signalCount: insights.filter((insight) => insight.restaurant_id === restaurant.id).length
  });
  const lowStockCount = outlooks.filter(
    ({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low"
  ).length;
  const inventoryAlerts = outlooks.filter(
    ({ prediction }) =>
      prediction.projectedStatus === "Critical" ||
      prediction.projectedStatus === "Low" ||
      prediction.suggestedAction === "Update count before ordering"
  ).length;
  const pendingRecommendations = recommendations.filter(
    (recommendation) => recommendation.restaurant_id === restaurant.id && recommendation.status === "pending"
  ).length;
  const importantInsight =
    insights
      .filter((insight) => insight.restaurant_id === restaurant.id)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] ?? null;

  const attentionCards: AttentionCard[] = [];
  const riskiestOutlook = outlooks.find(
    ({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low"
  );
  if (riskiestOutlook) {
    attentionCards.push({
      id: `attention_inventory_${riskiestOutlook.item.id}`,
      title:
        riskiestOutlook.prediction.projectedStatus === "Critical"
          ? predictionHeadline(riskiestOutlook.item, riskiestOutlook.prediction)
          : `${riskiestOutlook.item.item_name} ${verbForItem(riskiestOutlook.item.item_name)} below normal level`,
      detail: riskiestOutlook.prediction.whyItMatters,
      context: riskiestOutlook.prediction.basis,
      actionLabel: "Review order",
      route: "/orders",
      severity: riskiestOutlook.prediction.urgency === "high" ? "urgent" : "warning"
    });
  } else if (importantInsight) {
    attentionCards.push({
      id: `attention_${importantInsight.id}`,
      title: importantInsight.title,
      detail: importantInsight.recommended_action,
      context: importantInsight.why_it_matters ?? undefined,
      actionLabel: "See insight",
      route: "/insights",
      severity: importantInsight.severity
    });
  }

  if (inventoryAlerts > 0) {
    attentionCards.push({
      id: "attention_low_stock",
      title: `${inventoryAlerts} inventory alerts need review`,
      detail: "Mise found stock counts that may need a count update or supplier order.",
      context: "Coverage is based on current counts and recent sales.",
      actionLabel: "View inventory",
      route: "/inventory",
      severity: lowStockCount >= 3 ? "urgent" : "warning"
    });
  }

  if (pendingRecommendations > 0) {
    attentionCards.push({
      id: "attention_orders",
      title: "Suggested order is ready to approve",
      detail: `Mise prepared ${pendingRecommendations} item${pendingRecommendations === 1 ? "" : "s"} for supplier review.`,
      context: "Approve only what you want sent or copied today.",
      actionLabel: "Review order",
      route: "/orders",
      severity: "warning"
    });
  }

  const stableOutlook = outlooks.find(
    ({ prediction }) =>
      prediction.projectedStatus !== "Critical" &&
      prediction.projectedStatus !== "Low" &&
      prediction.daysCoverage !== null &&
      prediction.daysCoverage >= 3
  );
  if (stableOutlook) {
    attentionCards.push({
      id: `attention_stable_${stableOutlook.item.id}`,
      title: `${stableOutlook.item.item_name} looks stable`,
      detail: stableOutlook.prediction.coverageLabel,
      context: "No supplier action needed right now.",
      actionLabel: "View inventory",
      route: "/inventory",
      severity: "info"
    });
  }

  const spikeInsight = insights.find(
    (insight) => insight.restaurant_id === restaurant.id && insight.insight_type === "sales"
  );
  if (spikeInsight && !attentionCards.some((card) => card.title === spikeInsight.title)) {
    attentionCards.push({
      id: `attention_${spikeInsight.id}`,
      title: spikeInsight.title,
      detail: spikeInsight.recommended_action,
      context: spikeInsight.why_it_matters ?? "Mise is learning this pattern.",
      actionLabel: "See insight",
      route: "/insights",
      severity: spikeInsight.severity
    });
  }

  const salesTrend = buildRecordedSalesTrend(restaurant.id, sales, {
    limit: 6,
    throughDate: operatingDate
  }).map(({ date, sales: total }) => ({
    // Keep the service-date key authoritative. Screens localize weekday and
    // "Today" labels at render time instead of baking English into domain data.
    label: date,
    sales: total
  }));

  return {
    restaurantName: restaurant.name,
    operatingSummary: `Mise found ${inventoryAlerts} item${inventoryAlerts === 1 ? "" : "s"} that may need attention before tomorrow.`,
    miseStatus: "Mise is monitoring today's sales, inventory levels, and ordering patterns.",
    learningNote: "Mise is learning your weekday demand pattern. Recommendations improve as counts and order decisions build up.",
    salesToday,
    netSalesToday,
    itemsSold,
    topItems,
    lowStockCount,
    inventoryAlerts,
    pendingRecommendations,
    importantInsight,
    attentionCards: attentionCards.slice(0, 5),
    salesTrend,
    recipeBaseline,
    workflow,
    credibility
  };
}

export function severityRank(severity: InsightSeverity) {
  if (severity === "urgent") return 3;
  if (severity === "warning") return 2;
  return 1;
}

export function buildDraftsFromRecommendations(
  restaurantId: string,
  recommendations: PurchaseRecommendation[],
  options: { now?: Date; timeZone?: string } = {}
) {
  const grouped = new Map<string, PurchaseRecommendation[]>();
  recommendations
    .filter((recommendation) => recommendation.restaurant_id === restaurantId)
    .filter((recommendation) => recommendation.status === "approved")
    .forEach((recommendation) => {
      const current = grouped.get(recommendation.supplier_name) ?? [];
      current.push(recommendation);
      grouped.set(recommendation.supplier_name, current);
    });

  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? (
    restaurantId === DEMO_RESTAURANT_ID ? DEMO_RESTAURANT_TIME_ZONE : "UTC"
  );
  return [...grouped.entries()].map(([supplierName, items]) => {
    const deliveryDate = nextDateKeyInTimeZone(now, timeZone);
    return {
      id: createId("order"),
      restaurant_id: restaurantId,
      supplier_name: supplierName,
      order_message: buildSupplierOrderMessage(supplierName, items),
      operator_note: null,
      status: "draft" as SupplierOrderStatus,
      delivery_date: deliveryDate,
      created_at: now.toISOString()
    };
  });
}

export function buildSupplierOrderMessage(
  supplierName: string,
  recommendations: PurchaseRecommendation[],
  operatorNote: string | null = null
) {
  const lines = recommendations
    .slice()
    .sort((a, b) => a.item_name.localeCompare(b.item_name) || a.id.localeCompare(b.id))
    .map((item) => `${item.item_name} - ${formatQuantity(item.recommended_quantity)} ${item.unit}`);
  const base = `Order draft for ${supplierName}\n\n${lines.join("\n")}\n\nDelivery requested: Tomorrow morning`;
  const note = operatorNote?.trim();
  return truncateUtf8(note ? `${base}\n\nNotes:\n${note}` : base, ORDER_MESSAGE_MAX_BYTES);
}

export type RecommendationWorkflowOutcome = "applied" | "already_applied";

export interface RecommendationWorkflowResult {
  outcome: RecommendationWorkflowOutcome;
  recommendation: PurchaseRecommendation;
  order: SupplierOrder | null;
  previousStatus: RecommendationStatus;
}

export interface SupplierOrderSentWorkflowResult {
  outcome: RecommendationWorkflowOutcome;
  order: SupplierOrder;
  orderedRecommendations: PurchaseRecommendation[];
}

export function approveRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string,
  recommendedQuantity?: number
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "dismissed" || recommendation.status === "ordered") {
    throw new Error("Already handled.");
  }
  if (recommendation.status === "pending") {
    recommendation.original_recommended_quantity = recommendation.recommended_quantity;
    recommendation.dismiss_reason = null;
    if (recommendedQuantity !== undefined) {
      if (
        !Number.isFinite(recommendedQuantity) ||
        recommendedQuantity <= 0 ||
        recommendedQuantity > 1_000_000
      ) {
        throw new Error("Enter a valid order quantity.");
      }
      recommendation.recommended_quantity = recommendedQuantity;
    }
  }

  let order = recommendation.supplier_order_id
    ? state.supplierOrders.find(
        (entry) =>
          entry.id === recommendation.supplier_order_id &&
          entry.restaurant_id === restaurantId
      ) ?? null
    : null;
  if (order && order.status !== "draft") {
    throw new Error("Already handled.");
  }
  if (!order) {
    order = state.supplierOrders.find(
      (entry) =>
        entry.restaurant_id === restaurantId &&
        entry.supplier_name === recommendation.supplier_name &&
        entry.status === "draft"
    ) ?? null;
  }
  if (!order) {
    const timeZone = state.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone ?? (
      restaurantId === DEMO_RESTAURANT_ID ? DEMO_RESTAURANT_TIME_ZONE : "UTC"
    );
    const now = new Date();
    order = {
      id: createId("order"),
      restaurant_id: restaurantId,
      supplier_name: recommendation.supplier_name,
      order_message: "",
      operator_note: null,
      status: "draft",
      delivery_date: nextDateKeyInTimeZone(now, timeZone),
      created_at: now.toISOString()
    };
    state.supplierOrders.push(order);
  }

  recommendation.status = "approved";
  recommendation.supplier_order_id = order.id;
  rebuildDemoDraftMessage(state, order);
  return {
    outcome: previousStatus === "approved" ? "already_applied" : "applied",
    recommendation,
    order,
    previousStatus
  };
}

export function dismissRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string,
  dismissReason?: string | null
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "approved" || recommendation.status === "ordered") {
    throw new Error("Already handled.");
  }
  if (recommendation.status === "pending") {
    const trimmed =
      typeof dismissReason === "string" ? dismissReason.trim() : dismissReason == null ? "" : "";
    if (trimmed.length > 240) {
      throw new Error("Dismiss reason is outside supported limits.");
    }
    recommendation.status = "dismissed";
    recommendation.supplier_order_id = null;
    recommendation.dismiss_reason = trimmed ? trimmed : null;
  }
  return {
    outcome: previousStatus === "dismissed" ? "already_applied" : "applied",
    recommendation,
    order: null,
    previousStatus
  };
}

export function undoRecommendationInDemoState(
  state: DemoState,
  restaurantId: string,
  recommendationId: string
): RecommendationWorkflowResult {
  const recommendation = findRecommendationForWorkflow(state, restaurantId, recommendationId);
  const previousStatus = recommendation.status;
  if (recommendation.status === "ordered") {
    throw new Error("This recommendation is already in supplier history and cannot be undone.");
  }
  if (recommendation.status === "pending") {
    return { outcome: "already_applied", recommendation, order: null, previousStatus };
  }
  const newerPending = state.purchaseRecommendations.find(
    (entry) =>
      entry.id !== recommendation.id &&
      entry.restaurant_id === restaurantId &&
      entry.inventory_item_id === recommendation.inventory_item_id &&
      entry.status === "pending"
  );
  if (newerPending) throw new Error("A newer recommendation is already pending.");

  const order = recommendation.supplier_order_id
    ? state.supplierOrders.find(
        (entry) => entry.restaurant_id === restaurantId && entry.id === recommendation.supplier_order_id
      ) ?? null
    : null;
  if (previousStatus === "approved" && order && order.status !== "draft") {
    throw new Error("This recommendation is already in supplier history and cannot be undone.");
  }

  if (previousStatus === "approved" && recommendation.original_recommended_quantity != null) {
    recommendation.recommended_quantity = recommendation.original_recommended_quantity;
    recommendation.original_recommended_quantity = null;
  }
  if (previousStatus === "dismissed") {
    recommendation.dismiss_reason = null;
  }
  recommendation.status = "pending";
  recommendation.supplier_order_id = null;
  if (previousStatus === "approved" && order) {
    const remaining = linkedApprovedRecommendations(state, order.id);
    if (remaining.length === 0) {
      state.supplierOrders = state.supplierOrders.filter((entry) => entry.id !== order.id);
    } else {
      order.order_message = buildSupplierOrderMessage(order.supplier_name, remaining, order.operator_note);
    }
  }
  return { outcome: "applied", recommendation, order, previousStatus };
}

export function markSupplierOrderSentInDemoState(
  state: DemoState,
  restaurantId: string,
  orderId: string
): SupplierOrderSentWorkflowResult {
  const order = state.supplierOrders.find(
    (entry) => entry.restaurant_id === restaurantId && entry.id === orderId
  );
  if (!order) throw new Error("Order draft not found");
  const linked = state.purchaseRecommendations.filter(
    (recommendation) =>
      recommendation.restaurant_id === restaurantId &&
      recommendation.supplier_order_id === orderId
  );
  if (order.status === "sent" || order.status === "completed") {
    return {
      outcome: "already_applied",
      order,
      orderedRecommendations: linked.filter((recommendation) => recommendation.status === "ordered")
    };
  }

  order.status = "sent";
  const orderedRecommendations = linked.filter((recommendation) => recommendation.status === "approved");
  orderedRecommendations.forEach((recommendation) => {
    recommendation.status = "ordered";
  });
  return { outcome: "applied", order, orderedRecommendations };
}

function findRecommendationForWorkflow(state: DemoState, restaurantId: string, recommendationId: string) {
  const recommendation = state.purchaseRecommendations.find(
    (entry) => entry.restaurant_id === restaurantId && entry.id === recommendationId
  );
  if (!recommendation) throw new Error("Recommendation not found.");
  return recommendation;
}

function linkedApprovedRecommendations(state: DemoState, orderId: string) {
  return state.purchaseRecommendations.filter(
    (recommendation) =>
      recommendation.supplier_order_id === orderId && recommendation.status === "approved"
  );
}

function rebuildDemoDraftMessage(state: DemoState, order: SupplierOrder) {
  order.order_message = buildSupplierOrderMessage(
    order.supplier_name,
    linkedApprovedRecommendations(state, order.id),
    order.operator_note
  );
}

export function buildOrderQueueSummary(
  restaurantId: string,
  recommendations: PurchaseRecommendation[],
  orders: SupplierOrder[]
): OrderQueueSummary {
  const pendingRecommendations = recommendations.filter(
    (recommendation) => recommendation.restaurant_id === restaurantId && recommendation.status === "pending"
  );
  const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurantId);
  const draftOrders = restaurantOrders.filter((order) => order.status === "draft");
  const sentOrders = restaurantOrders.filter((order) => order.status === "sent");
  const activeSupplierNames = pendingRecommendations.length > 0
    ? pendingRecommendations.map((recommendation) => recommendation.supplier_name)
    : draftOrders.map((order) => order.supplier_name);
  const supplierCount = new Set(activeSupplierNames).size;
  const highUrgencyItems = pendingRecommendations.filter((recommendation) => recommendation.urgency === "high").length;
  const draftCount = draftOrders.length;
  const sentCount = sentOrders.length;
  const pendingItems = pendingRecommendations.length;
  const readinessLabel =
    pendingItems > 0
      ? highUrgencyItems > 0
        ? "Order review needed"
        : "Supplier queue ready"
      : draftCount > 0
        ? "Drafts ready to send"
        : "Orders are quiet";
  const operatorCopy =
    pendingItems > 0
      ? `Mise prepared ${pendingItems} suggested item${pendingItems === 1 ? "" : "s"} across ${supplierCount} supplier${supplierCount === 1 ? "" : "s"}.`
      : draftCount > 0
        ? `Mise has ${draftCount} supplier draft${draftCount === 1 ? "" : "s"} waiting to be copied or sent.`
        : "Mise will queue supplier work when projected stock falls below reorder levels.";
  const nextStep =
    highUrgencyItems > 0
      ? "Review high-urgency items before the next service window."
      : pendingItems > 0
        ? "Approve, adjust, or dismiss each recommendation so Mise learns your ordering judgment."
        : draftCount > 0
          ? "Copy or mark supplier drafts as sent once the order leaves the restaurant."
          : "Keep counts current so Mise can build the next supplier queue.";

  return {
    pendingItems,
    supplierCount,
    highUrgencyItems,
    draftCount,
    sentCount,
    readinessLabel,
    operatorCopy,
    nextStep
  };
}

export function buildInsightSummary(restaurantId: string, insights: Insight[]): InsightSummary {
  const restaurantInsights = insights.filter((insight) => insight.restaurant_id === restaurantId);
  const urgentCount = restaurantInsights.filter((insight) => insight.severity === "urgent").length;
  const warningCount = restaurantInsights.filter((insight) => insight.severity === "warning").length;
  const learningCount = restaurantInsights.filter(
    (insight) => insight.insight_type === "sales" || insight.insight_type === "prep"
  ).length;
  const signalCount = restaurantInsights.length;
  const readinessLabel =
    urgentCount > 0
      ? "Signals need a manager look"
      : warningCount > 0
        ? "Patterns ready to review"
        : signalCount > 0
          ? "Mise is learning the rhythm"
          : "Mise is waiting for signals";
  const operatorCopy =
    signalCount > 0
      ? `Mise found ${signalCount} current signal${signalCount === 1 ? "" : "s"} from sales, stock movement, and prep risk.`
      : "Mise will build the manager brief as POS sales, counts, and ordering decisions come in.";
  const nextStep =
    urgentCount > 0
      ? "Review urgent signals before the next service window."
      : warningCount > 0
        ? "Check watch items after service and adjust counts if needed."
        : signalCount > 0
          ? "Keep counts and recipe baselines current so Mise can sharpen its pattern memory."
          : "Load demo data or connect POS sales so Mise can start noticing patterns.";

  return {
    signalCount,
    urgentCount,
    warningCount,
    learningCount,
    readinessLabel,
    operatorCopy,
    nextStep
  };
}

export function buildLearningMemorySummary(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  recommendations: PurchaseRecommendation[],
  insights: Insight[],
  mappings: MenuItemIngredient[],
  orders: SupplierOrder[] = []
): LearningMemorySummary {
  const operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone);
  const recipeBaseline = buildRecipeBaselineSummary(
    restaurant.id,
    sales,
    mappings,
    inventoryItems,
    operatingDate
  );
  const usageByItem = estimateUsage(
    sales.filter((sale) => isToday(sale, operatingDate)),
    mappings,
    inventoryItems
  );
  const mappedDepletionItems = [...usageByItem.values()].filter((usage) => usage.quantity > 0).length;
  const demandBaselines = buildHistoricalDemandBaselines(restaurant.id, sales, operatingDate);
  const demandHistoryDays = Math.max(0, ...[...demandBaselines.values()].map((baseline) => baseline.sampleDays));
  const learnedMenuItems = demandBaselines.size;
  const orderedRecommendations = recommendations.filter(
    (recommendation) => recommendation.restaurant_id === restaurant.id && recommendation.status === "ordered"
  ).length;
  const approvedRecommendations = recommendations.filter(
    (recommendation) => recommendation.restaurant_id === restaurant.id && recommendation.status === "approved"
  ).length;
  const sentOrders = orders.filter((order) => order.restaurant_id === restaurant.id && order.status === "sent").length;
  const orderMemoryCount = orderedRecommendations + sentOrders;
  const signalCount = insights.filter((insight) => insight.restaurant_id === restaurant.id).length;

  const rawScore = Math.min(
    100,
    Math.round(
      recipeBaseline.coveragePercent * 0.35 +
        Math.min(demandHistoryDays, historicalDemandServiceDays) * 0.75 +
        Math.min(mappedDepletionItems, 5) * 4 +
        Math.min(orderMemoryCount, 5) * 5 +
        Math.min(signalCount, 5)
    )
  );
  const score = orderMemoryCount > 0 ? rawScore : Math.min(rawScore, 72);
  const label =
    score >= 85
      ? "Mise memory is reliable"
      : score >= 60
        ? "Mise memory is building"
        : "Mise needs more proof";
  const operatorCopy =
    score >= 85
      ? "Recipe baselines, POS depletion, and manager decisions are giving Mise enough evidence to explain recommendations."
      : "Mise is collecting recipe, sales, count, and ordering evidence before it should automate more of the workflow.";
  const nextStep =
    recipeBaseline.coveragePercent < 85
      ? "Map the missing POS items to ingredients before relying on automated ordering."
      : demandHistoryDays < minimumHistoricalServiceDays
        ? "Collect at least seven service days so Mise can learn restaurant-specific demand."
      : approvedRecommendations > 0
        ? "Send approved supplier drafts so Mise can remember the operator's real ordering judgment."
        : orderMemoryCount === 0
          ? "Approve and send the first supplier draft to create ordering history."
          : "Keep updating counts after service so Mise can refine reorder timing.";
  const nextStepCode =
    recipeBaseline.coveragePercent < 85
      ? "memory.next.recipe_coverage" as const
      : demandHistoryDays < minimumHistoricalServiceDays
        ? "memory.next.demand_history" as const
        : approvedRecommendations > 0
          ? "memory.next.send_approved" as const
          : orderMemoryCount === 0
            ? "memory.next.first_order" as const
            : "memory.next.keep_counts_current" as const;

  return {
    score,
    label,
    operatorCopy,
    nextStep,
    presentation: {
      labelCode: score >= 85
        ? "memory.label.reliable"
        : score >= 60
          ? "memory.label.building"
          : "memory.label.needs_proof",
      operatorCopyCode: score >= 85 ? "memory.copy.reliable" : "memory.copy.building",
      nextStepCode
    },
    signals: [
      {
        label: "Recipe coverage",
        value: `${recipeBaseline.coveragePercent}%`,
        detail: `${recipeBaseline.ingredientMappings} dish-to-stock links`,
        tone: recipeBaseline.coveragePercent >= 85 ? "leaf" : "brand",
        presentation: {
          code: "memory.signal.recipe_coverage",
          values: {
            coveragePercent: recipeBaseline.coveragePercent,
            ingredientMappings: recipeBaseline.ingredientMappings
          }
        }
      },
      {
        label: "POS depletion",
        value: String(mappedDepletionItems),
        detail: "stock items moved by sales",
        tone: mappedDepletionItems > 0 ? "leaf" : "neutral",
        presentation: {
          code: "memory.signal.pos_depletion",
          values: { itemCount: mappedDepletionItems }
        }
      },
      {
        label: "Demand memory",
        value: demandHistoryDays > 0 ? `${demandHistoryDays}d` : "Learning",
        detail: `${learnedMenuItems} rolling menu pattern${learnedMenuItems === 1 ? "" : "s"}`,
        tone: demandHistoryDays >= minimumHistoricalServiceDays ? "leaf" : "warning",
        presentation: {
          code: "memory.signal.demand",
          values: {
            historyDays: demandHistoryDays,
            menuPatternCount: learnedMenuItems
          }
        }
      },
      {
        label: "Order memory",
        value: String(orderMemoryCount),
        detail: "sent or ordered decisions",
        tone: orderMemoryCount > 0 ? "leaf" : "warning",
        presentation: {
          code: "memory.signal.orders",
          values: { decisionCount: orderMemoryCount }
        }
      },
      {
        label: "Signals",
        value: String(signalCount),
        detail: "insights generated today",
        tone: signalCount > 0 ? "brand" : "neutral",
        presentation: {
          code: "memory.signal.insights",
          values: { signalCount }
        }
      }
    ]
  };
}

export function buildDemoReadinessSummary(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  recommendations: PurchaseRecommendation[],
  insights: Insight[],
  mappings: MenuItemIngredient[],
  orders: SupplierOrder[] = []
): DemoReadinessSummary {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurant.id);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const restaurantRecommendations = recommendations.filter((recommendation) => recommendation.restaurant_id === restaurant.id);
  const restaurantInsights = insights.filter((insight) => insight.restaurant_id === restaurant.id);
  const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurant.id);
  const operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone);
  const suppliers = new Set(restaurantInventory.map((item) => item.supplier_name));
  const recipeBaseline = buildRecipeBaselineSummary(
    restaurant.id,
    sales,
    mappings,
    inventoryItems,
    operatingDate
  );
  const outlooks = buildInventoryOutlooks(
    restaurant.id,
    inventoryItems,
    sales,
    mappings,
    operatingDate
  );
  const lowOutlookCount = outlooks.filter(
    ({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low"
  ).length;
  const pendingRecommendations = restaurantRecommendations.filter((recommendation) => recommendation.status === "pending").length;
  const supplierDrafts = restaurantOrders.filter((order) => order.status === "draft" || order.status === "sent").length;
  const walkthroughChecks = buildDemoWalkthroughChecklist(
    restaurant,
    restaurantSales,
    restaurantInventory,
    restaurantRecommendations,
    restaurantInsights,
    mappings,
    restaurantOrders
  );

  const checks: DemoReadinessCheck[] = [
    {
      id: "profile",
      label: "Restaurant profile",
      status: restaurant.name.trim() && restaurant.cuisine_type?.trim() ? "ready" : "attention",
      evidence: restaurant.cuisine_type ?? "Cuisine not set",
      detail: restaurant.name.trim()
        ? "The walkthrough has a named restaurant and cuisine lane."
        : "Add the restaurant name before demoing."
    },
    {
      id: "pos",
      label: "POS sales feed",
      status: restaurantSales.length > 0 ? "ready" : "missing",
      evidence:
        restaurantSales.length > 0
          ? `${new Set(restaurantSales.map((sale) => sale.item_name)).size} menu items`
          : "No POS sales",
      detail:
        restaurantSales.length > 0
          ? "Demo sales can drive inventory depletion and insights."
          : "Load demo POS sales before showing the operating loop."
    },
    {
      id: "recipes",
      label: "Recipe baselines",
      status:
        recipeBaseline.coveragePercent >= 85
          ? "ready"
          : recipeBaseline.ingredientMappings > 0
            ? "attention"
            : "missing",
      evidence: `${recipeBaseline.coveragePercent}% coverage`,
      detail:
        recipeBaseline.coveragePercent >= 85
          ? "POS sales can translate into ingredient movement."
          : "Add dish-to-ingredient baselines for the menu items that sell."
    },
    {
      id: "inventory",
      label: "Inventory outlook",
      status: restaurantInventory.length >= 6 ? "ready" : restaurantInventory.length > 0 ? "attention" : "missing",
      evidence: `${restaurantInventory.length} items`,
      detail:
        restaurantInventory.length >= 6
          ? "The stock list has enough items to demonstrate coverage states."
          : "Add enough stock items to show critical, watch, and stable lanes."
    },
    {
      id: "orders",
      label: "Supplier queue",
      status:
        pendingRecommendations + supplierDrafts > 0
          ? "ready"
          : suppliers.size >= 2 && lowOutlookCount > 0
            ? "attention"
            : "missing",
      evidence:
        pendingRecommendations + supplierDrafts > 0
          ? `${pendingRecommendations + supplierDrafts} queued`
          : `${suppliers.size} suppliers`,
      detail:
        pendingRecommendations + supplierDrafts > 0
          ? "Suggested ordering work is ready for the demo path."
          : "Generate recommendations or supplier drafts before the walkthrough."
    },
    {
      id: "insights",
      label: "Manager insights",
      status: restaurantInsights.length > 0 ? "ready" : restaurantSales.length > 0 ? "attention" : "missing",
      evidence: `${restaurantInsights.length} signals`,
      detail:
        restaurantInsights.length > 0
          ? "The manager brief has operational signals to review."
          : "Generate insights from sales and inventory before demoing."
    }
  ];

  const completedCount = checks.filter((check) => check.status === "ready").length;
  const attentionCount = checks.filter((check) => check.status === "attention").length;
  const score = Math.round(
    checks.reduce((sum, check) => {
      if (check.status === "ready") return sum + 100;
      if (check.status === "attention") return sum + 55;
      return sum;
    }, 0) / checks.length
  );
  const status: DemoReadinessStatus = score >= 85 ? "ready" : score >= 55 ? "attention" : "missing";
  const label =
    status === "ready"
      ? "iOS demo ready"
      : score >= 70
        ? "Demo close"
        : status === "attention"
          ? "Demo needs a pass"
          : "Demo not ready";
  const nextOpenCheck = checks.find((check) => check.status !== "ready");
  const nextStep = nextOpenCheck
    ? `${nextOpenCheck.label}: ${nextOpenCheck.detail}`
    : "Run a fresh iPhone walkthrough across Today, Inventory, Orders, Insights, Setup, and Settings.";

  return {
    score,
    label,
    status,
    completedCount,
    attentionCount,
    totalCount: checks.length,
    checks,
    walkthroughChecks,
    nextStep
  };
}

export function buildDemoWalkthroughChecklist(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  recommendations: PurchaseRecommendation[],
  insights: Insight[],
  mappings: MenuItemIngredient[],
  orders: SupplierOrder[] = []
): DemoWalkthroughCheck[] {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurant.id);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const restaurantRecommendations = recommendations.filter((recommendation) => recommendation.restaurant_id === restaurant.id);
  const restaurantInsights = insights.filter((insight) => insight.restaurant_id === restaurant.id);
  const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurant.id);
  const recipeBaseline = buildRecipeBaselineSummary(restaurant.id, restaurantSales, mappings, restaurantInventory);
  const pendingRecommendations = restaurantRecommendations.filter((recommendation) => recommendation.status === "pending");
  const handledRecommendations = restaurantRecommendations.filter(
    (recommendation) => recommendation.status === "approved" || recommendation.status === "dismissed" || recommendation.status === "ordered"
  );
  const draftOrders = restaurantOrders.filter((order) => order.status === "draft");
  const sentOrders = restaurantOrders.filter((order) => order.status === "sent" || order.status === "completed");
  const hasDemoDatasetProfile = isDemoDatasetRestaurantName(restaurant.name);

  return [
    {
      id: "enter_demo_data",
      label: "Enter demo data",
      description: hasDemoDatasetProfile
        ? `The walkthrough opens on ${DEMO_DATASET.restaurant.name}.`
        : "Use the local demo entry or reset action to load the replaceable demo dataset.",
      route: "/login",
      status: hasDemoDatasetProfile ? "ready" : "attention"
    },
    {
      id: "view_today_command_center",
      label: "View Today command center",
      description: restaurantSales.length > 0
        ? "Today has sales, stock risk, recommendations, and next action context."
        : "Load demo POS sales before using Today as the walkthrough anchor.",
      route: "/today",
      status: restaurantSales.length > 0 && restaurantInventory.length > 0 ? "ready" : "missing"
    },
    {
      id: "update_inventory_count",
      label: "Update inventory count",
      description: restaurantInventory.length > 0
        ? "Inventory has items that can be opened and counted safely."
        : "Add inventory items before testing count changes.",
      route: "/inventory",
      status: restaurantInventory.length > 0 ? "ready" : "missing"
    },
    {
      id: "approve_dismiss_undo_recommendation",
      label: "Approve, dismiss, and undo",
      description: pendingRecommendations.length > 0
        ? "Suggested orders are available for approve/dismiss/undo testing."
        : handledRecommendations.length > 0
          ? "Handled recommendations exist; refresh counts or reset demo to create pending decisions."
          : "Generate purchase recommendations before testing recovery actions.",
      route: "/orders",
      status: pendingRecommendations.length > 0 ? "ready" : handledRecommendations.length > 0 ? "attention" : "missing"
    },
    {
      id: "open_supplier_draft",
      label: "Open supplier draft",
      description: draftOrders.length > 0
        ? "At least one supplier draft can be opened and reviewed."
        : "Approve a suggested item to build a supplier draft.",
      route: "/orders",
      status: draftOrders.length > 0 ? "ready" : "attention"
    },
    {
      id: "copy_supplier_order",
      label: "Copy supplier order",
      description: draftOrders.length > 0
        ? "Draft orders can be copied without sending live email."
        : "Create a draft before testing copy.",
      route: "/orders",
      status: draftOrders.length > 0 ? "ready" : "attention"
    },
    {
      id: "view_sent_history",
      label: "View sent-history state",
      description: sentOrders.length > 0
        ? "Sent supplier work is available in order history."
        : "Mark one demo draft sent to show history.",
      route: "/orders",
      status: sentOrders.length > 0 ? "ready" : "attention"
    },
    {
      id: "inspect_insights",
      label: "Inspect insights",
      description: restaurantInsights.length > 0
        ? "Insights have operational signals to review."
        : "Generate or load demo insights before showing the manager brief.",
      route: "/insights",
      status: restaurantInsights.length > 0 ? "ready" : "attention"
    },
    {
      id: "inspect_pos_readiness",
      label: "Inspect POS readiness",
      description: restaurantSales.length > 0
        ? "POS readiness shows demo sales are available and live credentials are restricted."
        : "Load demo sales before testing POS readiness.",
      route: "/settings/pos",
      status: restaurantSales.length > 0 ? "ready" : "missing"
    },
    {
      id: "inspect_recipe_readiness",
      label: "Inspect recipe readiness",
      description: recipeBaseline.coveragePercent >= 85
        ? "Recipe baselines can explain POS-driven ingredient depletion."
        : "Recipe coverage needs more dish-to-ingredient baselines.",
      route: "/settings/recipes",
      status: recipeBaseline.coveragePercent >= 85 ? "ready" : recipeBaseline.ingredientMappings > 0 ? "attention" : "missing"
    },
    {
      id: "reset_demo",
      label: "Reset demo safely",
      description: "Settings can restore the local demo dataset without touching hosted Supabase.",
      route: "/settings",
      status: "ready"
    },
    {
      id: "complete_setup_path",
      label: "Complete setup path",
      description: "Setup can collect profile, inventory, recipes, supplier, email, and import readiness data.",
      route: "/setup",
      status: "ready"
    },
    {
      id: "run_without_live_integrations",
      label: "Run without live integrations",
      description: "Supplier email, POS sync, Gmail OAuth, and AI provider calls remain draft/readiness-only.",
      route: "/settings",
      status: "ready"
    }
  ];
}

export function buildSetupReadinessSummary({
  restaurant,
  sales,
  inventoryItems,
  mappings,
  orders = [],
  emailConnection
}: {
  restaurant: Restaurant;
  sales: PosSale[];
  inventoryItems: InventoryItem[];
  mappings: MenuItemIngredient[];
  orders?: SupplierOrder[];
  emailConnection: RestaurantEmailConnection | null;
}): SetupReadinessSummary {
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const restaurantMappings = mappings.filter((mapping) => mapping.restaurant_id === restaurant.id);
  const supplierNames = [...new Set(restaurantInventory.map((item) => item.supplier_name).filter(Boolean))];
  const recipeBaseline = buildRecipeBaselineSummary(restaurant.id, sales, mappings, inventoryItems);
  const analytics = buildConditionalAnalyticsSummary(restaurant.id, sales, restaurantMappings, restaurantInventory, orders);

  const missingProfile = [
    !restaurant.name.trim() ? "restaurant name" : null,
    !restaurant.cuisine_type?.trim() ? "cuisine/service style" : null,
    restaurant.operational_profile.orderCadence.length === 0 ? "order cadence" : null
  ].filter((item): item is string => Boolean(item));
  const missingInventory = [
    restaurantInventory.length < 5 ? "at least five current inventory items" : null,
    supplierNames.length === 0 ? "supplier names" : null,
    restaurantInventory.some((item) => !item.unit.trim()) ? "ingredient units" : null,
    restaurantInventory.some((item) => item.par_level <= 0) ? "par levels" : null
  ].filter((item): item is string => Boolean(item));
  const missingRecipes = [
    restaurantMappings.length === 0 ? "dish-to-ingredient baselines" : null,
    recipeBaseline.posItemsMissingRecipes.length > 0
      ? `${recipeBaseline.posItemsMissingRecipes.length} unmapped POS menu items`
      : null
  ].filter((item): item is string => Boolean(item));
  const missingSuppliers = supplierNames.length === 0 ? ["supplier list"] : [];
  const missingEmailSender = emailConnection?.status !== "connected" || !emailConnection.sender_email;

  const rawSteps = [
    {
      id: "profile" as const,
      label: "Profile",
      detail: missingProfile.length === 0 ? restaurant.name : "Name, service, cadence",
      missing: missingProfile
    },
    {
      id: "inventory" as const,
      label: "Inventory",
      detail:
        missingInventory.length === 0
          ? `${restaurantInventory.length} items, ${supplierNames.length} suppliers`
          : "Counts, suppliers, units",
      missing: missingInventory
    },
    {
      id: "recipes" as const,
      label: "Recipes",
      detail:
        missingRecipes.length === 0
          ? `${recipeBaseline.coveragePercent}% POS coverage`
          : "Ingredient-per-dish links",
      missing: missingRecipes
    },
    {
      id: "email" as const,
      label: "Email",
      detail: missingEmailSender ? "Gmail sender not linked" : emailConnection.sender_email ?? "Gmail ready",
      missing: missingEmailSender ? ["restaurant Gmail sender"] : []
    }
  ];
  const firstMissing = rawSteps.find((step) => step.missing.length > 0)?.id ?? "email";
  const steps = rawSteps.map((step) => {
    const status: SetupReadinessStatus =
      step.missing.length === 0
        ? "complete"
        : step.id === firstMissing
          ? "active"
          : "missing";
    return { ...step, status };
  });
  const percent = Math.round(
    steps.reduce((sum, step) => (step.status === "complete" ? sum + 25 : sum), 0)
  );

  return {
    percent,
    currentStep: firstMissing,
    steps,
    missingInventory,
    missingRecipes,
    missingSuppliers,
    missingEmailSender,
    canShowSalesRhythm: analytics.canShowSalesRhythm,
    canShowSupplierTrend: analytics.canShowSupplierTrend,
    canShowRecipeCoverage: analytics.canShowRecipeCoverage,
    emailConnectionStatus: emailConnection?.status ?? "not_connected"
  };
}

export function buildConditionalAnalyticsSummary(
  restaurantId: string,
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  inventoryItems: InventoryItem[],
  orders: SupplierOrder[] = []
): ConditionalAnalyticsSummary {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurantId);
  const restaurantMappings = mappings.filter((mapping) => mapping.restaurant_id === restaurantId);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurantId);
  const orderHistory = orders.filter(
    (order) => order.restaurant_id === restaurantId && (order.status === "sent" || order.status === "completed")
  );
  const canShowSalesRhythm =
    restaurantSales.length >= 2 && restaurantSales.some((sale) => sale.gross_sales > 0 || sale.quantity_sold > 0);
  const canShowSupplierTrend = orderHistory.length >= 2;
  const canShowRecipeCoverage = restaurantMappings.length >= 3 && restaurantInventory.length >= 3;
  const supplierTrend = buildSupplierOrderTrend(orderHistory);

  return {
    canShowSalesRhythm,
    canShowSupplierTrend,
    canShowRecipeCoverage,
    supplierTrend,
    supplierTrendLabel: canShowSupplierTrend
      ? `${orderHistory.length} sent supplier orders`
      : "Supplier trend needs sent order history",
    emptyStates: {
      salesRhythm: "Connect POS sales or load demo sales before charting service rhythm.",
      supplierTrend: "Send at least two supplier drafts before Mise charts ordering rhythm.",
      recipeCoverage: "Add ingredient-per-dish baselines before Mise can score recipe coverage."
    }
  };
}

export function buildSupplierEmailPayload(
  restaurant: Restaurant,
  order: SupplierOrder,
  emailConnection: RestaurantEmailConnection | null,
  recipients: SupplierRecipient[] = []
): SupplierEmailPayload {
  const recipient = recipients.find(
    (item) =>
      item.restaurant_id === restaurant.id &&
      item.supplier_name.trim().toLowerCase() === order.supplier_name.trim().toLowerCase()
  );
  const to = recipient?.email ?? null;
  const from = emailConnection?.sender_email ?? null;
  const subject = `${restaurant.name} order for ${order.supplier_name}`;
  const blockedReason =
    emailConnection?.status !== "connected"
      ? "Connect the restaurant Gmail sender before Mise can send supplier email."
      : !from
        ? "Verify a sender address for this restaurant."
        : !to
          ? `Add a supplier email for ${order.supplier_name}.`
          : null;

  return {
    orderId: order.id,
    supplierName: order.supplier_name,
    to,
    from,
    subject,
    body: order.order_message,
    canSend: blockedReason === null,
    blockedReason
  };
}

function buildSupplierOrderTrend(orderHistory: SupplierOrder[]) {
  const counts = new Map<string, number>();
  orderHistory
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((order) => {
      const label = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(new Date(order.created_at));
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

  return [...counts.entries()].slice(-5).map(([label, orders]) => ({ label, orders }));
}

export function buildRecommendationInserts(
  restaurantId: string,
  inventoryItems: InventoryItem[],
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  recommendationHistory: PurchaseRecommendation[] = [],
  operatingDate = defaultOperatingDate(restaurantId),
  receivingHistory: Parameters<typeof buildReceiveFillBiasByItem>[0] = [],
  wasteHistory: Parameters<typeof buildWasteBiasByItem>[0] = [],
  countVarianceHistory: Parameters<typeof buildCountShrinkBiasByItem>[0] = [],
  managerCorrectionHistory: Parameters<typeof buildManagerCorrectionBiasByItem>[0] = []
) {
  const learnedQuantities = buildLearnedOrderQuantities(restaurantId, recommendationHistory);
  const receiveBiasByItem = buildReceiveFillBiasByItem(receivingHistory);
  const wasteBiasByItem = buildWasteBiasByItem(wasteHistory);
  const countShrinkBiasByItem = buildCountShrinkBiasByItem(countVarianceHistory);
  const managerCorrectionBiasByItem = buildManagerCorrectionBiasByItem(managerCorrectionHistory);

  return inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .filter((item) => !shouldSuppressRecommendationForItem(restaurantId, item, recommendationHistory))
    .map((item) => ({
      item,
      prediction: buildInventoryPrediction(item, sales, mappings, operatingDate)
    }))
    .filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low")
    .map(({ item, prediction }) => {
      const learned = applyStackedOrderLearning({
        item,
        prediction,
        learnedQuantities,
        receiveBias: receiveBiasByItem.get(item.id),
        wasteBias: wasteBiasByItem.get(item.id),
        countShrinkBias: countShrinkBiasByItem.get(item.id),
        managerCorrectionBias: managerCorrectionBiasByItem.get(item.id)
      });
      return {
        restaurant_id: restaurantId,
        inventory_item_id: item.id,
        item_name: item.item_name,
        supplier_name: item.supplier_name,
        recommended_quantity: learned.recommendedQuantity,
        original_recommended_quantity: null,
        dismiss_reason: null,
        unit: item.unit,
        reason: learnedRecommendationReason(
          item,
          prediction,
          learned.learnedQuantity,
          learned.reasonFragments.length ? learned.reasonFragments.join(" ") : undefined
        ),
        urgency: prediction.urgency,
        status: "pending" as RecommendationStatus,
        supplier_order_id: null
      };
    });
}

export function severityRankForUrgency(urgency: Urgency) {
  if (urgency === "high") return 3;
  if (urgency === "medium") return 2;
  return 1;
}
