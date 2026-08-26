import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Home keeps local demo state visibly disclosed", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  assert.match(home, /visibleBrief\?\.demoLabeled/);
  assert.match(home, /t\("home\.demo\.label"\)/);
});

test("Home supplier-send review opens the exact draft instead of executing or dropping at the hub", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  assert.match(home, /card\.actionId && card\.orderId/);
  assert.match(home, /pathname: "\/orders\/\[id\]", params: \{ id: card\.orderId \}/);
});

test("Home soft-refresh load errors fail closed before approval stays actionable", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  assert.match(home, /resolveRestaurantScopedHubLoadState/);
  assert.match(home, /loadError: Boolean\(error\)/);
  assert.match(home, /hubReady \? summary : null/);
  assert.match(home, /hubReady \? brief : null/);
  assert.match(home, /presentRestaurantScopedHubActionsEditable/);
  assert.match(home, /if \(!restaurant \|\| !actionsEditable \|\| approvingId\) return;/);
  assert.match(home, /disabled=\{!actionsEditable \|\| Boolean\(approvingId\)\}/);
  // Greptile P1: Retry must not reopen stale approvals while a replacement load is in flight.
  assert.match(home, /readyProofRestaurantIdRef/);
  assert.match(home, /readyProofRestaurantIdRef\.current = null;\s*setLoadedRestaurantId\(null\);\s*setError/);
  assert.match(
    home,
    /needsBlockingLoad\s*=\s*!hasLoaded\.current \|\| readyProofRestaurantIdRef\.current !== restaurantId/
  );
});

test("Activity History soft-refresh load errors fail closed instead of keeping the prior feed", () => {
  const activity = readFileSync("app/more/activity.tsx", "utf8");
  assert.match(activity, /resolveRestaurantScopedHubLoadState/);
  assert.match(activity, /loadError: error/);
  assert.match(activity, /hubReady \? events : \[\]/);
  assert.match(activity, /!error && hubReady && visible\.length === 0/);
  // Greptile P1: initial failure + Retry must block with loading, not a blank feed.
  assert.match(activity, /readyProofRestaurantIdRef/);
  assert.match(
    activity,
    /readyProofRestaurantIdRef\.current = null;\s*setLoadedRestaurantId\(null\);\s*setError\(true\)/
  );
  assert.match(
    activity,
    /needsBlockingLoad\s*=\s*queryChanged \|\|\s*!hasLoaded\.current \|\|\s*readyProofRestaurantIdRef\.current !== restaurantId/
  );
});

test("Today promotes and fully reveals the operator-selected task bucket", () => {
  const today = readFileSync("app/(tabs)/today.tsx", "utf8");
  assert.match(today, /\[focus, \.\.\.GROUP_ORDER\.filter\(\(key\) => key !== focus\)\]/);
  assert.match(today, /key === focus \? grouped\[key\] : grouped\[key\]\.slice\(0, GROUP_CAPS\[key\]\)/);
});

test("Today keeps floor-note completion behind the restaurant role gate", () => {
  const screen = readFileSync("app/(tabs)/today.tsx", "utf8");

  assert.match(
    screen,
    /const floorNotesEditable = presentRestaurantScopedHubActionsEditable\(\{[\s\S]{0,200}allowed: canManageBrief,[\s\S]{0,200}busy: Boolean\(busyFloorNoteId\)/
  );
  assert.match(screen, /if \(!restaurant \|\| !floorNotesEditable\) return;/);
  assert.match(screen, /disabled=\{!floorNotesEditable\}/);
});

test("POS readiness failures remain visible and retryable instead of failing open", () => {
  const pos = readFileSync("app/settings/pos.tsx", "utf8");
  assert.match(pos, /setReadinessLoadError\(true\)/);
  assert.match(pos, /pos\.readiness\.unavailableTitle/);
  assert.match(pos, /onAction=\{\(\) => void loadPilotReadiness\(\)\}/);
  assert.match(pos, /readinessLoadError \? \(/);
});
