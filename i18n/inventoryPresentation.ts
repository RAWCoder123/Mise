import type { InventoryItem, InventoryPrediction, InventoryStatus } from "../types/mise";
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
  /** True when on-hand chronology is contaminated and must not drive orders. */
  contaminatedProjection: boolean;
}

export function isContaminatedProjection(prediction: InventoryPrediction): boolean {
  return prediction.countEvidence === "contaminated_projection";
}

export function localizeInventoryPrediction(
  t: Translate,
  formatNumber: FormatNumber,
  item: InventoryItem,
  prediction: InventoryPrediction
): LocalizedInventoryPrediction {
  const quantity = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const contaminated = isContaminatedProjection(prediction);
  const coverage = coverageCopy(t, formatNumber, item, prediction);
  const action = actionCopy(t, quantity, item, prediction);

  return {
    status: inventoryStatusLabel(t, prediction.projectedStatus),
    coverage,
    trend: t(`inventory.prediction.trend.${prediction.demandTrend}`),
    action,
    basis: contaminated ? t("inventory.prediction.basis.contaminated") : basisCopy(t, formatNumber, prediction),
    depletion:
      prediction.todayDepletion > 0
        ? t("inventory.prediction.depletion.recorded", {
            used: quantity(prediction.todayDepletion),
            projected: quantity(prediction.projectedQuantity),
            unit: item.unit
          })
        : t("inventory.prediction.depletion.none"),
    confidence: contaminated
      ? t("inventory.prediction.confidence.contaminated")
      : prediction.historySource === "restaurant_history"
        ? t("inventory.prediction.confidence.history")
        : prediction.averageDailyUsage > 0
          ? t("inventory.prediction.confidence.service")
          : t("inventory.prediction.confidence.current"),
    whyItMatters: whyCopy(t, item, prediction),
    recommendation: recommendationCopy(t, quantity, item, prediction, coverage),
    contaminatedProjection: contaminated
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
  prediction: InventoryPrediction
): string {
  if (isContaminatedProjection(prediction)) return t("inventory.prediction.coverage.contaminated");
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
  prediction: InventoryPrediction
): string {
  if (isContaminatedProjection(prediction)) return t("inventory.prediction.action.recount");
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

function basisCopy(t: Translate, formatNumber: FormatNumber, prediction: InventoryPrediction): string {
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

function whyCopy(t: Translate, item: InventoryItem, prediction: InventoryPrediction): string {
  if (isContaminatedProjection(prediction)) return t("inventory.prediction.why.contaminated");
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
  coverage: string
): string {
  if (isContaminatedProjection(prediction)) {
    return t("inventory.prediction.recommendation.contaminated", { coverage });
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
