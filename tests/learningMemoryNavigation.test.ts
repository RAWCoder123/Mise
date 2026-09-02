import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RESTAURANT_MEMORY_REVIEW_HREF,
  resolveLearningMemoryReviewHref
} from "../services/presentation/learningMemoryNavigation";

test("learning memory review href stays on the existing restaurant memory hub", () => {
  assert.equal(RESTAURANT_MEMORY_REVIEW_HREF, "/more/restaurant-memory");
  assert.equal(resolveLearningMemoryReviewHref(), "/more/restaurant-memory");
});

test("Insights and Daily Report offer a restaurant-memory review deep link", () => {
  const insights = readFileSync("app/(tabs)/insights.tsx", "utf8");
  const dailyReport = readFileSync("app/more/daily-report.tsx", "utf8");

  assert.match(insights, /resolveLearningMemoryReviewHref/);
  assert.match(insights, /insights\.memory\.reviewAction/);

  assert.match(dailyReport, /resolveLearningMemoryReviewHref/);
  assert.match(dailyReport, /dailyReport\.learning\.reviewAction/);
  assert.match(dailyReport, /dailyReport\.supplierReliability\.reviewMemory/);
});

test("learning memory review copy exists in EN, ES, and zh-Hans catalogs", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "insights.memory.reviewAction",
    "dailyReport.learning.reviewAction",
    "dailyReport.supplierReliability.reviewMemory"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist once per locale`);
  }
});
