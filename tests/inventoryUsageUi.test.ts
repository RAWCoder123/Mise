import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory usage screen pins manager-only positive ledger submission", () => {
  const screen = readFileSync("app/more/inventory-usage.tsx", "utf8");
  assert.match(screen, /queueInventoryUsage/);
  assert.match(screen, /flushQueuedInventoryEvents/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /hubReady\s*\?\s*items\s*:\s*\[\]/);
  assert.match(screen, /reasonCode/);
  assert.match(screen, /inventoryUsage\.field\.note/);
  assert.doesNotMatch(screen, /eventType:\s*"waste"/);
  assert.doesNotMatch(screen, /eventType:\s*"adjustment"/);
  assert.doesNotMatch(screen, /supersedesEventId/);
});

test("more hub and router expose inventory usage", () => {
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const smoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  assert.match(more, /\/more\/inventory-usage/);
  assert.match(more, /more\.row\.inventoryUsage\.title/);
  assert.match(layout, /more\/inventory-usage/);
  assert.match(smoke, /\/more\/inventory-usage/);
});

test("outbox exposes dedicated usage queue path", () => {
  const outbox = readFileSync("services/application/deviceInventoryOutbox.ts", "utf8");
  assert.match(outbox, /export function queueInventoryUsage/);
  assert.match(outbox, /requireInventoryUsage/);
});
