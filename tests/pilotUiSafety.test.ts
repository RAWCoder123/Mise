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

test("Home gates one-tap recommendation approve on fail-closed pilot readiness", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  assert.match(home, /fetchPilotReadiness\(restaurantId\)/);
  assert.match(home, /homePilotReadinessGate\(/);
  assert.match(home, /canOneTapRecommend=\{readinessGate\.canOneTapRecommend\}/);
  assert.match(home, /if \(!readinessGate\.canOneTapRecommend\)/);
  assert.match(home, /router\.push\("\/settings\/pos"\)/);
  assert.match(home, /home\.approvals\.reviewSetup/);
});

test("Orders gates recommendation approve on the same fail-closed pilot readiness contract", () => {
  const orders = readFileSync("app/(tabs)/orders.tsx", "utf8");
  assert.match(orders, /fetchPilotReadiness\(restaurantId\)/);
  assert.match(orders, /pilotRecommendUiGate\(/);
  assert.match(orders, /if \(!readinessGate\.canOneTapRecommend\)/);
  assert.match(orders, /setupBlocked=\{!readinessGate\.canOneTapRecommend\}/);
  assert.match(orders, /router\.push\("\/settings\/pos"\)/);
  assert.match(orders, /OrdersPilotReadinessNotice/);
});

test("Orders soft reload invalidates pilot readiness before replacement data arrives", () => {
  const orders = readFileSync("app/(tabs)/orders.tsx", "utf8");
  // Soft refresh must clear readiness immediately so approve cannot race on a stale gate.
  assert.match(
    orders,
    /if \(!showLoading && loadedRestaurantRef\.current === restaurantId\) \{\s*setPilotReadiness\(null\);\s*setReadinessLoadError\(false\);\s*\}/
  );
  assert.match(orders, /pilotRecommendUiGate\(pilotReadiness, readinessLoadError\)/);
  assert.match(orders, /if \(!readinessGate\.canOneTapRecommend\)/);
});
