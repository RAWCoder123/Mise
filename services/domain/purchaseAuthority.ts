export const PURCHASE_AUTHORITY_BLOCKER_CODES = [
  "inventory_count_missing",
  "inventory_count_stale",
  "inventory_count_future",
  "inventory_projection_untrusted",
  "inventory_evidence_incomplete",
  "canonical_unit_unverified",
  "planning_revision_stale",
  "planning_window_incomplete",
  "demand_history_insufficient",
  "pos_not_connected",
  "pos_sync_stale",
  "provider_identity_incomplete",
  "provider_mapping_missing",
  "provider_mapping_ambiguous",
  "recipe_missing",
  "recipe_incomplete",
  "recipe_unit_incompatible",
  "recipe_inventory_reference_missing",
  "supplier_missing",
  "supplier_mismatch",
  "draft_authority_incomplete",
  "ordering_disabled",
  "recommendation_no_longer_actionable"
] as const;

export type PurchaseAuthorityBlockerCode = (typeof PURCHASE_AUTHORITY_BLOCKER_CODES)[number];

export interface PurchaseAuthorityBlocker {
  code: PurchaseAuthorityBlockerCode;
  description: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface PurchaseAuthorityEvidence {
  recommendationId: string;
  inventoryItemId: string;
  countEventId: string | null;
  countedAt: string | null;
  projectedQuantity: number | null;
  canonicalUnit: string | null;
  providerWindowFrom: string | null;
  providerWindowTo: string | null;
  providerWindowCompletedAt: string | null;
  recipeRevisions: Record<string, number>;
  basis: "physical_count_reorder_policy";
}

export interface PurchaseAuthorityResult {
  ready: boolean;
  blockers: PurchaseAuthorityBlocker[];
  evaluatedAt: string;
  planningRevision: number | null;
  evidence: PurchaseAuthorityEvidence;
}

export class PurchaseAuthorityBlockedError extends Error {
  readonly authority: PurchaseAuthorityResult;

  constructor(authority: PurchaseAuthorityResult) {
    super(authority.blockers[0]?.description ?? "Purchase approval is blocked by current operational evidence.");
    this.name = "PurchaseAuthorityBlockedError";
    this.authority = authority;
  }
}

const blockerCodes = new Set<string>(PURCHASE_AUTHORITY_BLOCKER_CODES);

export function normalizePurchaseAuthorityResult(value: unknown): PurchaseAuthorityResult {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const evidencePayload = payload.evidence && typeof payload.evidence === "object" && !Array.isArray(payload.evidence)
    ? payload.evidence as Record<string, unknown>
    : {};
  const blockers = Array.isArray(payload.blockers)
    ? payload.blockers.flatMap((entry): PurchaseAuthorityBlocker[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const blocker = entry as Record<string, unknown>;
      if (typeof blocker.code !== "string" || !blockerCodes.has(blocker.code)) return [];
      const metadata = blocker.metadata && typeof blocker.metadata === "object" && !Array.isArray(blocker.metadata)
        ? sanitizeMetadata(blocker.metadata as Record<string, unknown>)
        : {};
      return [{
        code: blocker.code as PurchaseAuthorityBlockerCode,
        description: boundedString(blocker.description, 240) || "Purchase evidence needs attention.",
        metadata
      }];
    })
    : [];
  const evaluatedAt = boundedString(payload.evaluatedAt, 80);
  const planningRevision = finiteInteger(payload.planningRevision);
  const recipeRevisions = evidencePayload.recipeRevisions && typeof evidencePayload.recipeRevisions === "object"
    && !Array.isArray(evidencePayload.recipeRevisions)
    ? Object.fromEntries(
      Object.entries(evidencePayload.recipeRevisions as Record<string, unknown>)
        .filter(([key, revision]) => Boolean(boundedString(key, 80)) && finiteInteger(revision) !== null)
        .slice(0, 250)
        .map(([key, revision]) => [boundedString(key, 80), finiteInteger(revision)!])
    )
    : {};

  return {
    ready: payload.ready === true && blockers.length === 0,
    blockers,
    evaluatedAt: evaluatedAt || new Date(0).toISOString(),
    planningRevision,
    evidence: {
      recommendationId: boundedString(evidencePayload.recommendationId, 80),
      inventoryItemId: boundedString(evidencePayload.inventoryItemId, 80),
      countEventId: nullableString(evidencePayload.countEventId, 80),
      countedAt: nullableString(evidencePayload.countedAt, 80),
      projectedQuantity: finiteNumber(evidencePayload.projectedQuantity),
      canonicalUnit: nullableString(evidencePayload.canonicalUnit, 20),
      providerWindowFrom: nullableString(evidencePayload.providerWindowFrom, 20),
      providerWindowTo: nullableString(evidencePayload.providerWindowTo, 20),
      providerWindowCompletedAt: nullableString(evidencePayload.providerWindowCompletedAt, 80),
      recipeRevisions,
      basis: "physical_count_reorder_policy"
    }
  };
}

export function isPurchaseAuthorityBlockedError(error: unknown): error is PurchaseAuthorityBlockedError {
  return error instanceof PurchaseAuthorityBlockedError;
}

export function purchaseAuthorityBlockerMessageKey(code: PurchaseAuthorityBlockerCode) {
  return `orders.authority.${code}` as const;
}

function boundedString(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nullableString(value: unknown, maximum: number) {
  const normalized = boundedString(value, maximum);
  return normalized || null;
}

function finiteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function finiteInteger(value: unknown) {
  const numeric = finiteNumber(value);
  return numeric !== null && Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 12)) {
    const safeKey = boundedString(key, 60);
    if (!safeKey) continue;
    if (typeof value === "boolean" || value === null) safe[safeKey] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[safeKey] = value;
    else if (typeof value === "string") safe[safeKey] = boundedString(value, 120);
  }
  return safe;
}
