import type { InventoryItem, PurchaseRecommendation } from "../../types/mise";
import { canonicalInventoryUnit } from "./inventoryUnits";
import {
  buildInventoryCountEvidence,
  type LedgerProjectionEvent
} from "./inventoryCountAuthority";

export type OrderAutomationDecision = "manual_review" | "automatic_draft" | "automatic_send";

export type OrderAutomationBlocker =
  | "automation_disabled"
  | "invalid_policy"
  | "no_candidates"
  | "tenant_mismatch"
  | "supplier_mismatch"
  | "duplicate_inventory_item"
  | "missing_inventory_item"
  | "supplier_catalog_mismatch"
  | "unit_mismatch"
  | "invalid_quantity"
  | "missing_unit_cost"
  | "stale_inventory_count"
  | "stale_recommendation"
  | "insufficient_history"
  | "quantity_variance"
  | "line_value_limit"
  | "order_value_limit";

export type OrderAutomationSendBlocker =
  | "automatic_send_disabled"
  | "email_not_connected"
  | "supplier_recipient_missing";

export interface OrderAutomationPolicy {
  enabled: boolean;
  allowAutomaticSend: boolean;
  maximumOrderValue: number;
  maximumLineValue: number;
  maximumInventoryAgeHours: number;
  maximumRecommendationAgeHours: number;
  minimumHistoricalApprovals: number;
  maximumQuantityVarianceRatio: number;
  historyLookbackDays: number;
}

export interface OrderAutomationDeliveryReadiness {
  emailConnected: boolean;
  supplierRecipientConfigured: boolean;
}

export interface OrderAutomationInput {
  restaurantId: string;
  supplierId: string;
  /** Presentation only. All supplier matching uses `supplierId`. */
  supplierName: string;
  candidates: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  recommendationHistory: readonly PurchaseRecommendation[];
  /**
   * Ledger rows from the inventory ledger. Automation stays blocked on
   * `stale_inventory_count` when an item has no verified count or when its
   * materialized quantity no longer follows the count boundary, because
   * `inventory_items.last_updated` also moves for policy and cost edits.
   */
  inventoryLedgerEvents?: readonly LedgerProjectionEvent[];
  /** False when the caller's bounded ledger read was truncated. */
  ledgerComplete?: boolean;
  policy?: OrderAutomationPolicy;
  delivery?: OrderAutomationDeliveryReadiness;
  now?: Date;
}

export interface OrderAutomationLineAssessment {
  recommendationId: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  estimatedValue: number | null;
  historicalApprovalCount: number;
  historicalMedianQuantity: number | null;
  quantityVarianceRatio: number | null;
  blockers: OrderAutomationBlocker[];
}

export interface OrderAutomationAssessment {
  restaurantId: string;
  supplierId: string;
  supplierName: string;
  decision: OrderAutomationDecision;
  estimatedOrderValue: number | null;
  lines: OrderAutomationLineAssessment[];
  blockers: OrderAutomationBlocker[];
  sendBlockers: OrderAutomationSendBlocker[];
}

export const DEFAULT_ORDER_AUTOMATION_POLICY: OrderAutomationPolicy = {
  enabled: false,
  allowAutomaticSend: false,
  maximumOrderValue: 500,
  maximumLineValue: 250,
  maximumInventoryAgeHours: 24,
  maximumRecommendationAgeHours: 24,
  minimumHistoricalApprovals: 3,
  maximumQuantityVarianceRatio: 0.25,
  historyLookbackDays: 180
};

/**
 * Pure, side-effect-free safety gate for future order automation.
 *
 * This function never approves, drafts, or sends an order. It only proves
 * whether a supplier batch has enough fresh, bounded, restaurant-specific
 * evidence to be considered for those later workflow stages.
 */
