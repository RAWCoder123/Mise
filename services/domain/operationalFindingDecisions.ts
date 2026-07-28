import type {
  FindingCategory,
  FindingEvidenceReference,
  OperationalFinding
} from "./operationalFindings";

export type OperationalFindingDecisionType = "approved" | "edited" | "dismissed";

export interface OperationalFindingDecisionInput {
  restaurantId: string;
  finding: OperationalFinding;
  decisionType: OperationalFindingDecisionType;
  editedRecommendedAction?: string | null;
  clientEventId: string;
  idempotencyKey: string;
}

export interface OperationalFindingDecision {
  id: string;
  sequence: number;
  restaurantId: string;
  findingId: string;
  policyVersion: string;
  decisionType: OperationalFindingDecisionType;
  findingGeneratedAt: string;
  findingCategory: FindingCategory;
  severity: OperationalFinding["severity"];
  confidenceScore: number;
  evidence: FindingEvidenceReference[];
  originalRecommendedAction: string;
  editedRecommendedAction: string | null;
  clientEventId: string;
  idempotencyKey: string;
  actorUserId: string | null;
  recordedAt: string;
}

function evidenceMatches(
  finding: OperationalFinding,
  decision: OperationalFindingDecision
) {
  return JSON.stringify(finding.evidence) === JSON.stringify(decision.evidence);
}

function decisionApplies(
  finding: OperationalFinding,
  decision: OperationalFindingDecision
) {
  return (
    decision.findingId === finding.id &&
    decision.policyVersion === finding.policyVersion &&
    decision.findingCategory === finding.category &&
    decision.severity === finding.severity &&
    decision.confidenceScore === finding.confidence.score &&
    decision.originalRecommendedAction === finding.recommendedAction &&
    Date.parse(decision.recordedAt) >= Date.parse(finding.sourceWindow.end) &&
    evidenceMatches(finding, decision)
  );
}

export function applyOperationalFindingDecisions(
  restaurantId: string,
  findings: readonly OperationalFinding[],
  decisions: readonly OperationalFindingDecision[]
): OperationalFinding[] {
  if (
    findings.some((finding) => finding.restaurantId !== restaurantId) ||
    decisions.some((decision) => decision.restaurantId !== restaurantId)
  ) {
    throw new Error("Finding feedback failed restaurant scope validation.");
  }

  return findings.map((finding) => {
    const latest = decisions
      .filter((decision) => decisionApplies(finding, decision))
      .sort((left, right) =>
        right.sequence - left.sequence ||
        right.recordedAt.localeCompare(left.recordedAt)
      )[0];
    if (!latest) {
      return {
        ...finding,
        managerFeedback: {
          state: "unreviewed",
          decisionId: null,
          recordedAt: null,
          effectiveRecommendedAction: finding.recommendedAction
        }
      };
    }

    return {
      ...finding,
      priority: "later",
      managerFeedback: {
        state: latest.decisionType,
        decisionId: latest.id,
        recordedAt: latest.recordedAt,
        effectiveRecommendedAction:
          latest.editedRecommendedAction ?? finding.recommendedAction
      }
    };
  });
}

const findingIdPattern = /^finding:[a-z0-9][a-z0-9:_-]{1,231}$/;
const policyVersionPattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const findingCategories = new Set<FindingCategory>([
  "inventory",
  "ordering",
  "sales",
  "waste",
  "prep",
  "cost",
  "data_quality"
]);
const severities = new Set<OperationalFinding["severity"]>(["info", "warning", "urgent"]);
const decisionTypes = new Set<OperationalFindingDecisionType>(["approved", "edited", "dismissed"]);
const evidenceTypes = new Set<FindingEvidenceReference["type"]>([
  "inventory_item",
  "purchase_recommendation",
  "insight",
  "pos_sale",
  "menu_mapping",
  "data_gap"
]);

function requireBoundedText(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new Error(`${label} is invalid.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} is invalid.`);
  return normalized;
}

