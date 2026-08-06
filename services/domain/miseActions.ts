import { createId } from "./miseDomain";
import type { AutonomyLevel } from "./operationalStatus";

export type MiseActionType =
  | "create_internal_task"
  | "recalculate_forecast"
  | "update_prep_recommendation"
  | "schedule_inventory_count"
  | "remind_employee"
  | "flag_menu_item_internally"
  | "prepare_supplier_order_draft"
  | "send_supplier_order"
  | "change_schedule"
  | "contact_external_party"
  | "modify_menu_availability"
  | "change_price"
  | "send_staff_communication"
  | "send_supplier_communication"
  | "issue_refund_or_credit"
  | "change_permissions_or_rules"
  | "prepare_inventory_adjustment"
  | "measure_outcome";

export type MiseExecutionMode = "observe" | "recommend" | "prepare" | "execute";

export type MiseActionStatus =
  | "prepared"
  | "waiting_for_approval"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled"
  | "reversed"
  | "unverified";

export interface MiseAction {
  id: string;
  restaurantId: string;
  recommendationId: string | null;
  actionType: MiseActionType;
  executionMode: MiseExecutionMode;
  status: MiseActionStatus;
  autonomyLevel: AutonomyLevel;
  requestedBy: string | null;
  approvedBy: string | null;
  executedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  rollbackReference: string | null;
  expectedImpact: Record<string, unknown> | null;
  financialImpactCents: number | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Outcome {
  id: string;
  actionId: string;
  restaurantId: string;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  variance: Record<string, unknown>;
  measuredAt: string;
  lesson: string | null;
}

const approvalRequiredActions = new Set<MiseActionType>([
  "send_supplier_order",
  "change_schedule",
  "contact_external_party",
  "modify_menu_availability",
  "change_price",
  "send_staff_communication",
  "send_supplier_communication",
  "issue_refund_or_credit",
  "change_permissions_or_rules"
]);

export function requiresApproval(actionType: MiseActionType): boolean {
  return approvalRequiredActions.has(actionType);
}

export function autonomyLevelForActionType(actionType: MiseActionType): AutonomyLevel {
  switch (actionType) {
    case "recalculate_forecast":
    case "update_prep_recommendation":
    case "flag_menu_item_internally":
      return 4;
    case "create_internal_task":
    case "schedule_inventory_count":
    case "remind_employee":
      return 4;
    case "prepare_supplier_order_draft":
    case "prepare_inventory_adjustment":
      return 3;
    case "send_supplier_order":
    case "change_schedule":
    case "contact_external_party":
    case "modify_menu_availability":
    case "change_price":
    case "send_staff_communication":
    case "send_supplier_communication":
    case "issue_refund_or_credit":
    case "change_permissions_or_rules":
      return 3;
    case "measure_outcome":
      return 5;
    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export function executionModeForActionType(actionType: MiseActionType): MiseExecutionMode {
  if (requiresApproval(actionType)) return "prepare";
  if (actionType === "measure_outcome") return "observe";
  if (
    actionType === "prepare_supplier_order_draft" ||
    actionType === "prepare_inventory_adjustment"
  ) {
    return "prepare";
  }
  return "execute";
}

export function miseActionIdempotencyKey(
  restaurantId: string,
  actionType: MiseActionType,
  subjectId: string
) {
  return `${restaurantId.trim()}:${actionType}:${subjectId.trim()}`;
}

export function createPreparedAction(input: {
  restaurantId: string;
  actionType: MiseActionType;
  recommendationId?: string | null;
  requestedBy?: string | null;
  expectedImpact?: Record<string, unknown> | null;
  financialImpactCents?: number | null;
  idempotencyKey: string;
  now?: string;
}): MiseAction {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Mise actions require a restaurant id.");
  if (!input.idempotencyKey.trim()) throw new Error("Mise actions require an idempotency key.");

  const now = input.now ? new Date(input.now).toISOString() : new Date().toISOString();
  const needsApproval = requiresApproval(input.actionType);

  return {
    id: createId("action"),
    restaurantId,
    recommendationId: input.recommendationId ?? null,
    actionType: input.actionType,
    executionMode: executionModeForActionType(input.actionType),
    status: needsApproval ? "waiting_for_approval" : "prepared",
    autonomyLevel: autonomyLevelForActionType(input.actionType),
    requestedBy: input.requestedBy ?? null,
    approvedBy: null,
    executedAt: null,
    result: null,
    error: null,
    rollbackReference: null,
    expectedImpact: input.expectedImpact ?? null,
    financialImpactCents:
      input.financialImpactCents === undefined || input.financialImpactCents === null
        ? null
        : Math.round(input.financialImpactCents),
    idempotencyKey: input.idempotencyKey.trim(),
    createdAt: now,
    updatedAt: now
  };
}

function touch(action: MiseAction, now: string, patch: Partial<MiseAction>): MiseAction {
  return {
    ...action,
    ...patch,
    updatedAt: now
  };
}

export function markApproved(
  action: MiseAction,
  approvedBy: string,
  now = new Date().toISOString()
): MiseAction {
  if (
    action.status !== "waiting_for_approval" &&
    action.status !== "prepared" &&
    action.status !== "failed"
  ) {
    throw new Error(`Cannot approve action in status ${action.status}.`);
  }
  return touch(action, now, {
    status: "approved",
    approvedBy: approvedBy.trim() || null
  });
}

export function markRejected(
  action: MiseAction,
  approvedBy: string | null = null,
  now = new Date().toISOString()
): MiseAction {
  if (action.status === "executed" || action.status === "reversed") {
    throw new Error(`Cannot reject action in status ${action.status}.`);
  }
  return touch(action, now, {
    status: "rejected",
    approvedBy: approvedBy?.trim() || action.approvedBy
  });
}

export function markExecuted(
  action: MiseAction,
  result: Record<string, unknown> | null = null,
  now = new Date().toISOString()
): MiseAction {
  if (requiresApproval(action.actionType) && action.status !== "approved") {
    throw new Error("Approval is required before executing this action.");
  }
  if (action.status === "executed") {
    throw new Error("Action already executed.");
  }
  if (action.status === "rejected" || action.status === "cancelled" || action.status === "reversed") {
    throw new Error(`Cannot execute action in status ${action.status}.`);
  }
  return touch(action, now, {
    status: "executed",
    executedAt: now,
    result,
    error: null
  });
}

export function markFailed(
  action: MiseAction,
  error: string,
  now = new Date().toISOString()
): MiseAction {
  return touch(action, now, {
    status: "failed",
    error: error.trim() || "Action failed.",
    executedAt: action.executedAt ?? now
  });
}

export function markReversed(
  action: MiseAction,
  rollbackReference: string,
  now = new Date().toISOString()
): MiseAction {
  if (action.status !== "executed" && action.status !== "failed") {
    throw new Error(`Cannot reverse action in status ${action.status}.`);
  }
  return touch(action, now, {
    status: "reversed",
    rollbackReference: rollbackReference.trim()
  });
}

function numericVariance(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
): Record<string, unknown> {
  const variance: Record<string, unknown> = {};
  for (const key of Object.keys(expected)) {
    const expectedValue = expected[key];
    const actualValue = actual[key];
    if (typeof expectedValue === "number" && typeof actualValue === "number") {
      variance[key] = {
        expected: expectedValue,
        actual: actualValue,
        delta: actualValue - expectedValue
      };
    } else if (expectedValue !== actualValue) {
      variance[key] = {
        expected: expectedValue,
        actual: actualValue,
        matched: false
      };
    }
  }
  return variance;
}

/** Persisted row shape matching Codex `public.mise_actions`. */
export interface PersistedMiseActionRow {
  id: string;
  restaurant_id: string;
  recommendation_id?: string | null;
  action_type: MiseActionType;
  execution_mode: MiseExecutionMode;
  status: MiseActionStatus;
  autonomy_level: AutonomyLevel | number;
  requested_by?: string | null;
  approved_by?: string | null;
  executed_at?: string | null;
  result?: Record<string, unknown> | null;
  error_message?: string | null;
  rollback_reference?: string | null;
  expected_impact?: Record<string, unknown> | null;
  financial_impact_cents?: number | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export function miseActionFromPersistedRow(row: PersistedMiseActionRow): MiseAction {
  const autonomy = Number(row.autonomy_level);
  if (![1, 2, 3, 4, 5].includes(autonomy)) {
    throw new Error("Mise action autonomy level is invalid.");
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id.trim(),
    recommendationId: row.recommendation_id ?? null,
    actionType: row.action_type,
    executionMode: row.execution_mode,
    status: row.status,
    autonomyLevel: autonomy as AutonomyLevel,
    requestedBy: row.requested_by ?? null,
    approvedBy: row.approved_by ?? null,
    executedAt: row.executed_at ?? null,
    result: row.result ?? null,
    error: row.error_message ?? null,
    rollbackReference: row.rollback_reference ?? null,
    expectedImpact: row.expected_impact ?? null,
    financialImpactCents:
      row.financial_impact_cents === null || row.financial_impact_cents === undefined
        ? null
        : Number(row.financial_impact_cents),
    idempotencyKey: row.idempotency_key,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export function measureOutcome(input: {
  restaurantId: string;
  actionId: string;
  expectedResult: Record<string, unknown>;
  actualResult: Record<string, unknown>;
  measuredAt?: string;
  lesson?: string | null;
}): Outcome {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) throw new Error("Outcomes require a restaurant id.");
  if (!input.actionId.trim()) throw new Error("Outcomes require an action id.");

  return {
    id: createId("outcome"),
    actionId: input.actionId,
    restaurantId,
    expectedResult: input.expectedResult,
    actualResult: input.actualResult,
    variance: numericVariance(input.expectedResult, input.actualResult),
    measuredAt: input.measuredAt
      ? new Date(input.measuredAt).toISOString()
      : new Date().toISOString(),
    lesson: input.lesson?.trim() || null
  };
}