export function assessOrderAutomation(input: OrderAutomationInput): OrderAutomationAssessment {
  const restaurantId = input.restaurantId.trim();
  const supplierId = input.supplierId.trim();
  const supplierName = input.supplierName.trim();
  const policy = input.policy ?? DEFAULT_ORDER_AUTOMATION_POLICY;
  const now = input.now ?? new Date();
  const topLevelBlockers = new Set<OrderAutomationBlocker>();

  if (!isValidPolicy(policy) || !Number.isFinite(now.getTime())) {
    topLevelBlockers.add("invalid_policy");
  }
  if (!policy.enabled) topLevelBlockers.add("automation_disabled");
  if (input.candidates.length === 0) topLevelBlockers.add("no_candidates");
  if (!supplierId) topLevelBlockers.add("supplier_mismatch");

  const scopedInventory = input.inventoryItems.filter((item) => item.restaurant_id === restaurantId);
  const inventoryById = new Map(scopedInventory.map((item) => [item.id, item] as const));
  const countEvidence = buildInventoryCountEvidence({
    restaurantId,
    items: scopedInventory,
    ledgerEvents: input.inventoryLedgerEvents ?? [],
    ledgerComplete: input.ledgerComplete,
    generatedAt: Number.isFinite(now.getTime()) ? now.toISOString() : new Date().toISOString(),
    maximumCountAgeHours: policy.maximumInventoryAgeHours
  });
  const candidateItemIds = new Set<string>();
  const lines = input.candidates.map((candidate) => {
    const blockers = new Set<OrderAutomationBlocker>();
    if (candidate.restaurant_id !== restaurantId) blockers.add("tenant_mismatch");
    if (candidate.supplier_id !== supplierId) {
      blockers.add("supplier_mismatch");
    }
    if (candidateItemIds.has(candidate.inventory_item_id)) blockers.add("duplicate_inventory_item");
    candidateItemIds.add(candidate.inventory_item_id);

    const item = inventoryById.get(candidate.inventory_item_id);
    if (!item) blockers.add("missing_inventory_item");
    if (item && item.supplier_id !== supplierId) {
      blockers.add("supplier_catalog_mismatch");
    }

    const candidateUnit = canonicalInventoryUnit(candidate.unit);
    const inventoryUnit = canonicalInventoryUnit(item?.unit);
    if (!candidateUnit || !inventoryUnit || candidateUnit !== inventoryUnit) blockers.add("unit_mismatch");

    const quantity = candidate.recommended_quantity;
    if (!Number.isFinite(quantity) || quantity <= 0) blockers.add("invalid_quantity");

    const unitCost =
      item && Number.isFinite(item.estimated_unit_cost) && item.estimated_unit_cost > 0
        ? item.estimated_unit_cost
        : null;
    if (unitCost === null) blockers.add("missing_unit_cost");

    if (item && countEvidence.get(item.id)?.freshness !== "fresh") {
      blockers.add("stale_inventory_count");
    }
    if (!isFreshTimestamp(candidate.created_at, now, policy.maximumRecommendationAgeHours)) {
      blockers.add("stale_recommendation");
    }

    const history = matchingHistory(
      restaurantId,
      supplierId,
      candidate,
      input.recommendationHistory,
      now,
      policy.historyLookbackDays
    );
    const historicalQuantities = history.map((entry) => entry.recommended_quantity);
    const historicalMedianQuantity = median(historicalQuantities);
    const quantityVarianceRatio =
      historicalMedianQuantity !== null && Number.isFinite(quantity) && quantity > 0
        ? Math.abs(quantity - historicalMedianQuantity) / historicalMedianQuantity
        : null;
    if (history.length < policy.minimumHistoricalApprovals) blockers.add("insufficient_history");
    if (
      quantityVarianceRatio !== null &&
      quantityVarianceRatio > policy.maximumQuantityVarianceRatio
    ) {
      blockers.add("quantity_variance");
    }

    const estimatedValue =
      unitCost !== null && Number.isFinite(quantity) && quantity > 0
        ? roundCurrency(quantity * unitCost)
        : null;
    if (estimatedValue !== null && estimatedValue > policy.maximumLineValue) {
      blockers.add("line_value_limit");
    }

    blockers.forEach((blocker) => topLevelBlockers.add(blocker));
    return {
      recommendationId: candidate.id,
      inventoryItemId: candidate.inventory_item_id,
      itemName: candidate.item_name,
      quantity,
      unit: candidate.unit,
      unitCost,
      estimatedValue,
      historicalApprovalCount: history.length,
      historicalMedianQuantity,
      quantityVarianceRatio,
      blockers: [...blockers]
    };
  });

  const estimatedValues = lines.map((line) => line.estimatedValue);
  const estimatedOrderValue = estimatedValues.every((value): value is number => value !== null)
    ? roundCurrency(estimatedValues.reduce((sum, value) => sum + value, 0))
    : null;
  if (estimatedOrderValue !== null && estimatedOrderValue > policy.maximumOrderValue) {
    topLevelBlockers.add("order_value_limit");
  }

  const sendBlockers = buildSendBlockers(policy, input.delivery);
  const blockers = [...topLevelBlockers];
  const decision: OrderAutomationDecision =
    blockers.length > 0
      ? "manual_review"
      : sendBlockers.length === 0
        ? "automatic_send"
        : "automatic_draft";

  return {
    restaurantId,
    supplierId,
    supplierName,
    decision,
    estimatedOrderValue,
    lines,
    blockers,
    sendBlockers
  };
}

