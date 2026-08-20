import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  resolveVerifiedProviderMenuItemId,
  saleMatchesRecipe,
  saleRequiresVerifiedProviderIdentity,
  type VerifiedProviderSaleMapping
} from "../services/domain/providerSaleIdentity";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantA = "restaurant-a";
const restaurantB = "restaurant-b";
const chickenMenuId = "menu-chicken";
const chickenItemId = "inventory-chicken";
const operatingDate = "2026-08-18";

const inventoryItem: InventoryItem = {
  id: chickenItemId,
  restaurant_id: restaurantA,
  item_name: "Chicken",
  category: "Protein",
  unit: "each",
  current_quantity: 20,
  par_level: 30,
  reorder_threshold: 10,
  estimated_unit_cost: 1,
  supplier_name: "Supplier",
  last_updated: "2026-08-18T00:00:00.000Z"
};

const recipe: MenuItemIngredient = {
  id: "recipe-chicken",
  restaurant_id: restaurantA,
  menu_item_id: chickenMenuId,
  menu_item_name: "Chicken Sandwich",
  inventory_item_id: chickenItemId,
  quantity_used_per_sale: 1,
  unit: "each"
};

function squareSale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: "sale-1",
    restaurant_id: restaurantA,
    source_record_id: "square-order-line-1",
    provider_catalog_item_id: "ITEM-A",
    provider_variation_id: "VAR-A",
    provider_location_id: "loc-a",
    sale_date: operatingDate,
    item_name: "Chicken Sandwich",
    category: "Square",
    quantity_sold: 2,
    gross_sales: 20,
    net_sales: 20,
    source_pos: "Square",
    created_at: "2026-08-18T12:00:00.000Z",
    ...overrides
  };
}

const verifiedMappings: VerifiedProviderSaleMapping[] = [{
  restaurantId: restaurantA,
  sourcePos: "square",
  providerLocationId: "loc-a",
  externalCatalogItemId: "ITEM-A",
  externalVariationId: "VAR-A",
  menuItemId: chickenMenuId
}];

const locationBMappings: VerifiedProviderSaleMapping[] = [{
  restaurantId: restaurantA,
  sourcePos: "square",
  providerLocationId: "loc-b",
  externalCatalogItemId: "ITEM-A",
  externalVariationId: "VAR-A",
  menuItemId: "menu-rice"
}];

const conflictingMappings: VerifiedProviderSaleMapping[] = [
  {
    restaurantId: restaurantA,
    sourcePos: "square",
    providerLocationId: "loc-a",
    externalCatalogItemId: "ITEM-A",
    externalVariationId: "VAR-A",
    menuItemId: chickenMenuId
  },
  {
    restaurantId: restaurantA,
    sourcePos: "square",
    providerLocationId: "loc-a",
    externalCatalogItemId: "ITEM-A",
    externalVariationId: "VAR-A",
    menuItemId: "menu-soup"
  }
];

function depletion(sales: PosSale[], mappings = verifiedMappings) {
  return buildInventoryPrediction(inventoryItem, sales, [recipe], operatingDate, undefined, undefined, undefined, mappings)
    .todayDepletion;
}

test("verified Square variation identity resolves through the menu UUID into recipe consumption", () => {
  assert.equal(resolveVerifiedProviderMenuItemId(squareSale(), verifiedMappings), chickenMenuId);
  assert.equal(depletion([squareSale()]), 2);
});

test("verified Square identity remains tied to its provider location and survives display-name rename", () => {
  const renamed = squareSale({
    item_name: "Renamed Chicken Sandwich",
    provider_location_id: "loc-a"
  });
  assert.equal(resolveVerifiedProviderMenuItemId(renamed, verifiedMappings), chickenMenuId);
  assert.equal(saleMatchesRecipe(renamed, recipe, verifiedMappings), true);
  assert.equal(resolveVerifiedProviderMenuItemId(squareSale({ provider_location_id: "loc-b" }), verifiedMappings), null);
  assert.equal(resolveVerifiedProviderMenuItemId(squareSale({ provider_location_id: "loc-b" }), locationBMappings), "menu-rice");
});

test("ambiguous verified mappings for the same identity fail closed regardless of array order", () => {
  const sale = squareSale();
  assert.equal(resolveVerifiedProviderMenuItemId(sale, conflictingMappings), null);
  assert.equal(resolveVerifiedProviderMenuItemId(sale, [...conflictingMappings].reverse()), null);
});

test("different locations remain independent for verified provider mappings", () => {
  const locB = squareSale({ provider_location_id: "loc-b" });
  const locA = squareSale({ provider_location_id: "loc-a" });
  assert.equal(resolveVerifiedProviderMenuItemId(locB, locationBMappings), "menu-rice");
  assert.equal(resolveVerifiedProviderMenuItemId(locA, locationBMappings), null);
});

test("same display name with the wrong variation ID cannot consume the verified recipe", () => {
  assert.equal(depletion([squareSale({ provider_variation_id: "VAR-B" })]), 0);
  assert.equal(depletion([squareSale({ item_name: "Renamed Chicken Sandwich" })]), 2);
});

test("draft, missing, and unknown provider mappings fail closed while preserving the sale shape", () => {
  const draftOnly: VerifiedProviderSaleMapping[] = [];
  const draftSale = squareSale({ provider_variation_id: "VAR-DRAFT" });
  const unknownSale = squareSale({ provider_variation_id: "VAR-UNKNOWN" });
  assert.equal(depletion([draftSale], draftOnly), 0);
  assert.equal(depletion([unknownSale]), 0);
  assert.equal(draftSale.source_record_id, "square-order-line-1");
});

test("tenant-scoped provider mappings cannot resolve another restaurant's sale", () => {
  const foreignSale = squareSale({ restaurant_id: restaurantB });
  assert.equal(resolveVerifiedProviderMenuItemId(foreignSale, verifiedMappings), null);
  assert.equal(saleMatchesRecipe(foreignSale, recipe, verifiedMappings), false);
});

test("a manual name match remains manual-only and never authorizes an unmapped Square sale", () => {
  const manualSale = squareSale({
    source_pos: "Manual CSV",
    provider_catalog_item_id: null,
    provider_variation_id: null,
    provider_location_id: null
  });
  assert.equal(saleMatchesRecipe(manualSale, recipe, []), true);
  assert.equal(saleMatchesRecipe(squareSale({ provider_variation_id: "VAR-NO-MAPPING" }), recipe, []), false);
});

test("provider location evidence alone requires verified provider identity and fails closed", () => {
  const malformedProviderSale = squareSale({
    source_pos: "unknown",
    provider_location_id: "loc-a",
    provider_catalog_item_id: null,
    provider_variation_id: null
  });
  assert.equal(saleRequiresVerifiedProviderIdentity(malformedProviderSale), true);
  assert.equal(saleMatchesRecipe(malformedProviderSale, recipe, []), false);
});

test("a true manual sale without provider evidence can still match a recipe by name", () => {
  const manualSale = squareSale({
    source_pos: "",
    provider_location_id: null,
    provider_catalog_item_id: null,
    provider_variation_id: null
  });
  assert.equal(saleRequiresVerifiedProviderIdentity(manualSale), false);
  assert.equal(saleMatchesRecipe(manualSale, recipe, []), true);
});
