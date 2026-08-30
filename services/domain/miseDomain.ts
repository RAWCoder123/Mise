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
  SupplierOrder,
  SupplierRecipient,
  SupplierOrderStatus,
  TodaySummary,
  Urgency
} from "../../types/mise";
import type { PurchaseRecommendationPresentationDescriptor } from "../../types/presentation";
import { formatQuantity, nextDateKeyInTimeZone, toDateKeyInTimeZone } from "../../utils/format";
import { getInventoryStatus, getInventoryStatusForQuantity } from "../../utils/inventory";
import { ORDER_MESSAGE_MAX_BYTES, truncateUtf8 } from "./securityLimits";
import { inventoryUnitsAreCompatible } from "./inventoryUnits";
import {
  dayResolutionConsumptionIsAfterCount,
  missingInventoryCountEvidence,
  verifiedCountSupersedes,
  type InventoryCountEvidence,
  type InventoryCountEvidenceMap
} from "./inventoryCountAuthority";
import { buildRecordedSalesTrend } from "./salesTrends";
import {
  recipeDemandKey,
  saleDemandKey,
  saleMatchesRecipe,
  saleRequiresVerifiedProviderIdentity,
  type VerifiedProviderSaleMapping
} from "./providerSaleIdentity";
import type { PurchaseAuthorityResult } from "./purchaseAuthority";

/**
 * Optional seeded demand source for tenants without sales history.
 * Injected by demo callers; real tenants never receive one, so the domain
 * layer stays free of demo dataset knowledge.
 */
export type DemandFallback = (menuItemName: string) => number | undefined;

export function createId(prefix: string) {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : createFallbackId();
  return `${prefix}_${uuid}`;
}

