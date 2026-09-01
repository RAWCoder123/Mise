import type { MessageKey } from "../../i18n/catalog";
import type {
  OrderAutomationAssessment,
  OrderAutomationBlocker,
  OrderAutomationDecision,
  OrderAutomationReadinessSummary,
  OrderAutomationSendBlocker
} from "../domain/orderAutomation";

export type OrderAutomationDecisionTone = "caution" | "success" | "neutral";

const DECISION_LABEL_KEYS: Record<OrderAutomationDecision, MessageKey> = {
  manual_review: "autonomy.readiness.decision.manualReview",
  automatic_draft: "autonomy.readiness.decision.automaticDraft",
  automatic_send: "autonomy.readiness.decision.automaticSend"
};

const DECISION_TONES: Record<OrderAutomationDecision, OrderAutomationDecisionTone> = {
  manual_review: "caution",
  automatic_draft: "success",
  automatic_send: "success"
};

const BLOCKER_LABEL_KEYS: Record<OrderAutomationBlocker, MessageKey> = {
  automation_disabled: "autonomy.readiness.blocker.automationDisabled",
  invalid_policy: "autonomy.readiness.blocker.invalidPolicy",
  no_candidates: "autonomy.readiness.blocker.noCandidates",
  tenant_mismatch: "autonomy.readiness.blocker.tenantMismatch",
  supplier_mismatch: "autonomy.readiness.blocker.supplierMismatch",
  duplicate_inventory_item: "autonomy.readiness.blocker.duplicateInventoryItem",
  missing_inventory_item: "autonomy.readiness.blocker.missingInventoryItem",
  supplier_catalog_mismatch: "autonomy.readiness.blocker.supplierCatalogMismatch",
  unit_mismatch: "autonomy.readiness.blocker.unitMismatch",
  invalid_quantity: "autonomy.readiness.blocker.invalidQuantity",
  missing_unit_cost: "autonomy.readiness.blocker.missingUnitCost",
  stale_inventory_count: "autonomy.readiness.blocker.staleInventoryCount",
  stale_recommendation: "autonomy.readiness.blocker.staleRecommendation",
  insufficient_history: "autonomy.readiness.blocker.insufficientHistory",
  quantity_variance: "autonomy.readiness.blocker.quantityVariance",
  line_value_limit: "autonomy.readiness.blocker.lineValueLimit",
  order_value_limit: "autonomy.readiness.blocker.orderValueLimit"
};

const SEND_BLOCKER_LABEL_KEYS: Record<OrderAutomationSendBlocker, MessageKey> = {
  automatic_send_disabled: "autonomy.readiness.sendBlocker.automaticSendDisabled",
  email_not_connected: "autonomy.readiness.sendBlocker.emailNotConnected",
  supplier_recipient_missing: "autonomy.readiness.sendBlocker.supplierRecipientMissing"
};

export function orderAutomationDecisionLabelKey(decision: OrderAutomationDecision): MessageKey {
  return DECISION_LABEL_KEYS[decision];
}

export function orderAutomationDecisionTone(decision: OrderAutomationDecision): OrderAutomationDecisionTone {
  return DECISION_TONES[decision];
}

export function orderAutomationBlockerLabelKey(blocker: OrderAutomationBlocker): MessageKey {
  return BLOCKER_LABEL_KEYS[blocker];
}

export function orderAutomationSendBlockerLabelKey(blocker: OrderAutomationSendBlocker): MessageKey {
  return SEND_BLOCKER_LABEL_KEYS[blocker];
}

/**
 * Unique blocker labels for a supplier assessment, draft blockers first, then send gates.
 * Caps the list so Autonomy stays scan-first.
 */
export function presentOrderAutomationBlockerKeys(
  assessment: OrderAutomationAssessment,
  limit = 4
): MessageKey[] {
  const keys: MessageKey[] = [];
  const seen = new Set<MessageKey>();
  for (const blocker of assessment.blockers) {
    const key = orderAutomationBlockerLabelKey(blocker);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
    if (keys.length >= limit) return keys;
  }
  if (assessment.decision !== "manual_review") {
    for (const blocker of assessment.sendBlockers) {
      const key = orderAutomationSendBlockerLabelKey(blocker);
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
      if (keys.length >= limit) return keys;
    }
  }
  return keys;
}

export function presentOrderAutomationSummaryKey(
  summary: OrderAutomationReadinessSummary
): MessageKey {
  if (summary.supplierCount === 0) return "autonomy.readiness.summary.empty";
  if (summary.manualReviewCount > 0) return "autonomy.readiness.summary.needsReview";
  if (summary.automaticDraftCount > 0) return "autonomy.readiness.summary.draftReady";
  return "autonomy.readiness.summary.sendReady";
}
