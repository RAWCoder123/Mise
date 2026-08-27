import type { InventoryItem, PurchaseRecommendation } from "../../types/mise";

export const PURCHASE_DECISION_EVIDENCE_VERSION = "mise.purchase_decision.v1" as const;
export const PURCHASE_DECISION_PATTERN_VERSION = "mise.purchase_pattern.v1" as const;
export const PURCHASE_DECISION_MINIMUM_SAMPLE_COUNT = 5;
export const PURCHASE_DECISION_CONSISTENCY_THRESHOLD = 0.8;

export type PurchaseDecisionType =
  | "approve"
  | "approve_with_override"
  | "dismiss"
  | "undo"
  | "exclude_from_learning";
export type PurchaseDecisionStrength = "insufficient" | "emerging" | "established";
export type PurchaseDecisionOutcome = "exact" | "upward" | "downward" | "dismiss" | "mixed";

export interface PurchaseDecisionEvent {
  id: string;
  sequence: number;
  restaurantId: string;
  actorUserId: string | null;
  actorRole: "owner" | "admin" | "manager";
  decisionType: PurchaseDecisionType;
  purchaseRecommendationId: string;
  inventoryItemId: string;
  supplierId: string;
  recommendationSource: "mise_rules" | "legacy_client";
  recommendationUnit: string;
  recommendedQuantity: number;
  chosenQuantity: number | null;
  canonicalUnit: "g" | "ml" | "each";
  canonicalQuantityPerUnit: number;
  recommendedCanonicalQuantity: number;
  chosenCanonicalQuantity: number | null;
  quantityDelta: number | null;
  canonicalQuantityDelta: number | null;
  quantityRatio: number | null;
  planningRevision: number | null;
  contextEvidence: Record<string, unknown>;
  targetEventId: string | null;
  sourceAuditLogId: string | null;
  sourceEventKey: string;
  evidenceVersion: typeof PURCHASE_DECISION_EVIDENCE_VERSION;
  occurredAt: string;
  createdAt: string;
}

export interface PurchaseDecisionPattern {
  patternVersion: typeof PURCHASE_DECISION_PATTERN_VERSION;
  inventoryItemId: string;
  supplierId: string;
  canonicalUnit: "g" | "ml" | "each";
  recommendationSource: "mise_rules" | "legacy_client";
  sampleCount: number;
  approvalCount: number;
  exactApprovalCount: number;
  overrideCount: number;
  upwardOverrideCount: number;
  downwardOverrideCount: number;
  dismissalCount: number;
  approvalRate: number;
  dismissalRate: number;
  medianQuantityRatio: number | null;
  medianQuantityDelta: number | null;
  recentSampleCount: number;
  firstDecisionAt: string;
  lastDecisionAt: string;
  evidenceEventIds: string[];
  eligible: boolean;
  evidenceStrength: PurchaseDecisionStrength;
  dominantOutcome: PurchaseDecisionOutcome;
  currentContext: boolean;
}

