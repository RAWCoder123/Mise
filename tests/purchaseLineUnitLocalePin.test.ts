import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925220600_mise_005d_purchase_line_unit_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005D pins unit and pack helpers to COLLATE C without rewriting 004C", () => {
  assert.match(
    migration,
    /create or replace function private\.purchase_line_unit_dimension[\s\S]*lower\(p_unit collate "C"\) collate "C"/
  );
  assert.match(
    migration,
    /create or replace function private\.purchase_line_pack_unit[\s\S]*lower\(p_pack_size collate "C"\) collate "C"/
  );
  assert.match(
    migration,
    /create or replace function private\.purchase_line_pack_unit[\s\S]*'\(\[a-z\]\+\)\$'/
  );
  assert.match(migration, /revoke all on function private\.purchase_line_unit_dimension\(text\)/);
  assert.match(migration, /revoke all on function private\.purchase_line_pack_unit\(text\)/);
  assert.doesNotMatch(
    migration,
    /alter table public\.purchase_lines/,
    "consistency helpers are not restore keys; no ledger rewrite"
  );
  assert.match(
    foundation,
    /create or replace function private\.purchase_line_unit_dimension[\s\S]*lower\(p_unit\)/
  );
  assert.ok(
    migration.includes("MISE-005D"),
    "additive pin must stay labeled so audits can find the ctype fix"
  );
});
