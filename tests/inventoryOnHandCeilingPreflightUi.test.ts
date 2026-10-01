import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory detail preflights receipts that would exceed the on-hand ceiling", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /checkIncreasingInventoryFitsOnHand/);
  assert.match(source, /operation === "receipt"/);
  assert.match(source, /inventory\.ops\.exceedsOnHandCeiling/);
  assert.match(source, /inventory\.ops\.quantityExceedsOnHandCeiling/);
  assert.match(source, /exceeds_on_hand_ceiling/);
  assert.match(source, /inventory\.ops\.result\.exceedsOnHandCeiling/);
});

test("log delivery preflights receipts that would exceed the on-hand ceiling", () => {
  const source = readFileSync("app/more/log-delivery.tsx", "utf8");
  assert.match(source, /checkIncreasingInventoryFitsOnHand/);
  assert.match(source, /inventory\.ops\.exceedsOnHandCeiling/);
  assert.match(source, /exceeds_on_hand_ceiling/);
  assert.match(source, /inventory\.ops\.result\.exceedsOnHandCeiling/);
});

test("demo inventory projection rejects on-hand limit breaches without outbox deferral throws", () => {
  const source = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const start = source.indexOf("async function recordInventoryEvent");
  assert.ok(start >= 0);
  const method = source.slice(start, start + 4000);
  assert.match(method, /status:\s*"rejected"/);
  assert.match(method, /insufficient_on_hand/);
  assert.match(method, /exceeds_on_hand_ceiling/);
  assert.doesNotMatch(
    method,
    /throw new Error\("Inventory event would move on-hand outside supported limits"\)/
  );
});

test("on-hand ceiling copy exists in EN, ES, and zh-Hans catalogs", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.ops.quantityExceedsOnHandCeiling",
    "inventory.ops.exceedsOnHandCeiling",
    "inventory.ops.result.exceedsOnHandCeiling",
    "inventory.ops.result.insufficientOnHand"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g"));
    assert.equal(matches?.length, 3, `${key} should appear once per locale`);
  }
});
