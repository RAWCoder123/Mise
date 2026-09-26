import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveVerifiedProviderMenuItemId,
  saleDemandKey,
  saleRequiresVerifiedProviderIdentity,
  type VerifiedProviderSaleMapping
} from "../services/domain/providerSaleIdentity";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926032000_mise_005i_pos_provider_identity_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalPosIdentity = readFileSync(
  new URL(
    "../supabase/migrations/20260818140000_authoritative_pos_recipe_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/providerSaleIdentity.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_provider_identity_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const restaurantA = "restaurant-a";
const chickenMenuId = "menu-chicken";

const verifiedMappings: VerifiedProviderSaleMapping[] = [
  {
    restaurantId: restaurantA,
    sourcePos: "square",
    providerLocationId: "loc-a",
    externalCatalogItemId: "ITEM-A",
    externalVariationId: "VAR-A",
    menuItemId: chickenMenuId
  }
];

test("MISE-005I pins pos_sales provider-identity cntrl CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005I"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists pos_sales_provider_catalog_item_id_check/i
  );
  assert.match(
    migration,
    /drop constraint if exists pos_sales_provider_location_id_check/i
  );
  assert.match(
    migration,
    /drop constraint if exists pos_sales_provider_variation_id_check/i
  );
  assert.match(
    migration,
    /provider_catalog_item_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /provider_location_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /provider_variation_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  // Compose with open stacks: do not rewrite POS ingest wrappers.
  assert.doesNotMatch(
    migration,
    /create or replace function public\.(ingest|upsert|sync)_/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\./i
  );
});

test("MISE-002A originally left provider-identity cntrl CHECKs unpinned", () => {
  assert.match(
    originalPosIdentity,
    /provider_catalog_item_id !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    originalPosIdentity,
    /provider_location_id !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    originalPosIdentity,
    /provider_variation_id !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalPosIdentity,
    /provider_catalog_item_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("domain documents MISE-005I ASCII C [[:cntrl:]] parity for provider identity", () => {
  assert.match(domain, /MISE-005I/);
  assert.match(domain, /CONTROL_CHARACTERS = \/\[\\u0000-\\u001f\\u007f\]\/u/);
});

test("control-bearing provider identity tokens fail closed for recipe resolution", () => {
  const sale = {
    restaurant_id: restaurantA,
    item_name: "Chicken Sandwich",
    source_pos: "square",
    provider_location_id: "loc-a",
    provider_catalog_item_id: "ITEM-A",
    provider_variation_id: "VAR\u0001A"
  };

  assert.equal(saleRequiresVerifiedProviderIdentity(sale), true);
  assert.equal(resolveVerifiedProviderMenuItemId(sale, verifiedMappings), null);
  assert.equal(saleDemandKey(sale, verifiedMappings), null);
});

test("printable provider identity tokens still resolve verified mappings", () => {
  const sale = {
    restaurant_id: restaurantA,
    item_name: "Chicken Sandwich",
    source_pos: "square",
    provider_location_id: "loc-a",
    provider_catalog_item_id: "ITEM-A",
    provider_variation_id: "VAR-A"
  };

  assert.equal(resolveVerifiedProviderMenuItemId(sale, verifiedMappings), chickenMenuId);
  assert.equal(saleDemandKey(sale, verifiedMappings), `menu:${chickenMenuId}`);
});

test("pgTAP fixture pins the three provider-identity CHECK sites", () => {
  assert.match(pgTap, /select plan\(9\)/);
  assert.match(pgTap, /pos_sales_provider_catalog_item_id_check/);
  assert.match(pgTap, /pos_sales_provider_location_id_check/);
  assert.match(pgTap, /pos_sales_provider_variation_id_check/);
  assert.match(pgTap, /provider_catalog_item_id collate "C" !~/);
  assert.match(pgTap, /provider_location_id collate "C" !~/);
  assert.match(pgTap, /provider_variation_id collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
});
