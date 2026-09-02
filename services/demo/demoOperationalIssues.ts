import {
  inventoryRiskDedupeKey,
  operationalIssueFromPurchaseRecommendation,
  type OperationalIssue
} from "../domain/operationalIssues";
import type { PurchaseRecommendation } from "../../types/mise";
import type { DemoState } from "./replaceableDemoData";

function ensureIssueArray(state: DemoState): OperationalIssue[] {
  if (!Array.isArray(state.operationalIssues)) state.operationalIssues = [];
  return state.operationalIssues;
}

export function upsertDemoOperationalIssueFromRecommendation(
  state: DemoState,
  recommendation: PurchaseRecommendation
): OperationalIssue {
  const issues = ensureIssueArray(state);
  const dedupeKey = inventoryRiskDedupeKey(recommendation.inventory_item_id);
  const existingIndex = issues.findIndex(
    (issue) => issue.restaurantId === recommendation.restaurant_id && issue.dedupeKey === dedupeKey
  );
  const existing = existingIndex >= 0 ? issues[existingIndex]! : null;
  const next = operationalIssueFromPurchaseRecommendation(recommendation, existing);
  if (existingIndex >= 0) {
    issues[existingIndex] = next;
  } else {
    issues.push(next);
  }
  return next;
}

/**
 * Mirrors hosted operational_issues upserts from purchase_recommendations.
 * Idempotent by restaurant + inventory-risk dedupe key.
 */
export function syncDemoOperationalIssuesFromRecommendations(state: DemoState) {
  ensureIssueArray(state);
  // Prefer the newest recommendation per inventory item so status follows current authority.
  const newestByItem = new Map<string, PurchaseRecommendation>();
  for (const recommendation of state.purchaseRecommendations ?? []) {
    const key = `${recommendation.restaurant_id}:${recommendation.inventory_item_id}`;
    const existing = newestByItem.get(key);
    if (!existing || recommendation.created_at > existing.created_at) {
      newestByItem.set(key, recommendation);
    }
  }
  for (const recommendation of newestByItem.values()) {
    upsertDemoOperationalIssueFromRecommendation(state, recommendation);
  }
}
