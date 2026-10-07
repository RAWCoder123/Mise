import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inventoryOutlookMatchesTypedSearchQuery,
  logDeliveryItemMatchesTypedSearchQuery,
  normalizeInventoryTypedSearchToken
} from "../services/domain/inventoryTypedSearchIdentity";
import type { InventoryItem } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/inventoryTypedSearchIdentity.ts", import.meta.url),
  "utf8"
);
const inventoryScreenSource = readFileSync(
  new URL("../app/(tabs)/inventory.tsx", import.meta.url),
  "utf8"
);
const logDeliveryScreenSource = readFileSync(
  new URL("../app/more/log-delivery.tsx", import.meta.url),
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

test("MISE-005KC pins Inventory and Log Delivery typed-search normalize to ASCII C", () => {
  assert.match(domainSource, /MISE-005KC/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeInventoryTypedSearchToken("),
    domainSource.indexOf("function haystackIncludesNeedle(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(inventoryScreenSource, /inventoryOutlookMatchesTypedSearchQuery/);
  assert.match(logDeliveryScreenSource, /logDeliveryItemMatchesTypedSearchQuery/);

  // Typed-search filters must not keep Unicode fold; categoryIcon display
  // heuristics may still use toLowerCase and are out of tip scope.
  const inventoryFilterBody = inventoryScreenSource.slice(
    inventoryScreenSource.indexOf("const filtered = useMemo(() => {"),
    inventoryScreenSource.indexOf("const showStockBrowser")
  );
  assert.doesNotMatch(inventoryFilterBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(inventoryFilterBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(inventoryFilterBody, /\.trim\(\)/);

  const logDeliveryFilterBody = logDeliveryScreenSource.slice(
    logDeliveryScreenSource.indexOf("const filtered = useMemo(() => {"),
    logDeliveryScreenSource.indexOf("function resetForm(")
  );
  assert.doesNotMatch(logDeliveryFilterBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(logDeliveryFilterBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(logDeliveryFilterBody, /\.trim\(\)/);
});

test("ASCII C fold keeps ordinary Inventory and Log Delivery search tokens stable", () => {
  assert.equal(normalizeInventoryTypedSearchToken("  Roma Tomato  "), "roma tomato");
  assert.equal(normalizeInventoryTypedSearchToken("SYSCO"), "sysco");
  assert.equal(normalizeInventoryTypedSearchToken(null), "");
  assert.equal(normalizeInventoryTypedSearchToken(undefined), "");
  assert.equal(normalizeInventoryTypedSearchToken(""), "");
  assert.equal(normalizeInventoryTypedSearchToken("   "), "");

  const roma = item({ id: "item-roma", item_name: "Roma Tomato", category: "Produce" });
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", ""), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "   "), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "roma"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "ROMA"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "produce"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "sysco"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "days"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(roma, "3 days left", "basil"), false);

  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, ""), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "   "), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "roma"), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "item-roma"), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "produce"), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "sysco"), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(roma, "basil"), false);
});

test("ASCII C fold does not invent Kelvin-sign Inventory or Log Delivery search identity", () => {
  // Unicode toLowerCase would fold K → k and invent "kelvin" needles.
  assert.equal(normalizeInventoryTypedSearchToken("Kelvin Peppers"), "Kelvin peppers");
  assert.notEqual(
    normalizeInventoryTypedSearchToken("Kelvin Peppers"),
    normalizeInventoryTypedSearchToken("Kelvin Peppers")
  );
  assert.equal(normalizeInventoryTypedSearchToken("Kelvin Peppers"), "kelvin peppers");

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

  assert.equal(inventoryOutlookMatchesTypedSearchQuery(kelvinItem, "2 days left", "kelvin"), true);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(lookalikeItem, "2 days left", "kelvin"), false);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(kelvinItem, "2 days left", "Kelvin"), false);
  assert.equal(inventoryOutlookMatchesTypedSearchQuery(lookalikeItem, "2 days left", "Kelvin"), true);

  assert.equal(logDeliveryItemMatchesTypedSearchQuery(kelvinItem, "kelvin"), true);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(lookalikeItem, "kelvin"), false);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(kelvinItem, "Kelvin"), false);
  assert.equal(logDeliveryItemMatchesTypedSearchQuery(lookalikeItem, "Kelvin"), true);

  // Em space is outside ASCII whitespace trim; it must not collapse into a
  // matching space that invents substring identity across lookalike spellings.
  assert.equal(normalizeInventoryTypedSearchToken("Bell\u2003Peppers"), "bell\u2003peppers");
  assert.notEqual(
    normalizeInventoryTypedSearchToken("Bell\u2003Peppers"),
    normalizeInventoryTypedSearchToken("Bell Peppers")
  );
  assert.equal(
    inventoryOutlookMatchesTypedSearchQuery(
      item({ id: "item-bell", item_name: "Bell Peppers" }),
      "ok",
      "Bell\u2003Peppers"
    ),
    false
  );
  assert.equal(
    logDeliveryItemMatchesTypedSearchQuery(
      item({ id: "item-bell-2", item_name: "Bell Peppers" }),
      "Bell\u2003Peppers"
    ),
    false
  );
});
