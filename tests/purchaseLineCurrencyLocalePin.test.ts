import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927090000_mise_005al_purchase_line_currency_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_line_currency_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005AL pins purchase_lines currency shape CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_lines_currency_check check \(\s*currency is null\s*or currency collate "C" ~ '\^\[A-Z\]\{3\}\$'\s*\)/
  );

  // Compose: CHECK-only. Do not rewrite writers owned by open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function private\.append_purchase_line/i);
  assert.doesNotMatch(sqlBody, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(sqlBody, /create or replace function public\.supersede_purchase_line/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_source_document_reference_check/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_raw_item_description_check/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_unit_of_measure_check/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_pack_size_check/i);
  assert.doesNotMatch(sqlBody, /restaurants_currency_code_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
});

test("original purchase_lines currency CHECK was bare", () => {
  assert.match(
    originalLedger,
    /currency text check \(currency is null or currency ~ '\^\[A-Z\]\{3\}\$'\)/
  );
  assert.doesNotMatch(
    originalLedger,
    /currency collate "C" ~ '\^\[A-Z\]\{3\}\$'/
  );
});

test("pgTAP fixture pins purchase_lines currency shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /purchase_lines_currency_check exists/);
  assert.match(pgTap, /purchase_lines currency CHECK uses COLLATE C/);
  assert.match(pgTap, /purchase_lines currency CHECK preserves nullable currency/);
  assert.match(pgTap, /ASCII uppercase ISO code matches under COLLATE C/);
  assert.match(pgTap, /lowercase currency code is rejected under COLLATE C/);
  assert.match(pgTap, /digit inside currency code is rejected under COLLATE C/);
});
