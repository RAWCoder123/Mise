import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory detail preflights waste that would drive on-hand below zero", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /checkDecreasingInventoryFitsOnHand/);
  assert.match(source, /operation === "waste"/);
  assert.match(source, /inventory\.ops\.insufficientOnHand/);
  assert.match(source, /inventory\.ops\.quantityExceedsOnHand/);
  assert.match(source, /insufficient_on_hand/);
  assert.match(source, /inventory\.ops\.result\.insufficientOnHand/);
});

test("demo inventory projection rejects insufficient on-hand without outbox deferral throws", () => {
  const source = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const start = source.indexOf("async function recordInventoryEvent");
  assert.ok(start >= 0);
  const method = source.slice(start, start + 3500);
  assert.match(method, /status:\s*"rejected"/);
  assert.match(method, /insufficient_on_hand/);
  assert.doesNotMatch(
    method,
    /throw new Error\("Inventory event would move on-hand outside supported limits"\)/
  );
});

test("on-hand insufficiency copy exists in EN, ES, and zh-Hans catalogs", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.ops.quantityExceedsOnHand",
    "inventory.ops.insufficientOnHand",
    "inventory.ops.result.insufficientOnHand"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g"));
    assert.equal(matches?.length, 3, `${key} should appear once per locale`);
  }
});
