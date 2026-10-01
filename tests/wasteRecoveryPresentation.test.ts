import assert from "node:assert/strict";
import test from "node:test";

import type { WasteAnalysisAction } from "../services/domain/wasteAnalysis";
import {
  presentWasteRecoveryAction,
  wasteRecoveryLabelKey
} from "../services/presentation/wasteRecoveryPresentation";

const ACTIONS: readonly WasteAnalysisAction[] = [
  "start_logging",
  "review_repeat_item",
  "complete_cost_setup",
  "keep_logging"
];

test("start_logging and keep_logging always route to the inventory hub", () => {
  for (const recommendedAction of ["start_logging", "keep_logging"] as const) {
    const withItem = presentWasteRecoveryAction({
      recommendedAction,
      primaryItemId: "item-basil"
    });
    const withoutItem = presentWasteRecoveryAction({
      recommendedAction,
      primaryItemId: null
    });

    assert.equal(withItem.href, "/inventory");
    assert.equal(withoutItem.href, "/inventory");
    assert.equal(withItem.reason, recommendedAction);
    assert.equal(withItem.labelKey, `waste.action.${recommendedAction}`);
  }
});

test("review_repeat_item deep-links the primary item when present", () => {
  const action = presentWasteRecoveryAction({
    recommendedAction: "review_repeat_item",
    primaryItemId: "item-basil"
  });

  assert.equal(action.href, "/inventory/item-basil");
  assert.equal(action.labelKey, "waste.action.review_repeat_item");
  assert.equal(action.reason, "review_repeat_item");
});

test("complete_cost_setup deep-links the primary item when present", () => {
  const action = presentWasteRecoveryAction({
    recommendedAction: "complete_cost_setup",
    primaryItemId: "item-oil"
  });

  assert.equal(action.href, "/inventory/item-oil");
  assert.equal(action.labelKey, "waste.action.complete_cost_setup");
  assert.equal(action.reason, "complete_cost_setup");
});

test("item-targeted actions fail closed to inventory hub without a primary item", () => {
  for (const recommendedAction of ["review_repeat_item", "complete_cost_setup"] as const) {
    const blank = presentWasteRecoveryAction({
      recommendedAction,
      primaryItemId: "   "
    });
    const missing = presentWasteRecoveryAction({
      recommendedAction,
      primaryItemId: null
    });

    assert.equal(blank.href, "/inventory");
    assert.equal(missing.href, "/inventory");
    assert.equal(blank.reason, recommendedAction);
  }
});

test("primary item ids are path-encoded without inventing authority", () => {
  const action = presentWasteRecoveryAction({
    recommendedAction: "review_repeat_item",
    primaryItemId: "item/with space"
  });

  assert.equal(action.href, "/inventory/item%2Fwith%20space");
});

test("every recommended action has a dedicated label key", () => {
  for (const action of ACTIONS) {
    assert.equal(wasteRecoveryLabelKey(action), `waste.action.${action}`);
  }
});
