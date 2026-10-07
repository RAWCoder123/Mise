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

test("MISE-005JR pins inventoryBarcodeMatch normalize to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JR/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeInventoryBarcodeToken("),
    domainSource.indexOf("export function matchInventoryBarcode(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);
});

test("ASCII C fold keeps ordinary barcode tokens stable", () => {
  assert.equal(normalizeInventoryBarcodeToken("  ABC-123  "), "abc123");
  assert.equal(normalizeInventoryBarcodeToken("Roma Tomato"), "romatomato");
  assert.equal(normalizeInventoryBarcodeToken("SYSCO-PROTEINS"), "syscoproteins");
  assert.equal(normalizeInventoryBarcodeToken(null), "");
  assert.equal(normalizeInventoryBarcodeToken(undefined), "");
  assert.equal(normalizeInventoryBarcodeToken(""), "");
});

test("ASCII C fold does not invent Kelvin-sign barcode match identity", () => {
  // Unicode toLowerCase would fold K → k and invent "kg123" / "kelvin"
  // tokens that then survive the ASCII alnum filter.
  assert.equal(normalizeInventoryBarcodeToken("KG-123"), "g123");
  assert.notEqual(
    normalizeInventoryBarcodeToken("KG-123"),
    normalizeInventoryBarcodeToken("KG-123")
  );
  assert.equal(normalizeInventoryBarcodeToken("KG-123"), "kg123");

  assert.equal(normalizeInventoryBarcodeToken("Kelvin Peppers"), "elvinpeppers");
  assert.notEqual(
    normalizeInventoryBarcodeToken("Kelvin Peppers"),
    normalizeInventoryBarcodeToken("Kelvin Peppers")
  );
  assert.equal(normalizeInventoryBarcodeToken("Kelvin Peppers"), "kelvinpeppers");

  // NBSP is outside ASCII whitespace; after the fold it is still non-alnum
  // and collapses away like other punctuation, without inventing a Kelvin
  // case fold.
  assert.equal(normalizeInventoryBarcodeToken("Bell\u00a0Peppers"), "bellpeppers");
  assert.equal(
    normalizeInventoryBarcodeToken("Bell\u00a0Peppers"),
    normalizeInventoryBarcodeToken("Bell Peppers")
  );

  // Exact ASCII scans still match. A Kelvin-only leftover that shares no
  // substring with inventory tokens returns empty (no invented identity).
  const items = [
    item({ id: "inv-abc", item_name: "ABC-999" }),
    item({ id: "inv-kg", item_name: "KG-123" }),
    item({ id: "inv-kelvin", item_name: "Kelvin Peppers" })
  ];
  assert.equal(matchInventoryBarcode("KG-123", items).matches[0]?.id, "inv-kg");
  assert.equal(matchInventoryBarcode("Kelvin Peppers", items).matches[0]?.id, "inv-kelvin");
  assert.equal(matchInventoryBarcode("ABC-999", items).matches[0]?.id, "inv-abc");
  assert.deepEqual(matchInventoryBarcode("KZZ-000", items).matches, []);
});
