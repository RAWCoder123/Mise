import assert from "node:assert/strict";
import test from "node:test";

import type { DemoState } from "../services/demo/replaceableDemoData";
import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

test("demo approval, replay, undo, dismissal, and exclusion mirror append-only purchase memory", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  const recommendation = (await repository.fetchPurchaseRecommendations(DEMO_RESTAURANT_ID, "pending"))[0];
  assert.ok(recommendation);
  assert.equal(recommendation.generation_source, "mise_rules");

  const chosen = recommendation.recommended_quantity * 0.8;
  const approval = await repository.approvePurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    recommendation.id,
    chosen
  );
  assert.equal(approval.outcome, "applied");
  const replay = await repository.approvePurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    recommendation.id,
    chosen
  );
  assert.equal(replay.outcome, "already_applied");

  const storageKey = [...values.keys()].find((key) => key.includes("demo-store"));
  assert.ok(storageKey);
  let stored = JSON.parse(values.get(storageKey)!) as DemoState;
  assert.equal(stored.schema_version, 14);
  assert.equal(stored.purchaseDecisionEvents.length, 1);
  assert.equal(stored.purchaseDecisionEvents[0]!.decisionType, "approve_with_override");
  assert.equal(stored.purchaseDecisionEvents[0]!.recommendedQuantity, recommendation.recommended_quantity);
  assert.equal(stored.purchaseDecisionEvents[0]!.chosenQuantity, chosen);

  const insufficient = await repository.fetchPurchaseDecisionPatterns(DEMO_RESTAURANT_ID);
  assert.equal(insufficient[0]?.sampleCount, 1);
  assert.equal(insufficient[0]?.eligible, false);

  const undo = await repository.undoPurchaseRecommendationAction(
    DEMO_RESTAURANT_ID,
    recommendation.id
  );
  assert.equal(undo.outcome, "applied");
  assert.equal((await repository.fetchPurchaseDecisionPatterns(DEMO_RESTAURANT_ID)).length, 0);
  stored = JSON.parse(values.get(storageKey)!) as DemoState;
  assert.equal(stored.purchaseDecisionEvents.length, 2);
  assert.equal(stored.purchaseDecisionEvents[1]!.decisionType, "undo");
  assert.equal(stored.purchaseDecisionEvents[1]!.targetEventId, stored.purchaseDecisionEvents[0]!.id);

  const dismissal = await repository.dismissPurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    recommendation.id
  );
  assert.equal(dismissal.outcome, "applied");
  stored = JSON.parse(values.get(storageKey)!) as DemoState;
  const dismissedEvent = stored.purchaseDecisionEvents.find((event) => event.decisionType === "dismiss");
  assert.ok(dismissedEvent);
  assert.equal(dismissedEvent.chosenQuantity, null);

  const exclusion = await repository.excludePurchaseDecisionEvent(
    DEMO_RESTAURANT_ID,
    dismissedEvent.id
  );
  const exclusionReplay = await repository.excludePurchaseDecisionEvent(
    DEMO_RESTAURANT_ID,
    dismissedEvent.id
  );
  assert.equal(exclusion.id, exclusionReplay.id);
  assert.equal((await repository.fetchPurchaseDecisionPatterns(DEMO_RESTAURANT_ID)).length, 0);
  stored = JSON.parse(values.get(storageKey)!) as DemoState;
  assert.equal(
    stored.purchaseDecisionEvents.filter((event) => event.decisionType === "exclude_from_learning").length,
    1
  );
});
