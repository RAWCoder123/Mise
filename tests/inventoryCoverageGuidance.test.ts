import assert from "node:assert/strict";
import test from "node:test";

import {
  COVERAGE_TARGET_PAR_DAYS,
  COVERAGE_TARGET_REORDER_DAYS,
  buildInventoryCoverageGuidance
} from "../services/domain/inventoryCoverageGuidance";

test("coverage guidance stays learning when usage is unknown", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 0,
    parLevel: 30,
    reorderThreshold: 10
  });
  assert.equal(guidance.status, "learning");
  assert.equal(guidance.parDays, null);
  assert.equal(guidance.suggestedPar, null);
  assert.equal(guidance.suggestionsDiffer, false);
});

test("coverage guidance translates par and reorder into days of cover", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 10,
    parLevel: 30,
    reorderThreshold: 15
  });
  assert.equal(guidance.status, "aligned");
  assert.equal(guidance.parDays, 3);
  assert.equal(guidance.reorderDays, 1.5);
  assert.equal(guidance.targetParDays, COVERAGE_TARGET_PAR_DAYS);
  assert.equal(guidance.targetReorderDays, COVERAGE_TARGET_REORDER_DAYS);
  assert.equal(guidance.suggestedPar, 30);
  assert.equal(guidance.suggestedReorder, 15);
  assert.equal(guidance.suggestionsDiffer, false);
});

test("coverage guidance flags reorder at or above par", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 8,
    parLevel: 20,
    reorderThreshold: 20
  });
  assert.equal(guidance.status, "misconfigured");
  assert.equal(guidance.parDays, 2.5);
  assert.equal(guidance.reorderDays, 2.5);
});

test("coverage guidance flags tight reorder cover", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 10,
    parLevel: 40,
    reorderThreshold: 5
  });
  assert.equal(guidance.status, "tight_reorder");
  assert.equal(guidance.reorderDays, 0.5);
  assert.equal(guidance.suggestionsDiffer, true);
  assert.equal(guidance.suggestedPar, 30);
  assert.equal(guidance.suggestedReorder, 15);
});

test("coverage guidance flags low par cover", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 10,
    parLevel: 12,
    reorderThreshold: 10
  });
  assert.equal(guidance.status, "low_par");
  assert.equal(guidance.parDays, 1.2);
  assert.equal(guidance.reorderDays, 1);
  assert.ok(guidance.suggestedPar !== null && guidance.suggestedPar > 12);
});

test("coverage guidance flags high par cover", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 5,
    parLevel: 50,
    reorderThreshold: 10
  });
  assert.equal(guidance.status, "high_par");
  assert.equal(guidance.parDays, 10);
  assert.equal(guidance.suggestionsDiffer, true);
});

test("coverage guidance keeps suggested reorder below suggested par", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: 0.4,
    parLevel: 2,
    reorderThreshold: 1
  });
  assert.ok(guidance.suggestedPar !== null);
  assert.ok(guidance.suggestedReorder !== null);
  assert.ok(guidance.suggestedReorder! < guidance.suggestedPar!);
});

test("coverage guidance rejects non-finite inputs as zero usage/settings", () => {
  const guidance = buildInventoryCoverageGuidance({
    averageDailyUsage: Number.NaN,
    parLevel: Number.POSITIVE_INFINITY,
    reorderThreshold: -3
  });
  assert.equal(guidance.status, "learning");
  assert.equal(guidance.averageDailyUsage, 0);
});
