import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseInventoryOperatorAction } from "../services/domain/inventoryOperatorAction";

test("parseInventoryOperatorAction accepts known ledger actions case-insensitively", () => {
  assert.equal(parseInventoryOperatorAction("waste"), "waste");
  assert.equal(parseInventoryOperatorAction("RECEIPT"), "receipt");
  assert.equal(parseInventoryOperatorAction(" Stockout "), "stockout");
  assert.equal(parseInventoryOperatorAction("count"), "count");
});

test("parseInventoryOperatorAction fails closed to count for unknown or empty values", () => {
  assert.equal(parseInventoryOperatorAction(undefined), "count");
  assert.equal(parseInventoryOperatorAction(null), "count");
  assert.equal(parseInventoryOperatorAction(""), "count");
  assert.equal(parseInventoryOperatorAction("   "), "count");
  assert.equal(parseInventoryOperatorAction("delete"), "count");
  assert.equal(parseInventoryOperatorAction("waste;drop"), "count");
});

test("inventory detail honors operation query param and waste hub deep-links waste", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const waste = readFileSync("app/more/waste.tsx", "utf8");

  assert.match(detail, /parseInventoryOperatorAction/);
  assert.match(detail, /operation\?:/);
  assert.match(detail, /setOperation\(requestedOperation\)/);

  assert.match(waste, /filterWasteRecordInventoryBySearch/);
  assert.match(waste, /operation=waste/);
  assert.match(waste, /waste\.search\.placeholder/);
  assert.doesNotMatch(waste, /router\.push\("\/inventory"\)/);
});
