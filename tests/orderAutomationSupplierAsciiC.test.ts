import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assessOrderAutomation } from "../services/domain/orderAutomation";
import {
  asciiTrimOrderAutomationSupplierToken,
  canonicalizeOrderAutomationSupplierId,
  requireCanonicalOrderAutomationSupplierId
} from "../services/domain/orderAutomationSupplierIdentity";
import type { InventoryItem, PurchaseRecommendation } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/orderAutomationSupplierIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/orderAutomation.ts", import.meta.url),
  "utf8"
);

const restaurantId = "rest_automation";
const supplierId = "00000000-0000-4000-8000-000000000101";
const demoSupplierId = "supplier_fresh_produce";
const supplierName = "Fresh Produce Co.";

test("MISE-005MQ pins orderAutomation supplierId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MQ/);
  assert.match(domainSource, /MISE-005MQ/);

  assert.match(
    identitySource,
    /export function asciiTrimOrderAutomationSupplierToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /canonicalizeOrderAutomationSupplierId\(input\.supplierId\) \?\? ""/
  );
  assert.match(
    domainSource,
    /from "\.\/orderAutomationSupplierIdentity"/
  );

  // Leave restaurant workspace and supplier presentation name on Unicode trim.
  assert.match(
    domainSource,
    /const restaurantId = input\.restaurantId\.trim\(\);/
  );
  assert.match(
    domainSource,
    /const supplierName = input\.supplierName\.trim\(\);/
  );
  assert.doesNotMatch(domainSource, /input\.supplierId\.trim\(\)/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsDomainObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryLedgerObjectIdentity/);
  assert.doesNotMatch(identitySource, /requireSupplierAuthorityId/);
  assert.doesNotMatch(identitySource, /demoSupplierIdentity/);
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)OrderAutomationRestaurant/
  );
});

test("ASCII trim keeps ordinary order-automation supplier padding stable", () => {
  assert.equal(asciiTrimOrderAutomationSupplierToken(`  ${supplierId}  `), supplierId);
  assert.equal(canonicalizeOrderAutomationSupplierId(`\t${supplierId}\n`), supplierId);
  assert.equal(requireCanonicalOrderAutomationSupplierId(` ${supplierId} `), supplierId);

  assert.equal(asciiTrimOrderAutomationSupplierToken(`  ${demoSupplierId}  `), demoSupplierId);
  assert.equal(canonicalizeOrderAutomationSupplierId(`\t${demoSupplierId}\n`), demoSupplierId);
  assert.equal(requireCanonicalOrderAutomationSupplierId(` ${demoSupplierId} `), demoSupplierId);
});

test("ASCII order-automation supplier trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedSupplier = `\u00a0${supplierId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier id.
  assert.equal(nbspPaddedSupplier.trim(), supplierId);
  assert.notEqual(asciiTrimOrderAutomationSupplierToken(nbspPaddedSupplier), supplierId);
  assert.equal(canonicalizeOrderAutomationSupplierId(nbspPaddedSupplier), null);
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId(nbspPaddedSupplier),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );

  const emSpacePaddedDemo = `\u2003${demoSupplierId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoSupplierId);
  assert.equal(canonicalizeOrderAutomationSupplierId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );
});

test("Order-automation supplier rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOrderAutomationSupplierId(""), null);
  assert.equal(canonicalizeOrderAutomationSupplierId("   "), null);
  assert.equal(canonicalizeOrderAutomationSupplierId("a".repeat(129)), null);
  assert.equal(canonicalizeOrderAutomationSupplierId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalOrderAutomationSupplierId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Order automation requires a supplier id."
  );
});

test("assessOrderAutomation fails closed on Unicode-padded supplierId instead of inventing a match", () => {
  const item: InventoryItem = {
    id: "inv_cabbage",
    restaurant_id: restaurantId,
    item_name: "Cabbage",
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
  const candidate: PurchaseRecommendation = {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: supplierId,
    supplier_name: supplierName,
    recommended_quantity: 10,
    unit: "lb",
    reason: "Projected stock is below the reorder threshold.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-07-26T12:30:00.000Z"
  };

  const invented = assessOrderAutomation({
    restaurantId,
    supplierId: `\u00a0${supplierId}\u00a0`,
    supplierName,
    candidates: [candidate],
    inventoryItems: [item],
    recommendationHistory: [],
    policy: {
      enabled: true,
      allowAutomaticSend: false,
      maximumOrderValue: 500,
      maximumLineValue: 250,
      maximumInventoryAgeHours: 24,
      maximumRecommendationAgeHours: 24,
      minimumHistoricalApprovals: 3,
      maximumQuantityVarianceRatio: 0.25,
      historyLookbackDays: 180
    },
    now: new Date("2026-07-26T16:00:00.000Z")
  });

  assert.equal(invented.supplierId, "");
  assert.ok(invented.blockers.includes("supplier_mismatch"));
  assert.equal(invented.decision, "manual_review");
  assert.ok(invented.lines[0]?.blockers.includes("supplier_mismatch"));
});