function requireTimestamp(value: unknown, label: string) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} is invalid.`);
  }
  return new Date(value).toISOString();
}

function requireFiniteNumber(value: unknown, label: string, min: number, max: number) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function normalizeEvidence(value: unknown): FindingEvidenceReference[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
    throw new Error("Finding evidence is invalid.");
  }
  const normalized = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Finding evidence is invalid.");
    }
    const record = entry as Record<string, unknown>;
    const type = requireBoundedText(record.type, "Finding evidence type", 80);
    if (!evidenceTypes.has(type as FindingEvidenceReference["type"])) {
      throw new Error("Finding evidence type is invalid.");
    }
    return {
      type: type as FindingEvidenceReference["type"],
      id: requireBoundedText(record.id, "Finding evidence identity", 240),
      observedAt: requireTimestamp(record.observedAt, "Finding evidence timestamp"),
      summary: requireBoundedText(record.summary, "Finding evidence summary", 240)
    };
  });
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 12_000) {
    throw new Error("Finding evidence is too large.");
  }
  return normalized;
}

export function normalizeOperationalFindingDecisionInput(
  input: OperationalFindingDecisionInput
): OperationalFindingDecisionInput {
  const restaurantId = requireBoundedText(input.restaurantId, "Restaurant workspace", 64);
  if (input.finding.restaurantId !== restaurantId) {
    throw new Error("Finding decision failed restaurant scope validation.");
  }
  if (!findingIdPattern.test(input.finding.id)) throw new Error("Finding identity is invalid.");
  if (!policyVersionPattern.test(input.finding.policyVersion)) {
    throw new Error("Finding policy version is invalid.");
  }
  if (!findingCategories.has(input.finding.category)) throw new Error("Finding category is invalid.");
  if (!severities.has(input.finding.severity)) throw new Error("Finding severity is invalid.");
  if (!decisionTypes.has(input.decisionType)) throw new Error("Finding decision type is invalid.");

  const originalRecommendedAction = requireBoundedText(
    input.finding.recommendedAction,
    "Finding recommended action",
    320
  );
  const editedRecommendedAction =
    input.editedRecommendedAction === undefined || input.editedRecommendedAction === null
      ? null
      : requireBoundedText(input.editedRecommendedAction, "Edited recommended action", 320);
  if (
    input.decisionType === "edited"
      ? !editedRecommendedAction || editedRecommendedAction === originalRecommendedAction
      : editedRecommendedAction !== null
  ) {
    throw new Error("Finding decision edit is invalid.");
  }

  return {
    restaurantId,
    finding: {
      ...input.finding,
      id: input.finding.id.trim(),
      generatedAt: requireTimestamp(input.finding.generatedAt, "Finding generated timestamp"),
      recommendedAction: originalRecommendedAction,
      confidence: {
        ...input.finding.confidence,
        score: requireFiniteNumber(input.finding.confidence.score, "Finding confidence", 0, 1)
      },
      evidence: normalizeEvidence(input.finding.evidence)
    },
    decisionType: input.decisionType,
    editedRecommendedAction,
    clientEventId: requireBoundedText(input.clientEventId, "Finding decision event identity", 200),
    idempotencyKey: requireBoundedText(input.idempotencyKey, "Finding decision idempotency key", 240)
  };
}

export function operationalFindingDecisionRpcArguments(
  input: OperationalFindingDecisionInput
) {
  const normalized = normalizeOperationalFindingDecisionInput(input);
  return {
    p_restaurant_id: normalized.restaurantId,
    p_finding_id: normalized.finding.id,
    p_policy_version: normalized.finding.policyVersion,
    p_decision_type: normalized.decisionType,
    p_finding_generated_at: normalized.finding.generatedAt,
    p_finding_category: normalized.finding.category,
    p_severity: normalized.finding.severity,
    p_confidence_score: normalized.finding.confidence.score,
    p_evidence: normalized.finding.evidence,
    p_original_recommended_action: normalized.finding.recommendedAction,
    p_edited_recommended_action: normalized.editedRecommendedAction,
    p_client_event_id: normalized.clientEventId,
    p_idempotency_key: normalized.idempotencyKey
  };
}

export function normalizeOperationalFindingDecision(
  value: unknown,
  expectedRestaurantId: string
): OperationalFindingDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Finding decision returned an invalid response.");
  }
  const record = value as Record<string, unknown>;
  if (record.restaurant_id !== expectedRestaurantId) {
    throw new Error("Finding decision failed restaurant scope validation.");
  }
  const decisionType = requireBoundedText(record.decision_type, "Finding decision type", 16);
  const findingCategory = requireBoundedText(record.finding_category, "Finding category", 32);
  const severity = requireBoundedText(record.severity, "Finding severity", 16);
  if (!decisionTypes.has(decisionType as OperationalFindingDecisionType)) {
    throw new Error("Finding decision type is invalid.");
  }
  if (!findingCategories.has(findingCategory as FindingCategory)) {
    throw new Error("Finding category is invalid.");
  }
  if (!severities.has(severity as OperationalFinding["severity"])) {
    throw new Error("Finding severity is invalid.");
  }
  const editedRecommendedAction =
    record.edited_recommended_action === null
      ? null
      : requireBoundedText(record.edited_recommended_action, "Edited recommended action", 320);
  const findingId = requireBoundedText(record.finding_id, "Finding identity", 240);
  const policyVersion = requireBoundedText(record.policy_version, "Finding policy version", 64);
  if (!findingIdPattern.test(findingId)) throw new Error("Finding identity is invalid.");
  if (!policyVersionPattern.test(policyVersion)) throw new Error("Finding policy version is invalid.");
  const originalRecommendedAction = requireBoundedText(
    record.original_recommended_action,
    "Finding recommended action",
    320
  );
  if (
    decisionType === "edited"
      ? !editedRecommendedAction || editedRecommendedAction === originalRecommendedAction
      : editedRecommendedAction !== null
  ) {
    throw new Error("Finding decision edit is invalid.");
  }

  return {
    id: requireBoundedText(record.id, "Finding decision identity", 64),
    sequence: requireFiniteNumber(record.sequence, "Finding decision sequence", 1, Number.MAX_SAFE_INTEGER),
    restaurantId: expectedRestaurantId,
    findingId,
    policyVersion,
    decisionType: decisionType as OperationalFindingDecisionType,
    findingGeneratedAt: requireTimestamp(record.finding_generated_at, "Finding generated timestamp"),
    findingCategory: findingCategory as FindingCategory,
    severity: severity as OperationalFinding["severity"],
    confidenceScore: requireFiniteNumber(record.confidence_score, "Finding confidence", 0, 1),
    evidence: normalizeEvidence(record.evidence),
    originalRecommendedAction,
    editedRecommendedAction,
    clientEventId: requireBoundedText(record.client_event_id, "Finding decision event identity", 200),
    idempotencyKey: requireBoundedText(record.idempotency_key, "Finding decision idempotency key", 240),
    actorUserId:
      record.actor_user_id === null
        ? null
        : requireBoundedText(record.actor_user_id, "Finding decision actor", 64),
    recordedAt: requireTimestamp(record.recorded_at, "Finding decision timestamp")
  };
}