function createFallbackId() {
  // Prefer CSPRNG bytes when randomUUID is unavailable (older runtimes).
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isToday(sale: PosSale, operatingDate: string) {
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
  operatingDate: string,
  _mappings: MenuItemIngredient[] = [],
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
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
      const itemKey = saleDemandKey(sale, providerMappings);
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

export function learnedRecommendationReason(
  item: InventoryItem,
  prediction: InventoryPrediction,
  learnedQuantity: number | undefined
) {
  const reason = recommendationReason(item, prediction);
  if (learnedQuantity === undefined || learnedQuantity === prediction.suggestedOrderQuantity) {
    return reason;
  }
  return `${reason} Mise is using a stable median from recent approved orders: ${formatQuantity(learnedQuantity)} ${item.unit}.`;
}

/** Locale-neutral reason descriptor; screens localize at render time. */
export function purchaseRecommendationPresentation(
  item: InventoryItem,
  prediction: InventoryPrediction,
  learnedQuantity?: number
): PurchaseRecommendationPresentationDescriptor {
  const status: "Low" | "Critical" =
    prediction.projectedStatus === "Critical" ? "Critical" : "Low";
  const learned =
    learnedQuantity !== undefined && learnedQuantity !== prediction.suggestedOrderQuantity
      ? learnedQuantity
      : null;
  return {
    code: "purchase.recommendation.stock_risk",
    values: {
      itemName: item.item_name,
      suggestedOrderQuantity: learnedQuantity ?? prediction.suggestedOrderQuantity,
      unit: item.unit,
      supplierName: item.supplier_name,
      status,
      learnedQuantity: learned
    }
  };
}

export function buildLearnedOrderQuantities(restaurantId: string, history: PurchaseRecommendation[] = []) {
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

export function boundedLearnedQuantity(
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

/**
 * A handled recommendation stays suppressed until authoritative physical evidence
 * proves the shelf was recounted after the operator handled it.
 *
 * `item.last_updated` is deliberately not consulted: it moves for par, reorder,
 * supplier, and cost edits, so it would unsuppress purchasing on a metadata change.
 * With no verified count evidence Mise fails closed and keeps the suppression.
 */
export function shouldSuppressRecommendationForItem(
  restaurantId: string,
  item: InventoryItem,
  history: PurchaseRecommendation[] = [],
  countEvidence?: InventoryCountEvidenceMap
) {
  const handled = latestHandledRecommendationForItem(restaurantId, item.id, history);
  if (!handled) return false;
  const evidence = inventoryCountEvidenceFor(countEvidence, restaurantId, item.id);
  return !verifiedCountSupersedes(evidence, handled.created_at);
}

/** Falls back to fail-closed "no verified count" when evidence was not supplied. */
function inventoryCountEvidenceFor(
  countEvidence: InventoryCountEvidenceMap | undefined,
  restaurantId: string,
  inventoryItemId: string
): InventoryCountEvidence {
  const evidence = countEvidence?.get(inventoryItemId);
  if (evidence && evidence.restaurantId === restaurantId) return evidence;
  return missingInventoryCountEvidence(restaurantId, inventoryItemId);
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
  operatingDate: string,
  demandFallback?: DemandFallback,
  countEvidence?: InventoryCountEvidenceMap,
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
): InventoryOutlookItem[] {
  const historicalBaselines = buildHistoricalDemandBaselines(
    restaurantId,
    sales,
    operatingDate,
    mappings,
    providerMappings
  );
  return inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .map((item) => ({
      item,
      prediction: buildInventoryPrediction(
        item,
        sales,
        mappings,
        operatingDate,
        historicalBaselines,
        demandFallback,
        inventoryCountEvidenceFor(countEvidence, restaurantId, item.id),
        providerMappings
      )
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
  operatingDate: string,
  historicalBaselines = buildHistoricalDemandBaselines(item.restaurant_id, sales, operatingDate),
  demandFallback?: DemandFallback,
  countEvidence: InventoryCountEvidence = missingInventoryCountEvidence(item.restaurant_id, item.id),
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
): InventoryPrediction {
  const identityAwareHistoricalBaselines = providerMappings.length > 0
    ? buildHistoricalDemandBaselines(
      item.restaurant_id,
      sales,
      operatingDate,
      mappings,
      providerMappings
    )
    : historicalBaselines;
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
  const mappedTodayUsage = relevantMappings.reduce((sum, mapping) => {
    const sold = todaySales
      .filter((sale) => saleMatchesRecipe(sale, mapping, providerMappings))
      .reduce((saleSum, sale) => saleSum + finiteNonNegative(sale.quantity_sold), 0);
    return sum + sold * finiteNonNegative(mapping.quantity_used_per_sale);
  }, 0);
  // `pos_sales` rows carry day resolution only, so a verified count taken inside
  // today's operating day already observed part of today's sales. Those sales must
  // not deplete the counted baseline a second time; they are reported as
  // unattributed instead, which drops the item out of temporal authority.
  const todayUsageIsAfterCount =
    countEvidence.status !== "verified" ||
    dayResolutionConsumptionIsAfterCount(countEvidence.countedOperatingDate, operatingDate);
  const recentUsage = todayUsageIsAfterCount ? mappedTodayUsage : 0;
  const unattributedTodayDepletion = todayUsageIsAfterCount ? 0 : mappedTodayUsage;
  let historySampleDays = 0;
  let hasRestaurantHistory = false;
  let hasDemoFallback = false;
  const baselineUsage = relevantMappings.reduce((sum, mapping) => {
    const learned = identityAwareHistoricalBaselines.get(recipeDemandKey(mapping));
    if (learned) {
      historySampleDays = Math.max(historySampleDays, learned.sampleDays);
      hasRestaurantHistory = true;
    }
    const fallback = demandFallback?.(mapping.menu_item_name) ?? 0;
    if (!learned && fallback > 0) hasDemoFallback = true;
    const baseline = learned?.dailyQuantity ?? fallback;
    return sum + baseline * finiteNonNegative(mapping.quantity_used_per_sale);
  }, 0);
  // Demand rate still uses every mapped sale observed today, even sales the count
  // already absorbed; only the depletion arithmetic is restricted to the count window.
  const averageDailyUsage =
    mappedTodayUsage > 0 && baselineUsage > 0
      ? mappedTodayUsage * 0.35 + baselineUsage * 0.65
      : mappedTodayUsage || baselineUsage;
  const projectedQuantity = Math.max(0, safeItem.current_quantity - recentUsage);
  const daysCoverage = averageDailyUsage > 0 ? projectedQuantity / averageDailyUsage : null;
  const quantityStatus = getInventoryStatusForQuantity(safeItem, projectedQuantity);
  const computedStatus = statusWithCoverageRisk(quantityStatus, daysCoverage, projectedQuantity);
  // `current_quantity` was last overwritten by an invalid future-dated count, so the
  // number cannot support a confident Good/Low/Critical claim. Watch is the existing
  // "counts need a look" state, which is the only honest read until a real recount.
  const contaminatedProjection = countEvidence.status === "contaminated";
  const projectedStatus: InventoryStatus = contaminatedProjection ? "Watch" : computedStatus;
  const demandTrend = getDemandTrend(mappedTodayUsage, baselineUsage);
  const suggestedOrderQuantity = roundOrderQuantity(safeItem.par_level - projectedQuantity);
  const coverageLabel = getCoverageLabel(safeItem, daysCoverage, averageDailyUsage, projectedQuantity);
  const trendLabel = getTrendLabel(demandTrend);
  const suggestedAction = getSuggestedAction(safeItem, suggestedOrderQuantity, daysCoverage, projectedStatus);
  const urgency: Urgency = projectedStatus === "Critical" ? "high" : projectedStatus === "Low" ? "medium" : "low";
  const historySource: InventoryPrediction["historySource"] = hasRestaurantHistory
    ? "restaurant_history"
    : hasDemoFallback
      ? "demo_fallback"
      : mappedTodayUsage > 0
        ? "current_day"
        : "none";
  const basis = hasRestaurantHistory
    ? mappedTodayUsage > 0
      ? `Based on today's mapped POS sales and ${historySampleDays} recent service days`
      : `Based on ${historySampleDays} recent service days mapped through recipe baselines`
    : hasDemoFallback
      ? "Based on the demo demand pattern and mapped recipe baselines"
      : mappedTodayUsage > 0
        ? "Based on today's POS sales mapped through recipe baselines"
        : "Mise is still learning this item";
  const depletionCopy =
    recentUsage > 0
      ? `POS sales have depleted about ${formatQuantity(recentUsage)} ${item.unit} today. Projected on hand is ${formatQuantity(projectedQuantity)} ${item.unit}.`
      : unattributedTodayDepletion > 0
        ? `Today's verified count already reflects ${formatQuantity(unattributedTodayDepletion)} ${item.unit} of mapped POS demand, so Mise is not subtracting it again. Projected on hand is ${formatQuantity(projectedQuantity)} ${item.unit}.`
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
    whyItMatters,
    countEvidence: contaminatedProjection
      ? "contaminated_projection"
      : countEvidence.status === "verified"
        ? "verified_count"
        : "no_verified_count",
    countedAt: countEvidence.countedAt,
    countAgeHours: countEvidence.countAgeHours,
    countFreshness: countEvidence.freshness,
    unattributedTodayDepletion,
    isTemporallyAuthoritative: countEvidence.status === "verified" && unattributedTodayDepletion === 0
  };
}

function statusWithCoverageRisk(
  quantityStatus: InventoryStatus,
  daysCoverage: number | null,
  projectedQuantity: number
): InventoryStatus {
  if (projectedQuantity <= 0 || (daysCoverage !== null && daysCoverage <= 0.25)) {
    return "Critical";
  }
  const coverageStatus: InventoryStatus =
    daysCoverage === null
      ? "Good"
      : daysCoverage <= 0.75
        ? "Low"
        : daysCoverage <= 1.5
          ? "Watch"
          : "Good";
  const rank: Record<InventoryStatus, number> = {
    Good: 0,
    Watch: 1,
    Low: 2,
    Critical: 3
  };
  return rank[coverageStatus] > rank[quantityStatus] ? coverageStatus : quantityStatus;
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
  inventoryItems: InventoryItem[],
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
) {
  const itemsById = new Map(inventoryItems.map((item) => [item.id, item]));
  const usage = new Map<string, { itemName: string; quantity: number; unit: string }>();

  sales.forEach((sale) => {
    mappings
      .filter(
        (mapping) =>
          mapping.restaurant_id === sale.restaurant_id &&
          saleMatchesRecipe(sale, mapping, providerMappings)
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

export function buildRecipeBaselineSummary(
  restaurantId: string,
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  inventoryItems: InventoryItem[],
  operatingDate: string,
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
): RecipeBaselineSummary {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurantId);
  const todaySales = restaurantSales.filter((sale) => isToday(sale, operatingDate));
  const restaurantMappings = mappings.filter((mapping) => mapping.restaurant_id === restaurantId);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurantId);
  const itemNames = new Map(restaurantInventory.map((item) => [item.id, item.item_name]));
  const saleKey = (sale: PosSale) => {
    if (saleRequiresVerifiedProviderIdentity(sale)) {
      const menuItemId = saleDemandKey(sale, providerMappings);
      if (menuItemId) return menuItemId;
      return sale.source_record_id
        ?? `${sale.source_pos ?? "provider"}:${sale.provider_location_id ?? "unknown-location"}:${sale.provider_variation_id ?? sale.provider_catalog_item_id ?? sale.item_name}`;
    }
    return sale.item_name.trim().toLowerCase().replace(/\s+/g, " ");
  };
  const soldMenuItems = new Set(restaurantSales.map(saleKey));
  const mappedMenuItems = new Set(restaurantMappings.map((mapping) => mapping.menu_item_name));
  const inventoryItemsLinked = new Set(restaurantMappings.map((mapping) => mapping.inventory_item_id));
  const posItemsCovered = new Set(
    restaurantSales
      .filter((sale) => restaurantMappings.some((mapping) => saleMatchesRecipe(sale, mapping, providerMappings)))
      .map(saleKey)
  ).size;
  const posItemsMissingRecipes = restaurantSales
    .filter((sale) => !restaurantMappings.some((mapping) => saleMatchesRecipe(sale, mapping, providerMappings)))
    .map((sale) => sale.item_name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b));
  const coveragePercent =
    soldMenuItems.size > 0
      ? Math.round((posItemsCovered / soldMenuItems.size) * 100)
      : mappedMenuItems.size > 0
        ? 100
        : 0;
  const items = [...mappedMenuItems]
    .map((menuItemName) => {
      const linkedMappings = restaurantMappings.filter((mapping) => mapping.menu_item_name === menuItemName);
      const todayQuantitySold = todaySales
        .filter((sale) => linkedMappings.some((mapping) => saleMatchesRecipe(sale, mapping, providerMappings)))
        .reduce((sum, sale) => sum + sale.quantity_sold, 0);

      return {
        menu_item_name: menuItemName,
        ingredientCount: linkedMappings.length,
        ingredients: linkedMappings
          .map((mapping) => ({
            mappingId: mapping.id,
            inventoryItemId: mapping.inventory_item_id,
            itemName: itemNames.get(mapping.inventory_item_id) ?? "Inventory item",
            quantityUsedPerSale: mapping.quantity_used_per_sale,
            unit: mapping.unit
          }))
          .sort((a, b) => a.itemName.localeCompare(b.itemName)),
        linkedInventoryItems: linkedMappings
          .map((mapping) => itemNames.get(mapping.inventory_item_id) ?? "Inventory item")
          .sort((a, b) => a.localeCompare(b)),
        todayQuantitySold
      };
    })
    .sort((a, b) => b.todayQuantitySold - a.todayQuantitySold || a.menu_item_name.localeCompare(b.menu_item_name));

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

  return {
    menuItemsTracked: mappedMenuItems.size,
    ingredientMappings: restaurantMappings.length,
    inventoryItemsLinked: inventoryItemsLinked.size,
    posItemsCovered,
    posItemsMissingRecipes,
    coveragePercent,
    credibilityLabel,
    operatorCopy,
    items: items.slice(0, 6)
  };
}

export function buildInsightsFromData(
  restaurantId: string,
  inventoryItems: InventoryItem[],
  sales: PosSale[],
  mappings: MenuItemIngredient[],
  operatingDate: string,
  demandFallback?: DemandFallback,
  countEvidence?: InventoryCountEvidenceMap,
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
) {
  const now = new Date().toISOString();
  const todaySales = sales.filter(
    (sale) => sale.restaurant_id === restaurantId && isToday(sale, operatingDate)
  );
  const historicalBaselines = buildHistoricalDemandBaselines(
    restaurantId,
    sales,
    operatingDate,
    mappings,
    providerMappings
  );
  const insights: Insight[] = [];
  const usage = estimateUsage(todaySales, mappings, inventoryItems, providerMappings);
  const outlooks = buildInventoryOutlooks(
    restaurantId,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    demandFallback,
    countEvidence,
    providerMappings
  );

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
        recommended_action: `Check the walk-in, then add ${formatQuantity(prediction.suggestedOrderQuantity)} ${item.unit} on the next ${item.supplier_name} ticket.`,
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
      demandFallback?.(sale.item_name);
    if (!baseline) return;
    const lift = Math.round(((sale.quantity_sold - baseline) / baseline) * 100);
    if (lift < 20) return;

    insights.push({
      id: `insight_spike_${sale.item_name.replace(/\s+/g, "_").toLowerCase()}`,
      restaurant_id: restaurantId,
      insight_type: "sales",
      title: `${sale.item_name} demand is rising`,
      description: `${sale.item_name} sold ${lift}% more than its usual day so far.`,
      why_it_matters: "Pull prep forward or you may 86 linked dishes before the next order lands.",
      recommended_action: `Before the next prep window, confirm walk-in counts for ingredients tied to ${sale.item_name.toLowerCase()}.`,
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
        why_it_matters: "A top seller can get 86'd mid-service if this ingredient runs out.",
        recommended_action: `Before prep, put ${lowIngredient.item_name.toLowerCase()} on the next ${lowIngredient.supplier_name} ticket.`,
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
        why_it_matters: "Extra on hand can spoil or tie up cash before the next rush needs it.",
        recommended_action: `Skip or trim the next ${item.item_name.toLowerCase()} order unless tonight’s sales stay hot.`,
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

export function buildTodaySummary(
  restaurant: Restaurant,
  sales: PosSale[],
  inventoryItems: InventoryItem[],
  recommendations: PurchaseRecommendation[],
  insights: Insight[],
  mappings: MenuItemIngredient[] = [],
  operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone),
  demandFallback?: DemandFallback,
  countEvidence?: InventoryCountEvidenceMap,
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
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
    demandFallback,
    countEvidence,
    providerMappings
  );
  const recipeBaseline = buildRecipeBaselineSummary(
    restaurant.id,
    sales,
    mappings,
    inventoryItems,
    operatingDate,
    providerMappings
  );
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
      const current = grouped.get(recommendation.supplier_id) ?? [];
      current.push(recommendation);
      grouped.set(recommendation.supplier_id, current);
    });

  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? "UTC";
  return [...grouped.entries()].map(([supplierId, items]) => {
    const supplierName = items[0]?.supplier_name ?? "Supplier";
    const deliveryDate = nextDateKeyInTimeZone(now, timeZone);
    return {
      id: createId("order"),
      restaurant_id: restaurantId,
      supplier_id: supplierId,
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
  outcome: RecommendationWorkflowOutcome | "blocked";
  recommendation: PurchaseRecommendation;
  order: SupplierOrder | null;
  previousStatus: RecommendationStatus;
  authority?: PurchaseAuthorityResult | null;
}

export interface SupplierOrderSentWorkflowResult {
  outcome: RecommendationWorkflowOutcome;
  order: SupplierOrder;
  orderedRecommendations: PurchaseRecommendation[];
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
  const activeSupplierIds = pendingRecommendations.length > 0
    ? pendingRecommendations.map((recommendation) => recommendation.supplier_id)
    : draftOrders.map((order) => order.supplier_id);
  const supplierCount = new Set(activeSupplierIds).size;
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
  orders: SupplierOrder[] = [],
  options: {
    demandFallback?: DemandFallback;
    demoProfileName?: string | null;
    countEvidence?: InventoryCountEvidenceMap;
    providerMappings?: readonly VerifiedProviderSaleMapping[];
  } = {}
): DemoReadinessSummary {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurant.id);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const restaurantRecommendations = recommendations.filter((recommendation) => recommendation.restaurant_id === restaurant.id);
  const restaurantInsights = insights.filter((insight) => insight.restaurant_id === restaurant.id);
  const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurant.id);
  const operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone);
  const suppliers = new Set(restaurantInventory.map((item) => item.supplier_id));
  const recipeBaseline = buildRecipeBaselineSummary(
    restaurant.id,
    sales,
    mappings,
    inventoryItems,
    operatingDate,
    options.providerMappings ?? []
  );
  const outlooks = buildInventoryOutlooks(
    restaurant.id,
    inventoryItems,
    sales,
    mappings,
    operatingDate,
    options.demandFallback,
    options.countEvidence,
    options.providerMappings ?? []
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
    restaurantOrders,
    { demoProfileName: options.demoProfileName }
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
  orders: SupplierOrder[] = [],
  options: { demoProfileName?: string | null } = {}
): DemoWalkthroughCheck[] {
  const restaurantSales = sales.filter((sale) => sale.restaurant_id === restaurant.id);
  const restaurantInventory = inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const restaurantRecommendations = recommendations.filter((recommendation) => recommendation.restaurant_id === restaurant.id);
  const restaurantInsights = insights.filter((insight) => insight.restaurant_id === restaurant.id);
  const restaurantOrders = orders.filter((order) => order.restaurant_id === restaurant.id);
  const operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone);
  const recipeBaseline = buildRecipeBaselineSummary(restaurant.id, restaurantSales, mappings, restaurantInventory, operatingDate);
  const pendingRecommendations = restaurantRecommendations.filter((recommendation) => recommendation.status === "pending");
  const handledRecommendations = restaurantRecommendations.filter(
    (recommendation) => recommendation.status === "approved" || recommendation.status === "dismissed" || recommendation.status === "ordered"
  );
  const draftOrders = restaurantOrders.filter((order) => order.status === "draft");
  const sentOrders = restaurantOrders.filter((order) => order.status === "sent" || order.status === "completed");
  const hasDemoDatasetProfile = Boolean(options.demoProfileName);

  return [
    {
      id: "enter_demo_data",
      label: "Enter demo data",
      description: hasDemoDatasetProfile
        ? `The walkthrough opens on ${options.demoProfileName}.`
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
  const supplierIds = [...new Set(restaurantInventory.map((item) => item.supplier_id).filter(Boolean))];
  // Use the restaurant's own calendar so evening counts west of UTC do not
  // roll into the wrong service day.
  const operatingDate = toDateKeyInTimeZone(new Date(), restaurant.timezone);
  const recipeBaseline = buildRecipeBaselineSummary(restaurant.id, sales, mappings, inventoryItems, operatingDate);
  const analytics = buildConditionalAnalyticsSummary(restaurant.id, sales, restaurantMappings, restaurantInventory, orders);

  const missingProfile = [
    !restaurant.name.trim() ? "restaurant name" : null,
    !restaurant.cuisine_type?.trim() ? "cuisine/service style" : null,
    restaurant.operational_profile.orderCadence.length === 0 ? "order cadence" : null
  ].filter((item): item is string => Boolean(item));
  const missingInventory = [
    restaurantInventory.length < 5 ? "at least five current inventory items" : null,
    supplierIds.length === 0 ? "supplier identities" : null,
    restaurantInventory.some((item) => !item.unit.trim()) ? "ingredient units" : null,
    restaurantInventory.some((item) => item.par_level <= 0) ? "par levels" : null
  ].filter((item): item is string => Boolean(item));
  const missingRecipes = [
    restaurantMappings.length === 0 ? "dish-to-ingredient baselines" : null,
    recipeBaseline.posItemsMissingRecipes.length > 0
      ? `${recipeBaseline.posItemsMissingRecipes.length} unmapped POS menu items`
      : null
  ].filter((item): item is string => Boolean(item));
  const missingSuppliers = supplierIds.length === 0 ? ["supplier list"] : [];
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
          ? `${restaurantInventory.length} items, ${supplierIds.length} suppliers`
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
) {
  const recipient = recipients.find(
    (item) =>
      item.restaurant_id === restaurant.id &&
      item.supplier_id === order.supplier_id
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
    supplierId: order.supplier_id,
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
  recommendationHistory: PurchaseRecommendation[],
  operatingDate: string,
  demandFallback?: DemandFallback,
  countEvidence?: InventoryCountEvidenceMap,
  providerMappings: readonly VerifiedProviderSaleMapping[] = []
) {
  const learnedQuantities = buildLearnedOrderQuantities(restaurantId, recommendationHistory);
  const historicalBaselines = buildHistoricalDemandBaselines(
    restaurantId,
    sales,
    operatingDate,
    mappings,
    providerMappings
  );

  return inventoryItems
    .filter((item) => item.restaurant_id === restaurantId)
    .filter((item) => !shouldSuppressRecommendationForItem(restaurantId, item, recommendationHistory, countEvidence))
    .map((item) => ({
      item,
      prediction: buildInventoryPrediction(
        item,
        sales,
        mappings,
        operatingDate,
        historicalBaselines,
        demandFallback,
        inventoryCountEvidenceFor(countEvidence, restaurantId, item.id),
        providerMappings
      )
    }))
    .filter(({ prediction }) => prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low")
    .map(({ item, prediction }) => {
      const learnedQuantity = boundedLearnedQuantity(item, prediction, learnedQuantities);
      return {
        restaurant_id: restaurantId,
        inventory_item_id: item.id,
        item_name: item.item_name,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        recommended_quantity: learnedQuantity ?? prediction.suggestedOrderQuantity,
        unit: item.unit,
        reason: learnedRecommendationReason(item, prediction, learnedQuantity),
        presentation: purchaseRecommendationPresentation(item, prediction, learnedQuantity),
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