/** Advisory memory must never make an authoritative Orders dataset unavailable. */
export async function resolveAdvisoryPurchaseDecisionPatterns(
  load: () => Promise<PurchaseDecisionPattern[]>
): Promise<PurchaseDecisionPattern[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

/** MISE-004B keeps advisory ratio influence inside the same absolute bounds as history medians. */
export const PURCHASE_DECISION_ADVISORY_RATIO_MIN = 0.5;
export const PURCHASE_DECISION_ADVISORY_RATIO_MAX = 1.75;

export interface PurchaseDecisionAdvisoryQuantityResult {
  quantity: number;
  applied: boolean;
  medianQuantityRatio: number | null;
  sampleCount: number | null;
  dominantOutcome: PurchaseDecisionOutcome | null;
}

/**
 * Selects an established, current-context pattern that may advise quantity.
 * Dismissal-dominant and emerging/insufficient patterns never qualify.
 */
export function selectAdvisoryPurchaseDecisionPattern(
  patterns: readonly PurchaseDecisionPattern[] | undefined,
  input: {
    inventoryItemId: string;
    supplierId: string | null | undefined;
    canonicalUnit: string | null | undefined;
    recommendationSource?: "mise_rules" | "legacy_client";
  }
): PurchaseDecisionPattern | null {
  if (!patterns?.length || !input.supplierId || !input.canonicalUnit) return null;
  const recommendationSource = input.recommendationSource ?? "mise_rules";
  const match = patterns.find(
    (pattern) =>
      pattern.inventoryItemId === input.inventoryItemId &&
      pattern.supplierId === input.supplierId &&
      pattern.canonicalUnit === input.canonicalUnit &&
      pattern.recommendationSource === recommendationSource &&
      pattern.eligible &&
      pattern.evidenceStrength === "established" &&
      pattern.currentContext &&
      pattern.medianQuantityRatio !== null &&
      Number.isFinite(pattern.medianQuantityRatio) &&
      (pattern.dominantOutcome === "exact" ||
        pattern.dominantOutcome === "upward" ||
        pattern.dominantOutcome === "downward")
  );
  return match ?? null;
}

/**
 * Applies an established chosen-to-suggested median ratio to a calculated quantity.
 * Never invents a base quantity, never suppresses recommendations, and never
 * escapes the existing absolute learning bounds.
 */
export function applyEstablishedPatternAdvisoryQuantity(input: {
  calculatedQuantity: number;
  parLevel: number;
  pattern: PurchaseDecisionPattern | null | undefined;
}): PurchaseDecisionAdvisoryQuantityResult {
  const calculated = Math.max(1, Math.ceil(Number(input.calculatedQuantity) || 0));
  const empty: PurchaseDecisionAdvisoryQuantityResult = {
    quantity: calculated,
    applied: false,
    medianQuantityRatio: null,
    sampleCount: null,
    dominantOutcome: null
  };
  const pattern = input.pattern;
  const ratio = pattern?.medianQuantityRatio ?? null;
  if (
    !pattern ||
    !pattern.eligible ||
    pattern.evidenceStrength !== "established" ||
    !pattern.currentContext ||
    (pattern.dominantOutcome !== "exact" &&
      pattern.dominantOutcome !== "upward" &&
      pattern.dominantOutcome !== "downward") ||
    ratio === null ||
    !Number.isFinite(ratio) ||
    ratio < PURCHASE_DECISION_ADVISORY_RATIO_MIN ||
    ratio > PURCHASE_DECISION_ADVISORY_RATIO_MAX
  ) {
    return empty;
  }
  const adjusted = Math.max(1, Math.ceil(calculated * ratio));
  const minimum = Math.max(1, calculated * PURCHASE_DECISION_ADVISORY_RATIO_MIN);
  const maximum = Math.max(
    calculated * PURCHASE_DECISION_ADVISORY_RATIO_MAX,
    (Number.isFinite(input.parLevel) ? input.parLevel : 0) * 1.25,
    1
  );
  if (adjusted < minimum || adjusted > maximum) {
    return empty;
  }
  return {
    quantity: adjusted,
    applied: true,
    medianQuantityRatio: ratio,
    sampleCount: pattern.sampleCount,
    dominantOutcome: pattern.dominantOutcome
  };
}

export function describePurchaseDecisionAdvisoryQuantity(
  unit: string,
  advisory: PurchaseDecisionAdvisoryQuantityResult
) {
  if (!advisory.applied || advisory.medianQuantityRatio === null || advisory.sampleCount === null) {
    return null;
  }
  const ratioLabel = Number.isInteger(advisory.medianQuantityRatio)
    ? String(advisory.medianQuantityRatio)
    : advisory.medianQuantityRatio.toFixed(2).replace(/\.?0+$/, "");
  return `Mise adjusted using an established purchase-decision pattern (median ratio ${ratioLabel} from ${advisory.sampleCount} decisions) to ${advisory.quantity} ${unit}.`;
}

function requireFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
    throw new Error(`${label} must be a bounded positive quantity.`);
  }
  return value;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function decisionOutcome(event: PurchaseDecisionEvent): Exclude<PurchaseDecisionOutcome, "mixed"> {
  if (event.decisionType === "dismiss") return "dismiss";
  if (event.decisionType === "approve") return "exact";
  return (event.quantityRatio ?? 1) > 1 ? "upward" : "downward";
}

