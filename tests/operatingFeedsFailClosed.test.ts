import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Operating brief/plan and closeout reads must not invent empty auxiliary feeds.
 * Swallowing activity, awaiting-decision actions, finding decisions, floor notes,
 * outlooks, deliveries, or open count sessions as []/null hides approvals and
 * invents a healthy empty state while hubs still look ready.
 */
const FAIL_CLOSED_SOURCES = [
  "services/application/operatingBrief.ts",
  "services/application/operatingPlan.ts",
  "services/application/today.ts",
  "services/application/dailyReport.ts",
  "app/(tabs)/today.tsx",
  "app/(tabs)/inventory.tsx"
] as const;

test("operating brief and plan do not swallow auxiliary repository failures as empty arrays", () => {
  const brief = readFileSync("services/application/operatingBrief.ts", "utf8");
  const plan = readFileSync("services/application/operatingPlan.ts", "utf8");

  assert.match(brief, /listActivityEvents\(normalizedRestaurantId,\s*\{\s*limit:\s*80\s*\}\)/);
  assert.match(
    brief,
    /listMiseActions\(normalizedRestaurantId,\s*\{\s*status:\s*"awaiting_decision",\s*limit:\s*40\s*\}\)/
  );
  assert.match(brief, /fetchOperationalFindingDecisions\(normalizedRestaurantId\)/);
  assert.doesNotMatch(brief, /\.catch\(\s*\(\)\s*=>\s*\[\s*\]\s*\)/);

  assert.match(plan, /listActivityEvents\(normalizedRestaurantId,\s*\{\s*limit:\s*80\s*\}\)/);
  assert.doesNotMatch(plan, /\.catch\(\s*\(\)\s*=>\s*\[\s*\]\s*\)/);
});

test("Today and Home summary feeds fail closed instead of inventing empty operational state", () => {
  const todayApp = readFileSync("services/application/today.ts", "utf8");
  const todayScreen = readFileSync("app/(tabs)/today.tsx", "utf8");
  const inventoryScreen = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const dailyReport = readFileSync("services/application/dailyReport.ts", "utf8");

  assert.match(todayApp, /fetchOpenInventoryCountSession\(normalizedRestaurantId\)/);
  assert.doesNotMatch(todayApp, /fetchOpenInventoryCountSession\([^)]*\)\.catch\(\s*\(\)\s*=>\s*null\s*\)/);

  assert.match(todayScreen, /listOpenOperatorTasks\(restaurantId\)/);
  assert.doesNotMatch(todayScreen, /listOpenOperatorTasks\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\s*\]/);

  assert.match(inventoryScreen, /fetchOpenInventoryCountSession\(restaurantId\)/);
  assert.doesNotMatch(
    inventoryScreen,
    /fetchOpenInventoryCountSession\([^)]*\)\.catch\(\s*\(\)\s*=>\s*null\s*\)/
  );

  assert.match(dailyReport, /fetchInventoryOutlookItems\(normalizedRestaurantId\)/);
  assert.match(dailyReport, /listOpenOperatorTasks\(normalizedRestaurantId\)/);
  assert.match(dailyReport, /fetchSupplierReliabilitySummary\(normalizedRestaurantId\)/);
  assert.match(dailyReport, /fetchWasteAnalysis\(/);
  assert.doesNotMatch(dailyReport, /\.catch\(\s*\(\)\s*=>\s*\[\s*\]\s*\)/);
  assert.doesNotMatch(dailyReport, /\.catch\(\s*\(\)\s*=>\s*null\s*\)/);
  assert.doesNotMatch(dailyReport, /catch\s*\{\s*return\s*\[\];\s*\}/);
});

test("fail-closed operating feed sources stay listed for contract coverage", () => {
  for (const path of FAIL_CLOSED_SOURCES) {
    assert.ok(readFileSync(path, "utf8").length > 0, `${path} must remain readable`);
  }
});
