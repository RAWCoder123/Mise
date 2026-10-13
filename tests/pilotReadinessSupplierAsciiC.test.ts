import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPilotReadinessSupplierToken,
  canonicalizePilotReadinessSupplierId,
  requireCanonicalPilotReadinessSupplierId
} from "../services/domain/pilotReadinessSupplierIdentity";
import { buildPilotReadiness } from "../services/domain/pilotReadiness";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosIntegration,
  PosSale,
  RestaurantEmailConnection,
  SupplierRecipient
} from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/pilotReadinessSupplierIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/pilotReadiness.ts", import.meta.url),
  "utf8"
);
const supplierReliabilitySource = readFileSync(
  new URL("../services/domain/supplierReliability.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-pilot";
const supplierId = "00000000-0000-4000-8000-000000000201";
const demoSupplierId = "supplier_pantry_co";
const now = "2026-08-14T12:00:00.000Z";

const integration: PosIntegration = {
  id: "pos-1",
  restaurant_id: restaurantId,
  provider: "square",
  status: "connected",
  external_location_id: "location-1",
  last_sync_at: "2026-08-14T11:00:00.000Z",
  sync_cursor: null,
  settings: {},
  created_at: now,
  updated_at: now
};

const count: InventoryEvent = {
  id: "count-1",
  sequence: 1,
  restaurantId,
  inventoryItemId: "inventory-1",
  eventType: "count",
  quantity: 20,
  canonicalUnit: "g",
  effectiveAt: "2026-08-14T10:00:00.000Z",
  recordedAt: now,
  actorUserId: "manager-1",
  source: "count_session",
  sourceReference: null,
  reasonCode: null,
  clientEventId: "count-client-1",
  idempotencyKey: "count-key-1",
  supersedesEventId: null,
  metadata: {}
};

const mapping: MenuItemIngredient = {
  id: "mapping-1",
  restaurant_id: restaurantId,
  menu_item_name: "Chicken Bowl",
  inventory_item_id: "inventory-1",
  quantity_used_per_sale: 200,
  unit: "g"
};

const email: RestaurantEmailConnection = {
  id: "gmail-1",
  restaurant_id: restaurantId,
  provider: "gmail",
  status: "connected",
  sender_email: "purchasing@restaurant.example",
  last_verified_at: now,
  created_at: now,
  updated_at: now
};

function inventory(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inventory-1",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_id: supplierId,
    supplier_name: "Fresh Foods",
    last_updated: now,
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: "verified",
    canonical_unit_verified_at: now,
    canonical_unit_verified_by: "manager-1",
    ...overrides
  };
}

function recipient(overrides: Partial<SupplierRecipient> = {}): SupplierRecipient {
  return {
    id: "recipient-1",
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Fresh Foods",
    email: "orders@fresh.example",
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

function sales(days = 7): PosSale[] {
  return Array.from({ length: days }, (_, index) => ({
    id: `sale-${index}`,
    restaurant_id: restaurantId,
    source_record_id: `square-${index}`,
    sale_date: `2026-08-${String(7 + index).padStart(2, "0")}`,
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: 10,
    gross_sales: 120,
    net_sales: 120,
    source_pos: "Test POS",
    created_at: now
  }));
}

function readiness(input: {
  inventoryItems: InventoryItem[];
  supplierRecipients: SupplierRecipient[];
}) {
  return buildPilotReadiness({
    restaurantId,
    generatedAt: now,
    posIntegrations: [integration],
    sales: sales(),
    inventoryItems: input.inventoryItems,
    countEvents: [{ ...count, inventoryItemId: input.inventoryItems[0]?.id ?? "inventory-1" }],
    recipeMappings: [mapping],
    supplierRecipients: input.supplierRecipients,
    emailConnection: email
  });
}

function area(readinessResult: ReturnType<typeof buildPilotReadiness>, id: string) {
  const match = readinessResult.areas.find((entry) => entry.id === id);
  assert.ok(match, `expected area ${id}`);
  return match;
}

test("MISE-005OR pins pilotReadiness supplier_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005OR/);
  assert.match(domainSource, /MISE-005OR/);

  assert.match(
    identitySource,
    /export function asciiTrimPilotReadinessSupplierToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /canonicalizePilotReadinessSupplierId\(item\.supplier_id\)/);
  assert.match(domainSource, /canonicalizePilotReadinessSupplierId\(recipient\.supplier_id\)/);
  assert.match(domainSource, /from "\.\/pilotReadinessSupplierIdentity"/);
  assert.doesNotMatch(domainSource, /item\.supplier_id\.trim\(\)/);
  assert.doesNotMatch(domainSource, /recipient\.supplier_id\.trim\(\)/);

  // Leave restaurant workspace and email presentation on Unicode trim in this tip.
  assert.match(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.match(domainSource, /recipient\.email\?\.trim\(\)/);
  assert.match(domainSource, /connection\.sender_email\?\.trim\(\)/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /supplierReliabilitySupplierIdentity/);
  assert.doesNotMatch(identitySource, /orderAutomationSupplierIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /requireSupplierAuthorityId/);
  assert.doesNotMatch(identitySource, /demoSupplierIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)PilotReadinessRestaurant/
  );

  // Open tip #825 owns supplierReliability supplier_id; do not rewrite that module.
  assert.doesNotMatch(supplierReliabilitySource, /canonicalizePilotReadinessSupplierId/);
  assert.doesNotMatch(supplierReliabilitySource, /MISE-005OR/);
});

test("ASCII trim keeps ordinary pilot-readiness supplier padding stable", () => {
  assert.equal(asciiTrimPilotReadinessSupplierToken(`  ${supplierId}  `), supplierId);
  assert.equal(canonicalizePilotReadinessSupplierId(`\t${supplierId}\n`), supplierId);
  assert.equal(requireCanonicalPilotReadinessSupplierId(` ${supplierId} `), supplierId);

  assert.equal(asciiTrimPilotReadinessSupplierToken(`  ${demoSupplierId}  `), demoSupplierId);
  assert.equal(canonicalizePilotReadinessSupplierId(`\t${demoSupplierId}\n`), demoSupplierId);
  assert.equal(requireCanonicalPilotReadinessSupplierId(` ${demoSupplierId} `), demoSupplierId);

  const result = readiness({
    inventoryItems: [inventory({ supplier_id: `  ${supplierId}  ` })],
    supplierRecipients: [recipient({ supplier_id: `  ${supplierId}  ` })]
  });
  assert.equal(area(result, "supplier_routing").status, "ready");
  assert.equal(area(result, "supplier_routing").metrics.suppliers, 1);
  assert.equal(area(result, "email_delivery").status, "ready");
  assert.equal(area(result, "email_delivery").metrics.missingRecipients, 0);
});

test("ASCII pilot-readiness supplier trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${supplierId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded supplier id.
  assert.equal(nbspPadded.trim(), supplierId);
  assert.notEqual(asciiTrimPilotReadinessSupplierToken(nbspPadded), supplierId);
  assert.equal(canonicalizePilotReadinessSupplierId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalPilotReadinessSupplierId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Pilot readiness requires a supplier id."
  );

  // Fail closed into missing-supplier: padded inventory supplier is treated as
  // absent rather than inventing a clean Set key / clearing the blocker.
  const inventedAlone = readiness({
    inventoryItems: [inventory({ supplier_id: nbspPadded })],
    supplierRecipients: [recipient({ supplier_id: supplierId })]
  });
  assert.equal(area(inventedAlone, "supplier_routing").status, "blocked");
  assert.equal(area(inventedAlone, "supplier_routing").metrics.suppliers, 0);
  assert.match(
    area(inventedAlone, "supplier_routing").blockers.join(" "),
    /1 inventory items have no supplier/
  );

  const emSpacePadded = `\u2003${demoSupplierId}\u2003`;
  assert.equal(emSpacePadded.trim(), demoSupplierId);
  assert.equal(canonicalizePilotReadinessSupplierId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalPilotReadinessSupplierId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Pilot readiness requires a supplier id."
  );

  // Clean inventory supplier + NBSP-padded recipient must not invent a match.
  const mismatchedRecipient = readiness({
    inventoryItems: [inventory({ supplier_id: supplierId })],
    supplierRecipients: [recipient({ supplier_id: nbspPadded })]
  });
  assert.equal(area(mismatchedRecipient, "supplier_routing").status, "ready");
  assert.equal(area(mismatchedRecipient, "supplier_routing").metrics.suppliers, 1);
  assert.equal(area(mismatchedRecipient, "supplier_routing").metrics.configuredRecipients, 0);
  assert.equal(area(mismatchedRecipient, "supplier_routing").metrics.missingRecipients, 1);
  assert.equal(area(mismatchedRecipient, "email_delivery").status, "blocked");
  assert.equal(area(mismatchedRecipient, "email_delivery").metrics.missingRecipients, 1);
  assert.equal(mismatchedRecipient.canDraft, true);
  assert.equal(mismatchedRecipient.canSend, false);

  // Clean + padded inventory siblings must not collapse into one supplier Set key.
  const mixedItems = readiness({
    inventoryItems: [
      inventory({ id: "inventory-clean", supplier_id: supplierId }),
      inventory({ id: "inventory-padded", supplier_id: nbspPadded, item_name: "Padded" })
    ],
    supplierRecipients: [recipient({ supplier_id: supplierId })]
  });
  assert.equal(area(mixedItems, "supplier_routing").status, "blocked");
  assert.equal(area(mixedItems, "supplier_routing").metrics.suppliers, 1);
  assert.match(
    area(mixedItems, "supplier_routing").blockers.join(" "),
    /1 inventory items have no supplier/
  );
});

test("ASCII pilot-readiness supplier canonicalize fails closed on empty and control identities", () => {
  assert.equal(canonicalizePilotReadinessSupplierId(""), null);
  assert.equal(canonicalizePilotReadinessSupplierId("   "), null);
  assert.equal(canonicalizePilotReadinessSupplierId("bad\u0000id"), null);
  assert.equal(canonicalizePilotReadinessSupplierId("x".repeat(129)), null);

  assert.throws(
    () => requireCanonicalPilotReadinessSupplierId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Pilot readiness requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalPilotReadinessSupplierId(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Pilot readiness requires a supplier id."
  );
  assert.throws(
    () => requireCanonicalPilotReadinessSupplierId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Pilot readiness requires a supplier id."
  );

  const empty = readiness({
    inventoryItems: [inventory({ supplier_id: "" })],
    supplierRecipients: [recipient({ supplier_id: supplierId })]
  });
  assert.equal(area(empty, "supplier_routing").status, "blocked");
  assert.equal(area(empty, "supplier_routing").metrics.suppliers, 0);

  const control = readiness({
    inventoryItems: [inventory({ supplier_id: "bad\u0000id" })],
    supplierRecipients: [recipient({ supplier_id: supplierId })]
  });
  assert.equal(area(control, "supplier_routing").status, "blocked");
  assert.equal(area(control, "supplier_routing").metrics.suppliers, 0);
});
