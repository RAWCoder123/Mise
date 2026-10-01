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

test("Today soft-refresh errors do not claim an all-clear empty operating day", () => {
  const today = readFileSync("app/(tabs)/today.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(today, /const hubUnavailable = hubLoadState === "error"/);
  assert.match(today, /today\.unavailable\.title/);
  assert.match(today, /today\.unavailable\.body/);
  assert.match(today, /hubUnavailable \? \(/);
  assert.match(today, /DailyBriefBoard/);
  assert.doesNotMatch(
    today,
    /hubUnavailable[\s\S]{0,80}DailyBriefBoard/,
    "Daily Brief must not render while the hub is unavailable"
  );
  assert.match(catalog, /"today\.unavailable\.title": "Today’s plan is unavailable"/);
  assert.match(catalog, /"today\.unavailable\.body":/);
  assert.equal((catalog.match(/"today\.unavailable\.title":/g) || []).length, 3);
  assert.equal((catalog.match(/"today\.unavailable\.body":/g) || []).length, 3);
});

test("Log delivery and suppliers suppress false empty claims while hubs are unavailable", () => {
  const logDelivery = readFileSync("app/more/log-delivery.tsx", "utf8");
  const suppliers = readFileSync("app/settings/suppliers.tsx", "utf8");

  assert.match(logDelivery, /const hubUnavailable = hubLoadState === "error"/);
  assert.match(logDelivery, /hubUnavailable\s*\?\s*null\s*:\s*filtered\.length === 0/);
  assert.match(logDelivery, /hubUnavailable\s*\?\s*null\s*:[\s\S]{0,80}visibleHistory\.length === 0/);
  assert.match(logDelivery, /disabled=\{hubUnavailable\}/);
  assert.match(suppliers, /!hubReady \? null : visibleEntries\.length === 0/);
  assert.match(suppliers, /!hubReady\s*\?\s*undefined\s*:\s*copy\.configuredCount/);
});
