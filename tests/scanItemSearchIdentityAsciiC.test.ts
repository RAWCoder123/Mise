import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeScanItemSearchToken,
  scanItemMatchesQuery
} from "../services/domain/scanItemSearchIdentity";
import type { InventoryItem } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/scanItemSearchIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/more/scan-item.tsx", import.meta.url),
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

test("MISE-005KB pins Scan Item text-search normalize to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005KB/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeScanItemSearchToken("),
    domainSource.indexOf("export function scanItemMatchesQuery(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(screenSource, /scanItemMatchesQuery/);
  assert.doesNotMatch(screenSource, /function matchesQuery\(/);
  assert.doesNotMatch(screenSource, /\.toLowerCase\(\)/);
  assert.doesNotMatch(screenSource, /\.toLocaleLowerCase\(\)/);
});

test("ASCII C fold keeps ordinary Scan Item search tokens stable", () => {
  assert.equal(normalizeScanItemSearchToken("  Roma Tomato  "), "roma tomato");
  assert.equal(normalizeScanItemSearchToken("SYSCO"), "sysco");
  assert.equal(normalizeScanItemSearchToken(null), "");
  assert.equal(normalizeScanItemSearchToken(undefined), "");
  assert.equal(normalizeScanItemSearchToken(""), "");
  assert.equal(normalizeScanItemSearchToken("   "), "");

  const roma = item({ id: "item-roma", item_name: "Roma Tomato", category: "Produce" });
  assert.equal(scanItemMatchesQuery(roma, ""), true);
  assert.equal(scanItemMatchesQuery(roma, "   "), true);
  assert.equal(scanItemMatchesQuery(roma, "roma"), true);
  assert.equal(scanItemMatchesQuery(roma, "ROMA"), true);
  assert.equal(scanItemMatchesQuery(roma, "produce"), true);
  assert.equal(scanItemMatchesQuery(roma, "sysco"), true);
  assert.equal(scanItemMatchesQuery(roma, "basil"), false);
});

test("ASCII C fold does not invent Kelvin-sign Scan Item search identity", () => {
  // Unicode toLowerCase would fold K → k and invent "kelvin" / "kg" needles.
  assert.equal(normalizeScanItemSearchToken("Kelvin Peppers"), "Kelvin peppers");
  assert.notEqual(
    normalizeScanItemSearchToken("Kelvin Peppers"),
    normalizeScanItemSearchToken("Kelvin Peppers")
  );
  assert.equal(normalizeScanItemSearchToken("Kelvin Peppers"), "kelvin peppers");

  assert.equal(normalizeScanItemSearchToken("KG"), "Kg");
  assert.notEqual(normalizeScanItemSearchToken("KG"), normalizeScanItemSearchToken("KG"));
  assert.equal(normalizeScanItemSearchToken("KG"), "kg");

  const kelvinItem = item({
    id: "item-kelvin",
    item_name: "Kelvin Peppers",
    category: "Produce",
    supplier_name: "Kelvin Dairy"
  });
  const lookalikeItem = item({
    id: "item-lookalike",
    item_name: "Kelvin Peppers",
    category: "Produce",
    supplier_name: "Kelvin Dairy"
  });

  assert.equal(scanItemMatchesQuery(kelvinItem, "kelvin"), true);
  assert.equal(scanItemMatchesQuery(lookalikeItem, "kelvin"), false);
  assert.equal(scanItemMatchesQuery(kelvinItem, "Kelvin"), false);
  assert.equal(scanItemMatchesQuery(lookalikeItem, "Kelvin"), true);

  // Em space is outside ASCII whitespace trim; it must not collapse into a
  // matching space that invents substring identity across lookalike spellings.
  assert.equal(normalizeScanItemSearchToken("Bell\u2003Peppers"), "bell\u2003peppers");
  assert.notEqual(
    normalizeScanItemSearchToken("Bell\u2003Peppers"),
    normalizeScanItemSearchToken("Bell Peppers")
  );
  assert.equal(
    scanItemMatchesQuery(item({ id: "item-bell", item_name: "Bell Peppers" }), "Bell\u2003Peppers"),
    false
  );
});
