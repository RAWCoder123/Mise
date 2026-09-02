import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory adjust screen pins manager-only signed ledger submission", () => {
  const screen = readFileSync("app/more/inventory-adjust.tsx", "utf8");
  assert.match(screen, /queueInventoryAdjustment/);
  assert.match(screen, /flushQueuedInventoryEvents/);
  assert.match(screen, /canManageRestaurantData/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /presentRestaurantScopedHubActionsEditable/);
  assert.match(screen, /hubReady\s*\?\s*items\s*:\s*\[\]/);
  assert.match(screen, /signedAdjustmentQuantity/);
  assert.match(screen, /reasonCode/);
  assert.match(screen, /inventoryAdjust\.field\.note/);
  assert.doesNotMatch(screen, /eventType:\s*"correction"/);
  assert.doesNotMatch(screen, /supersedesEventId/);
});

test("more hub and router expose inventory adjust", () => {
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const smoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  assert.match(more, /\/more\/inventory-adjust/);
  assert.match(more, /more\.row\.inventoryAdjust\.title/);
  assert.match(layout, /more\/inventory-adjust/);
  assert.match(smoke, /\/more\/inventory-adjust/);
});

test("outbox exposes dedicated adjustment queue path", () => {
  const outbox = readFileSync("services/application/deviceInventoryOutbox.ts", "utf8");
  assert.match(outbox, /export function queueInventoryAdjustment/);
  assert.match(outbox, /requireInventoryAdjustment/);
});
