import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeDemoSupplierDisplayName,
  demoSupplierNormalizedName
} from "../services/demo/demoSupplierIdentity";
import {
  normalizeSupplierDisplayName,
  normalizeSupplierName
} from "../services/domain/supplierNameNormalization";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925201400_mise_005b_supplier_name_locale_pin.sql",
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

test("MISE-005B pins supplier normalize functions to COLLATE C and accent fold", () => {
  assert.match(
    migration,
    /create or replace function private\.normalize_supplier_display_name[\s\S]*collate "C"[\s\S]*\[\[:space:\]\]\+/
  );
  assert.match(
    migration,
    /create or replace function private\.normalize_supplier_display_name[\s\S]*replace\(p_name, E'\\u00A0', ' '\)/
  );
  assert.match(
    migration,
    /create or replace function private\.normalize_supplier_name[\s\S]*fold_purchase_line_accents[\s\S]*collate "C"/
  );
  assert.match(
    migration,
    /display_name collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(migration, /drop constraint if exists suppliers_display_name_check/);
  assert.match(migration, /add constraint suppliers_display_name_check/);
  assert.ok(
    migration.indexOf("drop constraint if exists suppliers_display_name_check") <
      migration.indexOf("create or replace function private.normalize_supplier_display_name"),
    "CHECK must drop before functions change so backfill can rewrite rows"
  );
  assert.ok(
    migration.indexOf("update public.suppliers supplier") <
      migration.indexOf("add constraint suppliers_display_name_check"),
    "backfill must finish before CHECK is reattached"
  );
});

test("MISE-005B reuses the MISE-005A accent fold rather than inventing a second map", () => {
  assert.match(migration, /private\.fold_purchase_line_accents/);
  assert.match(purchaseLineMigration, /create or replace function private\.fold_purchase_line_accents/);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.fold_supplier/
  );
});

test("display normalize collapses C whitespace and NBSP without touching accents", () => {
  assert.equal(normalizeSupplierDisplayName("  Fresh\tPoultry  "), "Fresh Poultry");
  assert.equal(normalizeSupplierDisplayName("Café\u00a0Supply"), "Café Supply");
  assert.equal(normalizeSupplierDisplayName("\u00a0"), null);
  assert.equal(normalizeSupplierDisplayName("Jalapeño Foods"), "Jalapeño Foods");
  // Unicode em-space is not C [[:space:]]; leave it alone rather than pretend.
  assert.equal(normalizeSupplierDisplayName("A\u2003B"), "A\u2003B");
});

test("discovery key accent-folds then ASCII-lowercases like lower(... COLLATE C)", () => {
  assert.equal(normalizeSupplierName("Fresh Poultry Supply"), "fresh poultry supply");
  assert.equal(normalizeSupplierName("CAFÉ Supply"), "cafe supply");
  assert.equal(normalizeSupplierName("Jalapeño Foods"), "jalapeno foods");
  assert.equal(normalizeSupplierName("CRÈME FRAÎCHE CO"), "creme fraiche co");
  assert.equal(normalizeSupplierName("  Café\u00a0Supply  "), "cafe supply");
});

test("demo helpers reject controls and stay byte-aligned with domain normalize", () => {
  assert.equal(normalizeDemoSupplierDisplayName("Metro Produce"), "Metro Produce");
  assert.equal(demoSupplierNormalizedName("Metro Produce"), "metro produce");
  assert.equal(demoSupplierNormalizedName("CAFÉ"), "cafe");
  assert.throws(() => normalizeDemoSupplierDisplayName("Bad\nName"), /valid supplier name/);
  assert.throws(() => normalizeDemoSupplierDisplayName(""), /valid supplier name/);
});
