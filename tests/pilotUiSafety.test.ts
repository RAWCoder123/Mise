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

test("Insights soft-refresh failures do not claim empty learning or missing sales", () => {
  const insights = readFileSync("app/(tabs)/insights.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(insights, /const hubUnavailable = hubLoadState === "error"/);
  assert.match(insights, /captureMiseError\(loadFailure/);
  assert.match(insights, /insights\.summary\.unavailable/);
  assert.match(insights, /insights\.summary\.unavailableBody/);
  assert.match(insights, /insights\.nextStep\.unavailable/);
  assert.match(insights, /hubUnavailable \? null : \(/);
  assert.match(insights, /unavailable=\{hubUnavailable\}/);
  assert.match(insights, /insights\.trend\.unavailable\.title/);
  assert.match(insights, /insights\.analytics\.unavailable\.title/);
  assert.ok(
    insights.indexOf("hubUnavailable ? null : (") < insights.indexOf('insights.brief.emptyLearning.title'),
    "empty-learning copy must remain behind the hubUnavailable gate"
  );

  assert.match(catalog, /"insights\.summary\.unavailable":/);
  assert.match(catalog, /"insights\.summary\.unavailableBody":/);
  assert.match(catalog, /"insights\.nextStep\.unavailable":/);
  assert.match(catalog, /"insights\.trend\.unavailable\.title":/);
  assert.match(catalog, /"insights\.analytics\.unavailable\.title":/);
  assert.equal((catalog.match(/"insights\.summary\.unavailable":/g) || []).length, 3);
  assert.equal((catalog.match(/"insights\.trend\.unavailable\.title":/g) || []).length, 3);
  assert.equal((catalog.match(/"insights\.analytics\.unavailable\.title":/g) || []).length, 3);
});
