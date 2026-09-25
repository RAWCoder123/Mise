import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeMenuItemName } from "../services/domain/menuItemNameNormalization";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925210000_mise_005c_menu_item_name_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const purchaseLineMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005C pins menu item normalize to COLLATE C with accent fold", () => {
  assert.match(
    migration,
    /create or replace function private\.normalize_menu_item_name[\s\S]*fold_purchase_line_accents[\s\S]*collate "C"/
  );
  assert.match(
    migration,
    /create unique index menu_items_restaurant_normalized_name_key[\s\S]*private\.normalize_menu_item_name\(name\)/
  );
  assert.match(migration, /drop index if exists public\.menu_items_restaurant_normalized_name_key/);
  assert.ok(
    migration.indexOf("drop index if exists public.menu_items_restaurant_normalized_name_key") <
      migration.indexOf("update public.menu_items item"),
    "old ctype index must drop before collision backfill rewrites names"
  );
  assert.ok(
    migration.indexOf("update public.menu_items item") <
      migration.indexOf("create unique index menu_items_restaurant_normalized_name_key"),
    "collision backfill must finish before the locale-stable unique index is attached"
  );
});

test("MISE-005C reuses the MISE-005A accent fold rather than inventing a second map", () => {
  assert.match(migration, /private\.fold_purchase_line_accents/);
  assert.match(purchaseLineMigration, /create or replace function private\.fold_purchase_line_accents/);
  assert.doesNotMatch(migration, /create or replace function private\.fold_menu/);
});

test("MISE-005C retargets recipe identity and Square catalog lookup to the pinned key", () => {
  assert.match(
    migration,
    /create or replace function private\.assign_recipe_menu_item_identity[\s\S]*private\.normalize_menu_item_name/
  );
  assert.match(
    migration,
    /create or replace function private\.service_apply_square_sync_result_mise_003a_base[\s\S]*private\.normalize_menu_item_name\(item\.name\) = catalog_name_key/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_apply_square_sync_result_mise_003a_base[\s\S]*lower\(trim\(item\.name\)\) = lower\(trim\(catalog_external_name\)\)/
  );
});

test("normalizeMenuItemName accent-folds then ASCII-lowercases like lower(... COLLATE C)", () => {
  assert.equal(normalizeMenuItemName("  Margherita Pizza  "), "margherita pizza");
  assert.equal(normalizeMenuItemName("CAFÉ LATTE"), "cafe latte");
  assert.equal(normalizeMenuItemName("Café Latte"), "cafe latte");
  assert.equal(normalizeMenuItemName("Cafe Latte"), "cafe latte");
  assert.equal(normalizeMenuItemName("Jalapeño Burger"), "jalapeno burger");
  assert.equal(normalizeMenuItemName("JALAPEÑO BURGER"), "jalapeno burger");
  assert.equal(normalizeMenuItemName("CRÈME BRÛLÉE"), "creme brulee");
  assert.equal(normalizeMenuItemName("   "), null);
  assert.equal(normalizeMenuItemName(""), null);
  // Unicode em-space is not default btrim space; leave it alone rather than pretend.
  assert.equal(normalizeMenuItemName("A\u2003B"), "a\u2003b");
});