export function purchaseDecisionPatternKey(input: {
  inventoryItemId: string;
  supplierId: string;
  canonicalUnit: string;
  recommendationSource: string;
}) {
  return [
    input.inventoryItemId,
    input.supplierId,
    input.canonicalUnit,
    input.recommendationSource
  ].join(":");
}

export function createPurchaseDecisionBaseEvent(input: {
  id: string;
  sequence: number;
  recommendation: PurchaseRecommendation;
  inventoryItem: InventoryItem;
  decision: "approve" | "dismiss";
  suggestedQuantity: number;
  chosenQuantity: number | null;
  actorUserId: string | null;
  actorRole: "owner" | "admin" | "manager";
  sourceAuditLogId: string;
  contextEvidence?: Record<string, unknown>;
  occurredAt: string;
}): PurchaseDecisionEvent {
  const { recommendation, inventoryItem } = input;
  if (recommendation.generation_source !== "mise_rules" && recommendation.generation_source !== "legacy_client") {
    throw new Error("Only Mise-generated recommendations produce purchase memory evidence.");
  }
  if (
    inventoryItem.restaurant_id !== recommendation.restaurant_id ||
    inventoryItem.id !== recommendation.inventory_item_id ||
    inventoryItem.supplier_id !== recommendation.supplier_id ||
    inventoryItem.canonical_unit_verification_status !== "verified" ||
    !inventoryItem.canonical_unit ||
    !inventoryItem.canonical_quantity_per_unit
  ) {
    throw new Error("Verified canonical purchase evidence is required.");
  }
  const suggested = requireFinitePositive(input.suggestedQuantity, "Suggested quantity");
  const factor = requireFinitePositive(
    inventoryItem.canonical_quantity_per_unit,
    "Canonical quantity per unit"
  );
  const chosen = input.decision === "dismiss"
    ? null
    : requireFinitePositive(input.chosenQuantity ?? suggested, "Chosen quantity");
  const decisionType: PurchaseDecisionType = input.decision === "dismiss"
    ? "dismiss"
    : chosen === suggested
      ? "approve"
      : "approve_with_override";
  const recommendedCanonicalQuantity = suggested * factor;
  const chosenCanonicalQuantity = chosen === null ? null : chosen * factor;
  return {
    id: input.id,
    sequence: input.sequence,
    restaurantId: recommendation.restaurant_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    decisionType,
    purchaseRecommendationId: recommendation.id,
    inventoryItemId: recommendation.inventory_item_id,
    supplierId: recommendation.supplier_id,
    recommendationSource: recommendation.generation_source,
    recommendationUnit: recommendation.unit,
    recommendedQuantity: suggested,
    chosenQuantity: chosen,
    canonicalUnit: inventoryItem.canonical_unit,
    canonicalQuantityPerUnit: factor,
    recommendedCanonicalQuantity,
    chosenCanonicalQuantity,
    quantityDelta: chosen === null ? null : chosen - suggested,
    canonicalQuantityDelta: chosenCanonicalQuantity === null
      ? null
      : chosenCanonicalQuantity - recommendedCanonicalQuantity,
    quantityRatio: chosen === null ? null : chosen / suggested,
    planningRevision: recommendation.planning_revision ?? null,
    contextEvidence: { ...(input.contextEvidence ?? {}) },
    targetEventId: null,
    sourceAuditLogId: input.sourceAuditLogId,
    sourceEventKey: `audit_log:${input.sourceAuditLogId}`,
    evidenceVersion: PURCHASE_DECISION_EVIDENCE_VERSION,
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt
  };
}

export function createPurchaseDecisionCompensation(input: {
  id: string;
  sequence: number;
  target: PurchaseDecisionEvent;
  decisionType: "undo" | "exclude_from_learning";
  actorUserId: string | null;
  actorRole: "owner" | "admin" | "manager";
  sourceAuditLogId: string;
  sourceEventKey: string;
  occurredAt: string;
}): PurchaseDecisionEvent {
  if (!(["approve", "approve_with_override", "dismiss"] as PurchaseDecisionType[]).includes(input.target.decisionType)) {
    throw new Error("Only a base purchase decision can be compensated.");
  }
  return {
    ...input.target,
    id: input.id,
    sequence: input.sequence,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    decisionType: input.decisionType,
    targetEventId: input.target.id,
    sourceAuditLogId: input.sourceAuditLogId,
    sourceEventKey: input.sourceEventKey,
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt
  };
}

