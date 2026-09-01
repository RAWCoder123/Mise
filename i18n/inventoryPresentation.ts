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
  /** Same-operating-day verified count already absorbed mapped POS demand. */
  absorbedSameDayPos: boolean;
  /** Quantity to show in POS rails: post-count depletion, else absorbed demand. */
  posEvidenceQuantity: number;
}

export function inventoryHasAbsorbedSameDayPos(
  prediction: Pick<InventoryPrediction, "unattributedTodayDepletion">
): boolean {
  return prediction.unattributedTodayDepletion > 0;
}

export function inventoryPosEvidenceQuantity(
  prediction: Pick<InventoryPrediction, "todayDepletion" | "unattributedTodayDepletion">
): number {
  if (prediction.todayDepletion > 0) return prediction.todayDepletion;
  if (prediction.unattributedTodayDepletion > 0) return prediction.unattributedTodayDepletion;
  return 0;
}

export function localizeInventoryPrediction(
  t: Translate,
  formatNumber: FormatNumber,
  item: InventoryItem,
  prediction: InventoryPrediction
): LocalizedInventoryPrediction {
  const quantity = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });
  const coverage = coverageCopy(t, formatNumber, item, prediction);
  const action = actionCopy(t, quantity, item, prediction);
  const absorbedSameDayPos = inventoryHasAbsorbedSameDayPos(prediction);
  const posEvidenceQuantity = inventoryPosEvidenceQuantity(prediction);

  return {
    status: inventoryStatusLabel(t, prediction.projectedStatus),
    coverage,
    trend: t(`inventory.prediction.trend.${prediction.demandTrend}`),
    action,
    basis: basisCopy(t, formatNumber, prediction),
    depletion: depletionCopy(t, quantity, item, prediction),
    confidence:
      prediction.historySource === "restaurant_history"
        ? t("inventory.prediction.confidence.history")
        : prediction.averageDailyUsage > 0
          ? t("inventory.prediction.confidence.service")
          : t("inventory.prediction.confidence.current"),
    whyItMatters: whyCopy(t, item, prediction),
    recommendation: recommendationCopy(t, quantity, item, prediction, coverage),
    absorbedSameDayPos,
    posEvidenceQuantity
  };
}

function depletionCopy(
  t: Translate,
  quantity: (value: number) => string,
  item: InventoryItem,
  prediction: InventoryPrediction
): string {
  if (prediction.todayDepletion > 0) {
    return t("inventory.prediction.depletion.recorded", {
      used: quantity(prediction.todayDepletion),
      projected: quantity(prediction.projectedQuantity),
      unit: item.unit
    });
  }
  if (prediction.unattributedTodayDepletion > 0) {
    return t("inventory.prediction.depletion.absorbed", {
      used: quantity(prediction.unattributedTodayDepletion),
      projected: quantity(prediction.projectedQuantity),
      unit: item.unit
    });
  }
  return t("inventory.prediction.depletion.none");
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
  const hasTodayMappedPos =
    prediction.todayDepletion > 0 || prediction.unattributedTodayDepletion > 0;
  if (prediction.historySource === "restaurant_history") {
    const key = hasTodayMappedPos
      ? "inventory.prediction.basis.historyToday"
      : "inventory.prediction.basis.history";
    return t(key, { count: formatNumber(prediction.historySampleDays) });
  }
  if (prediction.historySource === "demo_fallback") return t("inventory.prediction.basis.demo");
  if (prediction.historySource === "current_day" || hasTodayMappedPos) {
    return t("inventory.prediction.basis.today");
  }
  return t("inventory.prediction.basis.learning");
}

function whyCopy(t: Translate, item: InventoryItem, prediction: InventoryPrediction): string {
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
