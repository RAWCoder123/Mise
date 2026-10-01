import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Inventory hub surfaces Needs recount filter and freshness row hints", () => {
  const source = readFileSync(new URL("../app/(tabs)/inventory.tsx", import.meta.url), "utf8");

  assert.match(source, /Needs recount/);
  assert.match(source, /inventory\.filter\.needsRecount/);
  assert.match(source, /inventory\.group\.needsRecount/);
  assert.match(source, /inventoryNeedsRecountForFreshness/);
  assert.match(source, /inventory\.row\.needsRecount\.stale/);
  assert.match(source, /inventory\.row\.needsRecount\.unverified/);
});

test("Inventory detail blocks Add to order when count freshness is untrusted", () => {
  const source = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");

  assert.match(source, /inventoryProjectionAllowsAddToOrder/);
  assert.match(source, /inventory\.detail\.countFreshness\.stale\.title/);
  assert.match(source, /inventory\.detail\.countFreshness\.unverified\.title/);
  assert.match(source, /inventory\.detail\.countFreshness\.addBlocked/);
  assert.match(source, /addToOrderBlocked/);
  assert.match(source, /mutationAllowed && !addToOrderBlocked/);
});

test("addInventoryItemToOrder fail-closes on stale and unverified counts", () => {
  const source = readFileSync(new URL("../services/application/inventory.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /countFreshness === "stale"[\s\S]*older than 36 hours/
  );
  assert.match(
    source,
    /countFreshness === "unverified"[\s\S]*verified physical count/
  );
});
