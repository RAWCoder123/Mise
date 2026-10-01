import type { InventoryItem, InventoryPrediction, InventoryStatus } from "../types/mise";
import {
  inventoryNeedsRecountForFreshness,
  inventoryProjectionAllowsAddToOrder,
  resolveInventoryCountTrustState,
  type InventoryCountTrustState
} from "../services/presentation/inventoryCountFreshnessPresentation";
import type { MessageKey, MessageValues } from "./catalog";

type Translate = (key: MessageKey, values?: MessageValues) => string;
type FormatNumber = (value: number, options?: Intl.NumberFormatOptions) => string;

export interface LocalizedInventoryPrediction {
  status: string;
  coverage: string;
  trend: string;
  action: string;
  basis: string;
  depletion: string;
  confidence: string;
  whyItMatters: string;
  recommendation: string;
  /** Count-trust state for ordering and recount guidance. */
  countTrust: InventoryCountTrustState;
  /** True when Add to order must stay blocked until a fresh verified count. */
  addToOrderBlocked: boolean;
  /** True when stale/unverified freshness should surface recount guidance. */
  needsRecount: boolean;
}

export function localizeInventoryPrediction(
  t: Translate,
  formatNumber: FormatNumber,
  item: InventoryItem,
  prediction: InventoryPrediction
): LocalizedInventoryPrediction {
  const quantity = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const countTrust = resolveInventoryCountTrustState(prediction);
  const needsRecount = inventoryNeedsRecountForFreshness(prediction);
  const coverage = coverageCopy(t, formatNumber, item, prediction, countTrust);
  const action = actionCopy(t, quantity, item, prediction, countTrust);

  return {
    status: inventoryStatusLabel(t, prediction.projectedStatus),
    coverage,
    trend: t(`inventory.prediction.trend.${prediction.demandTrend}`),
    action,
    basis: basisCopy(t, formatNumber, prediction, countTrust),
    depletion:
      prediction.todayDepletion > 0
        ? t("inventory.prediction.depletion.recorded", {
            used: quantity(prediction.todayDepletion),
            projected: quantity(prediction.projectedQuantity),
            unit: item.unit
          })
        : t("inventory.prediction.depletion.none"),
    confidence: confidenceCopy(t, prediction, countTrust),
    whyItMatters: whyCopy(t, item, prediction, countTrust),
    recommendation: recommendationCopy(t, quantity, item, prediction, coverage, countTrust),
    countTrust,
    addToOrderBlocked: !inventoryProjectionAllowsAddToOrder(prediction),
    needsRecount
  };
}

export function inventoryStatusLabel(t: Translate, status: InventoryStatus): string {
  if (status === "Critical") return t("inventory.status.critical");
  if (status === "Low") return t("inventory.status.low");
  if (status === "Watch") return t("inventory.status.watch");
  return t("inventory.status.good");
}

function coverageCopy(
  t: Translate,
  formatNumber: FormatNumber,
  item: InventoryItem,
  prediction: InventoryPrediction,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale") return t("inventory.prediction.coverage.stale");
  if (countTrust === "unverified") return t("inventory.prediction.coverage.unverified");
  const days = prediction.daysCoverage;
  if (days === null || prediction.averageDailyUsage <= 0) return t("inventory.prediction.coverage.learning");
  if (prediction.projectedQuantity > item.par_level * 1.35 || days >= 8) return t("inventory.prediction.coverage.high");
  if (days <= 0.75) return t("inventory.prediction.coverage.today");
  if (days <= 1.5) return t("inventory.prediction.coverage.tomorrow");
  if (days <= 3) {
    return t("inventory.prediction.coverage.days", { count: formatNumber(Math.max(2, Math.ceil(days))) });
  }
  if (days >= 5) return t("inventory.prediction.coverage.days", { count: formatNumber(Math.floor(days)) });
  return t("inventory.prediction.coverage.several");
}

function actionCopy(
  t: Translate,
  quantity: (value: number) => string,
  item: InventoryItem,
  prediction: InventoryPrediction,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale" || countTrust === "unverified") {
    return t("inventory.prediction.action.recount");
  }
  if (prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low") {
    return t("inventory.prediction.action.order", {
      quantity: quantity(prediction.suggestedOrderQuantity),
      unit: item.unit
    });
  }
  if (prediction.projectedStatus === "Watch") return t("inventory.prediction.action.update");
  if (prediction.daysCoverage !== null && prediction.daysCoverage >= 8) return t("inventory.prediction.action.delay");
  return t("inventory.prediction.action.none");
}

function basisCopy(
  t: Translate,
  formatNumber: FormatNumber,
  prediction: InventoryPrediction,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale") return t("inventory.prediction.basis.stale");
  if (countTrust === "unverified") return t("inventory.prediction.basis.unverified");
  if (prediction.historySource === "restaurant_history") {
    const key = prediction.todayDepletion > 0
      ? "inventory.prediction.basis.historyToday"
      : "inventory.prediction.basis.history";
    return t(key, { count: formatNumber(prediction.historySampleDays) });
  }
  if (prediction.historySource === "demo_fallback") return t("inventory.prediction.basis.demo");
  if (prediction.historySource === "current_day") return t("inventory.prediction.basis.today");
  return t("inventory.prediction.basis.learning");
}

function confidenceCopy(
  t: Translate,
  prediction: InventoryPrediction,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale") return t("inventory.prediction.confidence.stale");
  if (countTrust === "unverified") return t("inventory.prediction.confidence.unverified");
  if (prediction.historySource === "restaurant_history") return t("inventory.prediction.confidence.history");
  if (prediction.averageDailyUsage > 0) return t("inventory.prediction.confidence.service");
  return t("inventory.prediction.confidence.current");
}

function whyCopy(
  t: Translate,
  item: InventoryItem,
  prediction: InventoryPrediction,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale") return t("inventory.prediction.why.stale");
  if (countTrust === "unverified") return t("inventory.prediction.why.unverified");
  if (prediction.todayDepletion > 0 && prediction.projectedQuantity <= item.reorder_threshold) {
    return t("inventory.prediction.why.threshold");
  }
  if (prediction.daysCoverage === null) return t("inventory.prediction.why.learning");
  if (prediction.daysCoverage <= 1.5) return t("inventory.prediction.why.tomorrow");
  if (prediction.demandTrend === "rising") return t("inventory.prediction.why.rising", { item: item.item_name });
  if (prediction.daysCoverage >= 8) return t("inventory.prediction.why.high");
  return t("inventory.prediction.why.aligned");
}

function recommendationCopy(
  t: Translate,
  quantity: (value: number) => string,
  item: InventoryItem,
  prediction: InventoryPrediction,
  coverage: string,
  countTrust: InventoryCountTrustState
): string {
  if (countTrust === "stale") {
    return t("inventory.prediction.recommendation.stale", { coverage });
  }
  if (countTrust === "unverified") {
    return t("inventory.prediction.recommendation.unverified", { coverage });
  }
  if (prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low") {
    return t("inventory.prediction.recommendation.order", {
      quantity: quantity(prediction.suggestedOrderQuantity),
      unit: item.unit,
      item: item.item_name,
      coverage
    });
  }
  if (prediction.projectedStatus === "Watch") {
    return t("inventory.prediction.recommendation.update", { coverage });
  }
  if (prediction.daysCoverage !== null && prediction.daysCoverage >= 8) {
    return t("inventory.prediction.recommendation.delay", { coverage });
  }
  return t("inventory.prediction.recommendation.none", { coverage });
}
