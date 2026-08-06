import assert from "node:assert/strict";
import test from "node:test";

import {
  autonomyLevelForActionType,
  createPreparedAction,
  markApproved,
  markExecuted,
  markFailed,
  markRejected,
  markReversed,
  measureOutcome,
  miseActionIdempotencyKey,
  requiresApproval
} from "../services/domain/miseActions";

const restaurantId = "rest_actions";

test("spend and external actions require approval; internal tasks do not", () => {
  assert.equal(requiresApproval("send_supplier_order"), true);
  assert.equal(requiresApproval("change_price"), true);
  assert.equal(requiresApproval("create_internal_task"), false);
  assert.equal(requiresApproval("recalculate_forecast"), false);
  assert.equal(autonomyLevelForActionType("measure_outcome"), 5);
  assert.equal(autonomyLevelForActionType("prepare_supplier_order_draft"), 3);
});

test("prepared action lifecycle enforces approval before high-impact execution", () => {
  const action = createPreparedAction({
    restaurantId,
    actionType: "send_supplier_order",
    recommendationId: "rec_1",
    requestedBy: "user_1",
    idempotencyKey: miseActionIdempotencyKey(restaurantId, "send_supplier_order", "order_1"),
    financialImpactCents: 19570,
    now: "2026-08-02T12:00:00.000Z"
  });

  assert.equal(action.status, "waiting_for_approval");
  assert.equal(action.executionMode, "prepare");
  assert.throws(() => markExecuted(action));

  const approved = markApproved(action, "user_owner", "2026-08-02T12:05:00.000Z");
  assert.equal(approved.status, "approved");
  const executed = markExecuted(approved, { providerMessageId: "msg_1" }, "2026-08-02T12:06:00.000Z");
  assert.equal(executed.status, "executed");
  assert.equal(executed.executedAt, "2026-08-02T12:06:00.000Z");

  const reversed = markReversed(executed, "rollback_1", "2026-08-02T13:00:00.000Z");
  assert.equal(reversed.status, "reversed");
  assert.equal(reversed.rollbackReference, "rollback_1");
});

test("low-risk prepared actions can execute without approval", () => {
  const action = createPreparedAction({
    restaurantId,
    actionType: "create_internal_task",
    idempotencyKey: "task:count-cabbage",
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(action.status, "prepared");
  const executed = markExecuted(action, { taskId: "task_1" });
  assert.equal(executed.status, "executed");
});

test("reject and fail paths are explicit", () => {
  const action = createPreparedAction({
    restaurantId,
    actionType: "send_supplier_communication",
    idempotencyKey: "comm:1",
    now: "2026-08-02T12:00:00.000Z"
  });
  const rejected = markRejected(action, "user_owner");
  assert.equal(rejected.status, "rejected");
  assert.throws(() => markExecuted(rejected));

  const failed = markFailed(action, "Provider unavailable");
  assert.equal(failed.status, "failed");
  assert.match(failed.error ?? "", /Provider unavailable/);
});

test("measureOutcome computes numeric variance and lesson", () => {
  const outcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { stockoutPrevented: true, unavailableSalesCents: 32000 },
    actualResult: { stockoutPrevented: true, unavailableSalesCents: 0 },
    measuredAt: "2026-08-02T22:00:00.000Z",
    lesson: "Ordering before the cutoff protected dinner availability."
  });

  assert.equal(outcome.restaurantId, restaurantId);
  assert.deepEqual(outcome.variance.unavailableSalesCents, {
    expected: 32000,
    actual: 0,
    delta: -32000
  });
  assert.match(outcome.lesson ?? "", /Ordering before the cutoff/);
});