export function buildPurchaseDecisionPatterns(
  events: PurchaseDecisionEvent[],
  inventoryItems: InventoryItem[],
  now = new Date()
): PurchaseDecisionPattern[] {
  const compensated = new Set(
    events
      .filter((event) => event.decisionType === "undo" || event.decisionType === "exclude_from_learning")
      .map((event) => event.targetEventId)
      .filter((id): id is string => Boolean(id))
  );
  const active = events.filter(
    (event) =>
      (event.decisionType === "approve" ||
        event.decisionType === "approve_with_override" ||
        event.decisionType === "dismiss") &&
      !compensated.has(event.id)
  );
  const grouped = new Map<string, PurchaseDecisionEvent[]>();
  active.forEach((event) => {
    const key = purchaseDecisionPatternKey(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  });
  const recentBoundary = now.getTime() - 90 * 24 * 60 * 60 * 1_000;
  return [...grouped.values()]
    .map((group): PurchaseDecisionPattern => {
      const chronological = [...group].sort(
        (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.sequence - right.sequence
      );
      const first = chronological[0]!;
      const outcomes = chronological.map(decisionOutcome);
      const count = (outcome: Exclude<PurchaseDecisionOutcome, "mixed">) =>
        outcomes.filter((candidate) => candidate === outcome).length;
      const exactApprovalCount = count("exact");
      const upwardOverrideCount = count("upward");
      const downwardOverrideCount = count("downward");
      const dismissalCount = count("dismiss");
      const sampleCount = chronological.length;
      const approvalCount = sampleCount - dismissalCount;
      const dominantCount = Math.max(
        exactApprovalCount,
        upwardOverrideCount,
        downwardOverrideCount,
        dismissalCount
      );
      const consistent = dominantCount / sampleCount >= PURCHASE_DECISION_CONSISTENCY_THRESHOLD;
      const eligible = sampleCount >= PURCHASE_DECISION_MINIMUM_SAMPLE_COUNT;
      const dominantOutcome: PurchaseDecisionOutcome = !consistent
        ? "mixed"
        : dominantCount === exactApprovalCount
          ? "exact"
          : dominantCount === upwardOverrideCount
            ? "upward"
            : dominantCount === downwardOverrideCount
              ? "downward"
              : "dismiss";
      const item = inventoryItems.find(
        (candidate) =>
          candidate.restaurant_id === first.restaurantId &&
          candidate.id === first.inventoryItemId &&
          candidate.supplier_id === first.supplierId &&
          candidate.canonical_unit === first.canonicalUnit &&
          candidate.canonical_unit_verification_status === "verified"
      );
      return {
        patternVersion: PURCHASE_DECISION_PATTERN_VERSION,
        inventoryItemId: first.inventoryItemId,
        supplierId: first.supplierId,
        canonicalUnit: first.canonicalUnit,
        recommendationSource: first.recommendationSource,
        sampleCount,
        approvalCount,
        exactApprovalCount,
        overrideCount: upwardOverrideCount + downwardOverrideCount,
        upwardOverrideCount,
        downwardOverrideCount,
        dismissalCount,
        approvalRate: approvalCount / sampleCount,
        dismissalRate: dismissalCount / sampleCount,
        medianQuantityRatio: median(
          chronological.map((event) => event.quantityRatio).filter((value): value is number => value !== null)
        ),
        medianQuantityDelta: median(
          chronological
            .map((event) => event.canonicalQuantityDelta)
            .filter((value): value is number => value !== null)
        ),
        recentSampleCount: chronological.filter((event) => Date.parse(event.occurredAt) >= recentBoundary).length,
        firstDecisionAt: chronological[0]!.occurredAt,
        lastDecisionAt: chronological[chronological.length - 1]!.occurredAt,
        evidenceEventIds: [...chronological]
          .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.sequence - left.sequence)
          .slice(0, 20)
          .map((event) => event.id),
        eligible,
        evidenceStrength: !eligible ? "insufficient" : consistent ? "established" : "emerging",
        dominantOutcome,
        currentContext: Boolean(item)
      };
    })
    .sort(
      (left, right) =>
        Date.parse(right.lastDecisionAt) - Date.parse(left.lastDecisionAt) ||
        purchaseDecisionPatternKey(left).localeCompare(purchaseDecisionPatternKey(right))
    );
}

export function normalizePurchaseDecisionPattern(row: Record<string, unknown>): PurchaseDecisionPattern {
  const numeric = (name: string) => Number(row[name]);
  return {
    patternVersion: PURCHASE_DECISION_PATTERN_VERSION,
    inventoryItemId: String(row.inventory_item_id),
    supplierId: String(row.supplier_id),
    canonicalUnit: row.canonical_unit as PurchaseDecisionPattern["canonicalUnit"],
    recommendationSource: row.recommendation_source as PurchaseDecisionPattern["recommendationSource"],
    sampleCount: numeric("sample_count"),
    approvalCount: numeric("approval_count"),
    exactApprovalCount: numeric("exact_approval_count"),
    overrideCount: numeric("override_count"),
    upwardOverrideCount: numeric("upward_override_count"),
    downwardOverrideCount: numeric("downward_override_count"),
    dismissalCount: numeric("dismissal_count"),
    approvalRate: numeric("approval_rate"),
    dismissalRate: numeric("dismissal_rate"),
    medianQuantityRatio: row.median_quantity_ratio === null ? null : numeric("median_quantity_ratio"),
    medianQuantityDelta: row.median_quantity_delta === null ? null : numeric("median_quantity_delta"),
    recentSampleCount: numeric("recent_sample_count"),
    firstDecisionAt: String(row.first_decision_at),
    lastDecisionAt: String(row.last_decision_at),
    evidenceEventIds: Array.isArray(row.evidence_event_ids)
      ? row.evidence_event_ids.map(String)
      : [],
    eligible: row.eligible === true,
    evidenceStrength: row.evidence_strength as PurchaseDecisionStrength,
    dominantOutcome: row.dominant_outcome as PurchaseDecisionOutcome,
    currentContext: row.current_context === true
  };
}

export function normalizePurchaseDecisionEvent(row: Record<string, unknown>): PurchaseDecisionEvent {
  const nullableNumber = (name: string) => row[name] === null ? null : Number(row[name]);
  return {
    id: String(row.id),
    sequence: Number(row.sequence),
    restaurantId: String(row.restaurant_id),
    actorUserId: row.actor_user_id === null ? null : String(row.actor_user_id),
    actorRole: row.actor_role as PurchaseDecisionEvent["actorRole"],
    decisionType: row.decision_type as PurchaseDecisionType,
    purchaseRecommendationId: String(row.purchase_recommendation_id),
    inventoryItemId: String(row.inventory_item_id),
    supplierId: String(row.supplier_id),
    recommendationSource: row.recommendation_source as PurchaseDecisionEvent["recommendationSource"],
    recommendationUnit: String(row.recommendation_unit),
    recommendedQuantity: Number(row.recommended_quantity),
    chosenQuantity: nullableNumber("chosen_quantity"),
    canonicalUnit: row.canonical_unit as PurchaseDecisionEvent["canonicalUnit"],
    canonicalQuantityPerUnit: Number(row.canonical_quantity_per_unit),
    recommendedCanonicalQuantity: Number(row.recommended_canonical_quantity),
    chosenCanonicalQuantity: nullableNumber("chosen_canonical_quantity"),
    quantityDelta: nullableNumber("quantity_delta"),
    canonicalQuantityDelta: nullableNumber("canonical_quantity_delta"),
    quantityRatio: nullableNumber("quantity_ratio"),
    planningRevision: nullableNumber("planning_revision"),
    contextEvidence: (row.context_evidence ?? {}) as Record<string, unknown>,
    targetEventId: row.target_event_id === null ? null : String(row.target_event_id),
    sourceAuditLogId: row.source_audit_log_id === null ? null : String(row.source_audit_log_id),
    sourceEventKey: String(row.source_event_key),
    evidenceVersion: PURCHASE_DECISION_EVIDENCE_VERSION,
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at)
  };
}
