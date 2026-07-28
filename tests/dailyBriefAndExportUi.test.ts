import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("daily brief UI uses screen-safe brief and finding-feedback facades", () => {
  const today = source("app/(tabs)/today.tsx");
  const insights = source("app/(tabs)/insights.tsx");
  const board = source("components/dailyBrief/DailyBriefBoard.tsx");
  const catalog = source("i18n/catalog.ts");

  for (const [name, screen] of Object.entries({ today, insights })) {
    assert.match(screen, /fetchDailyOperationalBrief/, `${name} loads daily brief`);
    assert.match(screen, /queueOperationalFindingDecision/, `${name} queues feedback`);
    assert.match(screen, /fetchQueuedOperationalFindingDecisions/, `${name} reads feedback queue`);
    assert.match(screen, /flushQueuedOperationalFindingDecisions/, `${name} flushes feedback queue`);
    assert.match(screen, /canManageRestaurantData/, `${name} gates manager feedback`);
    assert.match(screen, /DailyBriefBoard/, `${name} renders daily brief board`);
    assert.match(screen, /AppState\.addEventListener\("change"/, `${name} flushes on resume`);
    assert.doesNotMatch(screen, /recordOperationalFindingDecision/, `${name} avoids direct record`);
    assert.doesNotMatch(screen, /getMiseRepository|from "\.\.\/\.\.\/services\/repositories/, `${name} avoids repositories`);
  }

  assert.match(board, /managerFeedback\.effectiveRecommendedAction/);
  assert.match(board, /finding\.recommendedAction/);
  assert.match(board, /dailyBrief\.feedbackDisclaimer/);
  assert.match(catalog, /"dailyBrief\.title":/);
  assert.match(catalog, /"dailyBrief\.feedbackDisclaimer":/);
  assert.equal((catalog.match(/"dailyBrief\.title":/g) || []).length, 3);
});

test("restaurant export UI is owner/admin-only and never logs payloads", () => {
  const settings = source("app/(tabs)/settings.tsx");
  const exportScreen = source("app/settings/export.tsx");
  const catalog = source("i18n/catalog.ts");

  assert.match(settings, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(settings, /router\.push\("\/settings\/export"/);
  assert.match(exportScreen, /exportRestaurantData\(restaurantId\)/);
  assert.match(exportScreen, /canDeleteRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(exportScreen, /expo-file-system\/legacy/);
  assert.match(exportScreen, /expo-sharing/);
  assert.match(exportScreen, /mise-restaurant-export-/);
  assert.match(exportScreen, /Platform\.OS === "web"/);
  assert.match(exportScreen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.doesNotMatch(exportScreen, /console\.(log|debug|info|warn)\(/);
  assert.doesNotMatch(exportScreen, /JSON\.stringify\(payload\).{0,40}console/);
  assert.match(catalog, /"export\.retention\.body":/);
  assert.match(catalog, /Provider credentials and private security logs are excluded/);
  assert.equal((catalog.match(/"export\.title":/g) || []).length, 3);
});
