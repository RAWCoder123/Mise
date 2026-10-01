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

test("Settings hub soft-refresh errors do not claim Gmail is disconnected or suppliers are zero", () => {
  const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(settings, /const hubUnavailable = hubLoadState === "error"/);
  assert.match(settings, /gmailConnectionBadge\(visibleEmailConnection, t, hubUnavailable\)/);
  assert.match(settings, /if \(hubUnavailable\) return t\("settings\.gmail\.status\.unavailable"\)/);
  assert.match(settings, /settings\.operations\.suppliers\.unavailable/);
  assert.match(settings, /actionLabel=\{message\.key === "settings\.notice\.loadError" \? t\("common\.retry"\) : undefined\}/);
  assert.match(settings, /settings\.notice\.loadErrorRetryAccessibility/);
  assert.match(catalog, /"settings\.gmail\.status\.unavailable": "Unavailable"/);
  assert.match(catalog, /"settings\.operations\.suppliers\.unavailable": "Unavailable"/);
  assert.match(catalog, /"settings\.notice\.loadErrorBody":/);
  assert.equal((catalog.match(/"settings\.gmail\.status\.unavailable":/g) || []).length, 3);
  assert.equal((catalog.match(/"settings\.operations\.suppliers\.unavailable":/g) || []).length, 3);
  assert.equal((catalog.match(/"settings\.notice\.loadErrorBody":/g) || []).length, 3);
});
