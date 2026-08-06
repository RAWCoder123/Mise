import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyCloseoutSummary } from "../services/domain/dailyCloseout";

const base = {
  operatingDate: "2026-08-03",
  restaurantTimeZone: "America/New_York",
  completedTasks: 0,
  openTasks: 4,
  operatorTasksOpen: 1,
  inventoryAlerts: 2,
  pendingRecommendations: 1
};

test("daily closeout stays quiet before work is completed during service", () => {
  const summary = buildDailyCloseoutSummary({
    ...base,
    now: new Date("2026-08-03T17:00:00.000Z")
  });

  assert.equal(summary.phase, "progress");
  assert.equal(summary.shouldShow, false);
  assert.equal(summary.remainingTasks, 5);
  assert.equal(summary.attentionItems, 3);
});

test("daily closeout encourages evidenced progress during the day", () => {
  const summary = buildDailyCloseoutSummary({
    ...base,
    completedTasks: 5,
    openTasks: 4,
    operatorTasksOpen: 1,
    now: new Date("2026-08-03T17:00:00.000Z")
  });

  assert.equal(summary.phase, "progress");
  assert.equal(summary.shouldShow, true);
  assert.equal(summary.totalTasks, 10);
  assert.equal(summary.completionRate, 0.5);
});

test("daily closeout becomes congratulatory in the restaurant closing window", () => {
  const summary = buildDailyCloseoutSummary({
    ...base,
    completedTasks: 6,
    now: new Date("2026-08-04T01:00:00.000Z")
  });

  assert.equal(summary.phase, "closing");
  assert.equal(summary.shouldShow, true);
  assert.equal(summary.completedTasks, 6);
});

test("daily closeout recognizes a fully cleared task board", () => {
  const summary = buildDailyCloseoutSummary({
    ...base,
    completedTasks: 7,
    openTasks: 0,
    operatorTasksOpen: 0,
    now: new Date("2026-08-03T17:00:00.000Z")
  });

  assert.equal(summary.phase, "complete");
  assert.equal(summary.remainingTasks, 0);
  assert.equal(summary.completionRate, 1);
});

test("daily closeout normalizes invalid counts and rejects ambiguous identity", () => {
  const summary = buildDailyCloseoutSummary({
    ...base,
    completedTasks: Number.NaN,
    openTasks: -2,
    operatorTasksOpen: 1.9,
    now: new Date("2026-08-03T17:00:00.000Z")
  });

  assert.equal(summary.completedTasks, 0);
  assert.equal(summary.remainingTasks, 1);
  assert.throws(
    () => buildDailyCloseoutSummary({ ...base, restaurantTimeZone: "" }),
    /timezone/i
  );
  assert.throws(
    () => buildDailyCloseoutSummary({ ...base, operatingDate: "08-03-2026" }),
    /operating date/i
  );
});