function matchingHistory(
  restaurantId: string,
  supplierId: string,
  candidate: PurchaseRecommendation,
  history: readonly PurchaseRecommendation[],
  now: Date,
  historyLookbackDays: number
) {
  const candidateUnit = canonicalInventoryUnit(candidate.unit);
  const oldestAcceptedTime = now.getTime() - historyLookbackDays * 24 * 60 * 60 * 1000;
  return history.filter((entry) => {
    const createdAt = new Date(entry.created_at).getTime();
    return (
      entry.restaurant_id === restaurantId &&
      entry.inventory_item_id === candidate.inventory_item_id &&
      entry.supplier_id === supplierId &&
      canonicalInventoryUnit(entry.unit) === candidateUnit &&
      (entry.status === "approved" || entry.status === "ordered") &&
      Number.isFinite(entry.recommended_quantity) &&
      entry.recommended_quantity > 0 &&
      Number.isFinite(createdAt) &&
      createdAt >= oldestAcceptedTime &&
      createdAt <= now.getTime()
    );
  });
}

function buildSendBlockers(
  policy: OrderAutomationPolicy,
  delivery: OrderAutomationDeliveryReadiness | undefined
) {
  const blockers: OrderAutomationSendBlocker[] = [];
  if (!policy.allowAutomaticSend) blockers.push("automatic_send_disabled");
  if (!delivery?.emailConnected) blockers.push("email_not_connected");
  if (!delivery?.supplierRecipientConfigured) blockers.push("supplier_recipient_missing");
  return blockers;
}

function isValidPolicy(policy: OrderAutomationPolicy) {
  return (
    Number.isFinite(policy.maximumOrderValue) &&
    policy.maximumOrderValue > 0 &&
    Number.isFinite(policy.maximumLineValue) &&
    policy.maximumLineValue > 0 &&
    policy.maximumLineValue <= policy.maximumOrderValue &&
    Number.isFinite(policy.maximumInventoryAgeHours) &&
    policy.maximumInventoryAgeHours > 0 &&
    Number.isFinite(policy.maximumRecommendationAgeHours) &&
    policy.maximumRecommendationAgeHours > 0 &&
    Number.isInteger(policy.minimumHistoricalApprovals) &&
    policy.minimumHistoricalApprovals >= 1 &&
    Number.isFinite(policy.maximumQuantityVarianceRatio) &&
    policy.maximumQuantityVarianceRatio >= 0 &&
    policy.maximumQuantityVarianceRatio <= 1 &&
    Number.isFinite(policy.historyLookbackDays) &&
    policy.historyLookbackDays > 0
  );
}

function isFreshTimestamp(value: string, now: Date, maximumAgeHours: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageMilliseconds = now.getTime() - timestamp;
  const futureToleranceMilliseconds = 5 * 60 * 1000;
  return (
    ageMilliseconds >= -futureToleranceMilliseconds &&
    ageMilliseconds <= maximumAgeHours * 60 * 60 * 1000
  );
}

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return null;
  if (sorted.length % 2 === 1) return middleValue;
  const previousValue = sorted[middle - 1];
  return previousValue === undefined ? middleValue : (previousValue + middleValue) / 2;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
