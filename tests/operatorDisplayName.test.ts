import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATOR_DISPLAY_NAME_MAX_LENGTH,
  normalizeOperatorDisplayName,
  resolveOperatorDisplayName
} from "../services/domain/operatorDisplayName";

test("normalizeOperatorDisplayName trims and accepts valid names", () => {
  assert.equal(normalizeOperatorDisplayName("  Maya Chen  "), "Maya Chen");
  assert.equal(normalizeOperatorDisplayName("A"), "A");
  assert.equal(
    normalizeOperatorDisplayName("x".repeat(OPERATOR_DISPLAY_NAME_MAX_LENGTH)),
    "x".repeat(OPERATOR_DISPLAY_NAME_MAX_LENGTH)
  );
});

test("normalizeOperatorDisplayName rejects empty, oversized, and non-string values", () => {
  assert.throws(() => normalizeOperatorDisplayName(""), /1 and 120/);
  assert.throws(() => normalizeOperatorDisplayName("   "), /1 and 120/);
  assert.throws(
    () => normalizeOperatorDisplayName("x".repeat(OPERATOR_DISPLAY_NAME_MAX_LENGTH + 1)),
    /1 and 120/
  );
  assert.throws(() => normalizeOperatorDisplayName(null), /1 and 120/);
  assert.throws(() => normalizeOperatorDisplayName(12 as unknown as string), /1 and 120/);
});

test("resolveOperatorDisplayName prefers stored name then email local-part", () => {
  assert.equal(resolveOperatorDisplayName("Jordan Lee", "jordan@example.com"), "Jordan Lee");
  assert.equal(resolveOperatorDisplayName("  ", "jordan@example.com"), "jordan");
  assert.equal(resolveOperatorDisplayName(null, "owner@kitchen.test"), "owner");
  assert.equal(resolveOperatorDisplayName(null, null), "Restaurant Operator");
  assert.equal(resolveOperatorDisplayName(null, ""), "Restaurant Operator");
});
