import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPilotReadinessSaleItemName,
  canonicalizePilotReadinessSaleItemName,
  normalizePilotReadinessSaleItemName
} from "../services/domain/pilotReadinessSaleItemIdentity";
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
  new URL("../services/domain/pilotReadinessSaleItemIdentity.ts", import.meta.url),
  "utf8"
);
const readinessSource = readFileSync(
  new URL("../services/domain/pilotReadiness.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-pilot";
const supplierId = "00000000-0000-4000-8000-000000000201";
const now = "2026-08-14T12:00:00.000Z";
const itemName = "Wings";
const mappedItemName = "Chicken Bowl";

const integration: PosIntegration = {
  id: "pos-1", restaurant_id: restaurantId, provider: "square", status: "connected",
  external_location_id: "location-1", last_sync_at: "2026-08-14T11:00:00.000Z",
  sync_cursor: null, settings: {}, created_at: now, updated_at: now
};
const inventory: InventoryItem = {
  id: "inventory-1", restaurant_id: restaurantId, item_name: "Chicken", category: "Protein",
  unit: "lb", current_quantity: 20, par_level: 30, reorder_threshold: 10,
  estimated_unit_cost: 4, supplier_id: supplierId, supplier_name: "Fresh Foods", last_updated: now,
  canonical_unit: "g", canonical_quantity_per_unit: 453.592,
  canonical_unit_verification_status: "verified", canonical_unit_verified_at: now,
  canonical_unit_verified_by: "manager-1"
};
const count: InventoryEvent = {
  id: "count-1", sequence: 1, restaurantId, inventoryItemId: inventory.id, eventType: "count",
  quantity: 20, canonicalUnit: "g", effectiveAt: "2026-08-14T10:00:00.000Z", recordedAt: now,
  actorUserId: "manager-1", source: "count_session", sourceReference: null, reasonCode: null,
  clientEventId: "count-client-1", idempotencyKey: "count-key-1", supersedesEventId: null, metadata: {}
};
const mapping: MenuItemIngredient = {
  id: "mapping-1", restaurant_id: restaurantId, menu_item_name: mappedItemName,
  inventory_item_id: inventory.id, quantity_used_per_sale: 200, unit: "g"
};
const recipient: SupplierRecipient = {
  id: "recipient-1", restaurant_id: restaurantId, supplier_id: supplierId,
  supplier_name: "Fresh Foods",
  email: "orders@fresh.example", created_at: now, updated_at: now
};
const email: RestaurantEmailConnection = {
  id: "gmail-1", restaurant_id: restaurantId, provider: "gmail", status: "connected",
  sender_email: "purchasing@restaurant.example", last_verified_at: now, created_at: now, updated_at: now
};

function mappedSales(days = 7): PosSale[] {
  return Array.from({ length: days }, (_, index) => ({
    id: `sale-${index}`, restaurant_id: restaurantId, source_record_id: `square-${index}`,
    sale_date: `2026-08-${String(7 + index).padStart(2, "0")}`, item_name: mappedItemName,
    category: "Entree", quantity_sold: 10, gross_sales: 120, net_sales: 120,
    source_pos: "Test POS", created_at: now
  }));
}

function readyInput(sales: PosSale[]) {
  return {
    restaurantId,
    generatedAt: now,
    posIntegrations: [integration],
    sales,
    inventoryItems: [inventory],
    countEvents: [count],
    recipeMappings: [mapping],
    supplierRecipients: [recipient],
    emailConnection: email
  };
}

function recipeBlockers(sales: PosSale[]) {
  return buildPilotReadiness(readyInput(sales)).areas.find((area) => area.id === "recipe_coverage")?.blockers ?? [];
}

test("MISE-005QO pins pilot readiness missing-recipe sale item names to ASCII C", () => {
  assert.match(identitySource, /MISE-005QO/);
  assert.match(readinessSource, /MISE-005QO/);

  assert.match(
    identitySource,
    /export function asciiTrimPilotReadinessSaleItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(readinessSource, /normalizePilotReadinessSaleItemName\(sale\.item_name\)/);
  assert.match(readinessSource, /from "\.\/pilotReadinessSaleItemIdentity"/);

  // Leave restaurant workspace and supplier_id Unicode trim on existing contracts.
  assert.match(
    readinessSource,
    /const restaurantId = input\.restaurantId\.trim\(\);/
  );
  assert.match(
    readinessSource,
    /item\.supplier_id\.trim\(\)/
  );

  // Do not rewrite sibling pilot-readiness / Insights / setup POS tips.
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessSupplierIdentity/);
  assert.doesNotMatch(identitySource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupPosItemLabelIdentity/);
  assert.doesNotMatch(readinessSource, /insightsSalesLabelIdentity/);
  assert.doesNotMatch(readinessSource, /setupPosItemLabelIdentity/);
});

test("ASCII trim keeps ordinary missing-recipe sale item padding stable", () => {
  assert.equal(asciiTrimPilotReadinessSaleItemName(`  ${itemName}  `), itemName);
  assert.equal(canonicalizePilotReadinessSaleItemName(`\t${itemName}\n`), itemName);
  assert.equal(normalizePilotReadinessSaleItemName(`  ${itemName}  `), itemName);

  const blockers = recipeBlockers([
    ...mappedSales(),
    {
      id: "sale-unmapped-padded",
      restaurant_id: restaurantId,
      source_record_id: "square-unmapped-padded",
      sale_date: "2026-08-14",
      item_name: `  ${itemName}  `,
      category: "Entree",
      quantity_sold: 100,
      gross_sales: 200,
      net_sales: 200,
      source_pos: "Test POS",
      created_at: now
    }
  ]);

  assert.ok(blockers.some((blocker) => blocker.includes(itemName)));
  assert.ok(!blockers.some((blocker) => blocker.includes(`  ${itemName}  `)));
});

test("NBSP and em-space padding cannot invent missing-recipe sale item Set keys", () => {
  const nbspItem = `\u00a0${itemName}\u00a0`;
  const emItem = `\u2003${itemName}\u2003`;

  assert.equal(nbspItem.trim(), itemName);
  assert.equal(emItem.trim(), itemName);

  assert.equal(canonicalizePilotReadinessSaleItemName(nbspItem), null);
  assert.equal(canonicalizePilotReadinessSaleItemName(emItem), null);
  assert.equal(normalizePilotReadinessSaleItemName(nbspItem), "");
  assert.equal(normalizePilotReadinessSaleItemName(emItem), "");

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizePilotReadinessSaleItemName("\u2003\u2003"), "");
  assert.equal(normalizePilotReadinessSaleItemName("\u00a0\u00a0"), "");

  const blockers = recipeBlockers([
    ...mappedSales(),
    {
      id: "sale-nbsp",
      restaurant_id: restaurantId,
      source_record_id: "square-nbsp",
      sale_date: "2026-08-14",
      item_name: nbspItem,
      category: "Entree",
      quantity_sold: 40,
      gross_sales: 80,
      net_sales: 80,
      source_pos: "Test POS",
      created_at: now
    },
    {
      id: "sale-em",
      restaurant_id: restaurantId,
      source_record_id: "square-em",
      sale_date: "2026-08-14",
      item_name: emItem,
      category: "Entree",
      quantity_sold: 40,
      gross_sales: 80,
      net_sales: 80,
      source_pos: "Test POS",
      created_at: now
    },
    {
      id: "sale-clean",
      restaurant_id: restaurantId,
      source_record_id: "square-clean",
      sale_date: "2026-08-14",
      item_name: itemName,
      category: "Entree",
      quantity_sold: 20,
      gross_sales: 40,
      net_sales: 40,
      source_pos: "Test POS",
      created_at: now
    }
  ]);

  // Unicode-padded names must not invent equality with the clean Set key.
  // Coverage still treats padded sales as unmapped; only the blocker Set key
  // refuses inventing trim. Clean name remains the sole named missing recipe.
  const missingNamed = blockers.filter((blocker) => blocker.startsWith("Missing recipe mapping for "));
  assert.equal(missingNamed.length, 1);
  assert.equal(missingNamed[0], `Missing recipe mapping for ${itemName}.`);
  assert.ok(!blockers.some((blocker) => blocker.includes(nbspItem) || blocker.includes(emItem)));
});

test("Control and non-string missing-recipe sale item names soft-fail without inventing", () => {
  assert.equal(normalizePilotReadinessSaleItemName(null), "");
  assert.equal(normalizePilotReadinessSaleItemName(undefined), "");
  assert.equal(normalizePilotReadinessSaleItemName(12), "");
  assert.equal(normalizePilotReadinessSaleItemName(`${itemName}\u0000`), "");
  assert.equal(canonicalizePilotReadinessSaleItemName(`${itemName}\u0007`), null);

  const blockers = recipeBlockers([
    ...mappedSales(),
    {
      id: "sale-control",
      restaurant_id: restaurantId,
      source_record_id: "square-control",
      sale_date: "2026-08-14",
      item_name: `${itemName}\u0000`,
      category: "Entree",
      quantity_sold: 100,
      gross_sales: 200,
      net_sales: 200,
      source_pos: "Test POS",
      created_at: now
    }
  ]);

  assert.ok(blockers.some((blocker) => /Recipe coverage is/.test(blocker)));
  assert.ok(!blockers.some((blocker) => blocker.includes(itemName)));
});
