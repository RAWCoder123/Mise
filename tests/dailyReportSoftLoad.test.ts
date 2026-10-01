import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Daily Report secondary feeds fail closed instead of soft-swallowing empty/null", () => {
  const application = source("services/application/dailyReport.ts");

  assert.match(application, /fetchInventoryOutlookItems\(normalizedRestaurantId\)/);
  assert.match(application, /listOpenOperatorTasks\(normalizedRestaurantId\)/);
  assert.match(application, /fetchSupplierReliabilitySummary\(normalizedRestaurantId\)/);
  assert.match(application, /fetchWasteAnalysis\(normalizedRestaurantId/);
  assert.match(application, /loadDeliveriesToday\(/);
  assert.match(application, /const history = await fetchDeliveryHistory\(restaurantId\)/);

  assert.doesNotMatch(
    application,
    /fetchInventoryOutlookItems\([^)]*\)\.catch\(\(\)\s*=>\s*\[\]\)/
  );
  assert.doesNotMatch(
    application,
    /listOpenOperatorTasks\([^)]*\)\.catch\(\(\)\s*=>\s*\[\]\)/
  );
  assert.doesNotMatch(
    application,
    /fetchSupplierReliabilitySummary\([^)]*\)\.catch\(\(\)\s*=>\s*null\)/
  );
  assert.doesNotMatch(application, /fetchWasteAnalysis\([\s\S]*?\)\.catch\(\(\)\s*=>\s*null\)/);
  assert.doesNotMatch(
    application,
    /async function loadDeliveriesToday[\s\S]*?catch\s*\{[\s\S]*?return \[\];/
  );

  // Generative Ask briefing remains optional and must not block closeout facts.
  assert.match(application, /askBriefingText = null/);
  assert.match(application, /catch \{\s*askBriefingText = null;\s*\}/);
});

test("Daily Report screen gates closeout body on shared hub readiness", () => {
  const screen = source("app/more/daily-report.tsx");

  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /hubReady/);
  assert.match(screen, /hubReady\s*\?\s*report\s*:\s*null/);
  assert.match(screen, /RetryNotice/);
  assert.match(screen, /captureMiseError/);
});
