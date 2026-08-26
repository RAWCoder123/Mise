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

test("Today dispatches due recalculations before loading the operating plan", () => {
  const today = readFileSync("app/(tabs)/today.tsx", "utf8");
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");

  assert.match(today, /import \{ runScheduledRecalculations \} from/);
  assert.match(today, /const recalculation = await runScheduledRecalculations\(\{/);
  assert.match(today, /setRecalcAttention\(recalculation\)/);
  assert.match(
    today,
    /setRecalcAttention\(recalculation\);[\s\S]*?fetchDailyOperatingPlan\(restaurantId/
  );
  assert.match(today, /recalcAttention \? \(/);
  assert.match(today, /t\("home\.recalculation\.title"\)/);
  assert.match(today, /onAction=\{\(\) => router\.push\("\/more\/activity"\)\}/);

  // Home remains the other session surface that must keep the same contract.
  assert.match(home, /const recalculation = await runScheduledRecalculations\(\{/);
  assert.match(home, /fetchTodaySummary\(restaurantId\)/);
});

test("POS readiness failures remain visible and retryable instead of failing open", () => {
  const pos = readFileSync("app/settings/pos.tsx", "utf8");
  assert.match(pos, /setReadinessLoadError\(true\)/);
  assert.match(pos, /pos\.readiness\.unavailableTitle/);
  assert.match(pos, /onAction=\{\(\) => void loadPilotReadiness\(\)\}/);
  assert.match(pos, /readinessLoadError \? \(/);
});
