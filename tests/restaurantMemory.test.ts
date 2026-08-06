import assert from "node:assert/strict";
import test from "node:test";

import { measureOutcome } from "../services/domain/miseActions";
import {
  activeMemoriesForRecommendations,
  confidenceFromEvidence,
  confirmMemory,
  convertMemoryToRule,
  correctMemory,
  createMemory,
  createMemoryFromLearningSignals,
  createMemoryFromOutcome,
  dismissMemory,
  forgetMemory
} from "../services/domain/restaurantMemory";
import type { LearningMemorySummary } from "../types/mise";

const restaurantId = "rest_memory";

test("memory creation requires evidence and never invents empty memories", () => {
  assert.throws(() =>
    createMemory({
      restaurantId,
      memoryType: "demand_pattern",
      statement: "Friday dinner is higher",
      evidence: []
    })
  );

  const memory = createMemory({
    restaurantId,
    memoryType: "demand_pattern",
    statement: "Friday dinner demand is typically 18% higher.",
    evidence: [
      {
        type: "sales_window",
        id: "fri_4w",
        summary: "Last four Fridays above weekday baseline",
        observedAt: "2026-08-01T12:00:00.000Z"
      }
    ],
    now: "2026-08-02T12:00:00.000Z"
  });

  assert.equal(memory.status, "active");
  assert.ok(memory.confidence > 0);
  assert.equal(memory.affectsRecommendations, true);
});

test("learning signals and outcomes become inspectable memories", () => {
  const summary: LearningMemorySummary = {
    score: 70,
    label: "Learning",
    operatorCopy: "Mise is learning demand patterns.",
    nextStep: "Keep approving orders.",
    signals: [
      {
        label: "Friday demand",
        value: "+18%",
        detail: "Friday dinner demand is typically higher.",
        tone: "brand"
      }
    ]
  };

  const memories = createMemoryFromLearningSignals(restaurantId, summary, {
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(memories.length, 1);
  assert.match(memories[0]!.statement, /Friday dinner demand/);

  const outcome = measureOutcome({
    restaurantId,
    actionId: "action_1",
    expectedResult: { coverageDays: 2 },
    actualResult: { coverageDays: 1.8 },
    lesson: "Owner usually increases chicken orders by about 10%."
  });
  const outcomeMemory = createMemoryFromOutcome(restaurantId, outcome);
  assert.equal(outcomeMemory.memoryType, "action_outcome");
});

test("owner controls confirm, correct, dismiss, forget, and rule conversion", () => {
  const memory = createMemory({
    restaurantId,
    memoryType: "supplier_reliability",
    statement: "Metro Produce is often late.",
    evidence: [
      {
        type: "delivery",
        id: "d1",
        summary: "Arrived 42 minutes late",
        observedAt: "2026-07-30T10:00:00.000Z"
      }
    ],
    now: "2026-08-02T12:00:00.000Z"
  });

  const confirmed = confirmMemory(memory);
  assert.equal(confirmed.status, "confirmed");
  assert.ok(confirmed.confidence >= memory.confidence);

  const corrected = correctMemory(memory, "Metro Produce is late about 27% of the time.");
  assert.equal(corrected.status, "corrected");
  assert.match(corrected.statement, /27%/);

  const dismissed = dismissMemory(memory);
  assert.equal(dismissed.affectsRecommendations, false);

  const forgotten = forgetMemory(memory);
  assert.equal(forgotten.status, "forgotten");
  assert.throws(() => convertMemoryToRule(forgotten));

  const rule = convertMemoryToRule(confirmed);
  assert.equal(rule.enabled, false);
  assert.equal(rule.memoryId, memory.id);

  assert.equal(activeMemoriesForRecommendations([confirmed, dismissed]).length, 1);
  assert.ok(confidenceFromEvidence(memory.evidence) > 0);
});
