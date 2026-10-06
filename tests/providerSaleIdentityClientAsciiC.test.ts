import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  recipeDemandKey,
  resolveVerifiedProviderMenuItemId,
  saleDemandKey,
  saleMatchesRecipe,
  saleRequiresVerifiedProviderIdentity,
  type VerifiedProviderSaleMapping
} from "../services/domain/providerSaleIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/providerSaleIdentity.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant-a";
const chickenMenuId = "menu-chicken";

const verifiedMappings: VerifiedProviderSaleMapping[] = [
  {
    restaurantId,
    sourcePos: "square",
    providerLocationId: "loc-a",
    externalCatalogItemId: "ITEM-A",
    externalVariationId: "VAR-A",
    menuItemId: chickenMenuId
  }
];

test("MISE-005JC pins providerSaleIdentity normalize to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JC/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("function normalize("),
    domainSource.length
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s\+/);
});

test("ASCII C fold keeps Square source_pos and location identity stable", () => {
  assert.equal(
    saleRequiresVerifiedProviderIdentity({ source_pos: "SQUARE" }),
    true
  );
  assert.equal(
    saleRequiresVerifiedProviderIdentity({ source_pos: "  Square  " }),
    true
  );
  // Kelvin-sign SQUARE must not become provider source "square".
  assert.equal(
    saleRequiresVerifiedProviderIdentity({ source_pos: "KQUARE" }),
    false
  );

  const mapped = resolveVerifiedProviderMenuItemId(
    {
      restaurant_id: restaurantId,
      item_name: "Ignored When Mapped",
      source_pos: "SQUARE",
      provider_location_id: " LOC-A ",
      provider_catalog_item_id: "ITEM-A",
      provider_variation_id: "VAR-A"
    },
    verifiedMappings
  );
  assert.equal(mapped, chickenMenuId);

  const kelvinLocation = resolveVerifiedProviderMenuItemId(
    {
      restaurant_id: restaurantId,
      item_name: "Ignored When Mapped",
      source_pos: "square",
      provider_location_id: "KOC-A",
      provider_catalog_item_id: "ITEM-A",
      provider_variation_id: "VAR-A"
    },
    verifiedMappings
  );
  assert.equal(kelvinLocation, null);
});

test("manual name matching stays ASCII C and does not invent Unicode folds", () => {
  const recipe = {
    restaurant_id: restaurantId,
    menu_item_name: "Chicken Sandwich",
    menu_item_id: chickenMenuId
  };

  assert.equal(
    saleMatchesRecipe(
      {
        restaurant_id: restaurantId,
        item_name: "  CHICKEN SANDWICH  ",
        source_pos: "manual"
      },
      recipe,
      []
    ),
    true
  );

  // Unicode toLowerCase would fold K → k and falsely match "chicken".
  assert.equal(
    saleMatchesRecipe(
      {
        restaurant_id: restaurantId,
        item_name: "Khicken Sandwich",
        source_pos: "manual"
      },
      { ...recipe, menu_item_name: "chicken Sandwich", menu_item_id: null },
      []
    ),
    false
  );

  assert.equal(recipeDemandKey({ menu_item_name: "  CHICKEN  " }), "chicken");
  assert.equal(
    saleDemandKey(
      {
        restaurant_id: restaurantId,
        item_name: "  CHICKEN SANDWICH  ",
        source_pos: "manual"
      },
      []
    ),
    "chicken sandwich"
  );
});
