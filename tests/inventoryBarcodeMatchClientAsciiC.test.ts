import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchInventoryBarcode,
  normalizeInventoryBarcodeToken
} from "../services/domain/inventoryBarcodeMatch";
import type { InventoryItem } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/inventoryBarcodeMatch.ts", import.meta.url),
  "utf8"
);

const syscoSupplierId = "10000000-0000-4000-8000-000000000005";

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: "r1",
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_id: syscoSupplierId,
    supplier_name: "Sysco",
    last_updated: "2026-08-01T12:00:00.000Z",
    ...partial
  };
}

test("MISE-005JE pins normalizeInventoryBarcodeToken to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JE/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeInventoryBarcodeToken("),
    domainSource.indexOf("export function matchInventoryBarcode(")
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);
});

test("ASCII C fold keeps ordinary barcode tokens stable", () => {
  assert.equal(normalizeInventoryBarcodeToken("  ABC-123  "), "abc123");
  assert.equal(normalizeInventoryBarcodeToken("Roma Tomato"), "romatomato");
});

test("ASCII C fold does not invent Kelvin-sign barcode identity", () => {
  // Unicode toLowerCase would fold K → k and invent "kroma".
  assert.equal(normalizeInventoryBarcodeToken("Kroma"), "roma");
  assert.notEqual(normalizeInventoryBarcodeToken("Kroma"), "kroma");

  const items = [item({ id: "inv-roma", item_name: "Roma Tomato" })];
  // Scanning Kelvin-prefixed "KROMA" must not falsely exact-match a "kroma" token.
  assert.equal(matchInventoryBarcode("KROMA", items).matches[0]?.id, "inv-roma");
  assert.deepEqual(
    matchInventoryBarcode("Kroma-extra-no-hit", [
      item({ id: "kroma", item_name: "Other" })
    ]).matches,
    []
  );
});
