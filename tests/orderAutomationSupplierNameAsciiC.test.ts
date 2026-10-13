import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assessOrderAutomation } from "../services/domain/orderAutomation";
import {
  canonicalOrderAutomationSupplierName,
  canonicalizeOrderAutomationSupplierName,
  normalizeCanonicalOrderAutomationSupplierName,
  requireCanonicalOrderAutomationSupplierName
} from "../services/domain/orderAutomationSupplierNameIdentity";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/orderAutomationSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_automation";
const supplierId = "00000000-0000-4000-8000-000000000101";
const supplierName = "Fresh Produce Co.";
const accentedSupplierName = "Café Produce Co.";

function inventory(id: string): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id,
    category: "Produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 20,
    reorder_threshold: 5,
    estimated_unit_cost: 4,
    supplier_id: supplierId,
    supplier_name: supplierName,
    last_updated: "2026-07-26T12:00:00.000Z"
  };
}

function recommendation(
  id: string,
  itemId: string,
  quantity: number
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: restaurantId,
    inventory_item_id: itemId,
    item_name: itemId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    recommended_quantity: quantity,
    unit: "lb",
    reason: "Projected stock is below the reorder threshold.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-07-26T12:30:00.000Z"
  };
}

test("MISE-005OY pins orderAutomation supplierName to ASCII C display prep", () => {
  assert.match(identitySource, /MISE-005OY/);
  assert.match(domainSource, /MISE-005OY/);

  assert.match(identitySource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalOrderAutomationSupplierName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    domainSource,
    /canonicalizeOrderAutomationSupplierName\(input\.supplierName\)/
  );
  assert.match(domainSource, /from "\.\/orderAutomationSupplierNameIdentity"/);

  // Leave restaurant workspace and supplier identity on Unicode trim (open tips
  // #779 / #773 tip those separately).
  assert.match(domainSource, /const restaurantId = input\.restaurantId\.trim\(\);/);
  assert.match(domainSource, /const supplierId = input\.supplierId\.trim\(\);/);
  assert.doesNotMatch(domainSource, /input\.supplierName\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierDisplayNameIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilitySupplierIdentity/);
  assert.doesNotMatch(domainSource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(domainSource, /orderAutomationRestaurantIdentity/);
  assert.doesNotMatch(domainSource, /restaurantTasksRelatedSupplierNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierSettingsNameIdentity/);
  assert.doesNotMatch(domainSource, /supplierDisplayNameIdentity/);
});

test("ASCII C display prep keeps ordinary order-automation supplierName stable", () => {
  assert.equal(
    canonicalOrderAutomationSupplierName(`  ${supplierName}  `),
    supplierName
  );
  // Pure display prep still collapses C whitespace (TAB/NL); assessment soft
  // canonicalize keeps those characters when they are the only padding.
  assert.equal(
    canonicalOrderAutomationSupplierName(`\t${supplierName}\n`),
    supplierName
  );
  assert.equal(
    canonicalizeOrderAutomationSupplierName(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    normalizeCanonicalOrderAutomationSupplierName(`  ${supplierName}  `),
    supplierName
  );
  assert.equal(
    requireCanonicalOrderAutomationSupplierName(`  ${supplierName}  `),
    supplierName
  );

  assert.equal(canonicalOrderAutomationSupplierName(accentedSupplierName), accentedSupplierName);
  assert.equal(
    canonicalizeOrderAutomationSupplierName(accentedSupplierName),
    accentedSupplierName
  );

  const assessment = assessOrderAutomation({
    restaurantId,
    supplierId,
    supplierName: `  ${supplierName}  `,
    candidates: [recommendation("rec-1", "item-1", 10)],
    inventoryItems: [inventory("item-1")],
    recommendationHistory: []
  });
  assert.equal(assessment.supplierName, supplierName);
  assert.equal(assessment.supplierId, supplierId);
  assert.equal(assessment.restaurantId, restaurantId);
});

test("NBSP folds and em-space padding cannot invent order-automation supplierName", () => {
  const nbspName = `\u00a0${supplierName}\u00a0`;
  const emName = `\u2003${supplierName}\u2003`;
  const internalEm = `Fresh\u2003Produce Co.`;

  // Pasted NBSP is folded like MISE-005B / private.normalize_supplier_display_name.
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(canonicalOrderAutomationSupplierName(nbspName), supplierName);
  assert.equal(canonicalizeOrderAutomationSupplierName(nbspName), supplierName);
  assert.equal(normalizeCanonicalOrderAutomationSupplierName(nbspName), supplierName);
  assert.equal(
    assessOrderAutomation({
      restaurantId,
      supplierId,
      supplierName: nbspName,
      candidates: [],
      inventoryItems: [],
      recommendationHistory: []
    }).supplierName,
    supplierName
  );

  // Unicode em-space trim invents a clean display name; C display prep does not.
  assert.equal(emName.trim(), supplierName);
  assert.notEqual(canonicalOrderAutomationSupplierName(emName), supplierName);
  assert.equal(canonicalOrderAutomationSupplierName(emName), emName);
  assert.equal(canonicalizeOrderAutomationSupplierName(emName), emName);
  assert.equal(normalizeCanonicalOrderAutomationSupplierName(emName), emName);
  assert.equal(
    assessOrderAutomation({
      restaurantId,
      supplierId,
      supplierName: emName,
      candidates: [],
      inventoryItems: [],
      recommendationHistory: []
    }).supplierName,
    emName
  );

  assert.equal(canonicalOrderAutomationSupplierName(internalEm), internalEm);
  assert.notEqual(
    canonicalOrderAutomationSupplierName(internalEm),
    canonicalOrderAutomationSupplierName("Fresh Produce Co.")
  );

  // Kelvin is not folded to k; accents/case stay presentation-faithful.
  assert.equal(canonicalOrderAutomationSupplierName("Kelvin Foods"), "Kelvin Foods");
  assert.notEqual(
    canonicalOrderAutomationSupplierName("Kelvin Foods"),
    canonicalOrderAutomationSupplierName("Kelvin Foods")
  );
});

test("order-automation supplierName soft-empty stays empty and inventing/control/over-long fail closed", () => {
  assert.equal(canonicalizeOrderAutomationSupplierName(""), "");
  assert.equal(canonicalizeOrderAutomationSupplierName("   "), "");
  assert.equal(canonicalizeOrderAutomationSupplierName("\u00a0\u00a0"), "");
  assert.equal(canonicalizeOrderAutomationSupplierName("\u2003"), "");
  assert.equal(normalizeCanonicalOrderAutomationSupplierName(null), "");
  assert.equal(normalizeCanonicalOrderAutomationSupplierName(undefined), "");
  assert.equal(normalizeCanonicalOrderAutomationSupplierName(""), "");
  assert.equal(normalizeCanonicalOrderAutomationSupplierName("\u2003"), "");

  assert.equal(
    assessOrderAutomation({
      restaurantId,
      supplierId,
      supplierName: "\u2003",
      candidates: [],
      inventoryItems: [],
      recommendationHistory: []
    }).supplierName,
    ""
  );

  assert.throws(
    () => normalizeCanonicalOrderAutomationSupplierName(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
  assert.throws(
    () => normalizeCanonicalOrderAutomationSupplierName("Bad\u0000Name"),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
  // TAB is C whitespace for collapse, but remaining control chars in the raw
  // input still fail closed on the normalize helper (same control gate as #691 / #692).
  assert.throws(
    () => normalizeCanonicalOrderAutomationSupplierName("Fresh\tProduce Co."),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
  assert.throws(
    () => normalizeCanonicalOrderAutomationSupplierName("x".repeat(161)),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierName(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierName(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation supplier name is invalid."
  );
});
