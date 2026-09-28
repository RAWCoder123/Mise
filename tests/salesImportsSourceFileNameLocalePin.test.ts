import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928130000_mise_005bn_sales_imports_source_file_name_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const squareSync = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const authoritySync = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/sales_imports_source_file_name_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005BN pins sales_imports.source_file_name cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BN"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint sales_imports_source_file_name_check check \(/i
  );
  assert.match(
    migration,
    /source_file_name collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(trim\(source_file_name\)\) between 1 and 260/
  );
  assert.match(migration, /source_file_name is null/);

  // Compose: CHECK-only. Do not rewrite Square sync writers, contested
  // Manual CSV import (#265), sync_cursor (#473), or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_apply_square_sync_result/i);
  assert.doesNotMatch(sqlBody, /import_manual_pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  // Do not accidentally reattach sibling metadata secret-key CHECK.
  assert.doesNotMatch(sqlBody, /public_metadata_no_secret_keys/i);
});

test("original sales_imports.source_file_name had no shape CHECK", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.sales_imports \([\s\S]*?source_file_name text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /sales_imports_source_file_name_check/
  );
  assert.doesNotMatch(
    originalFoundation,
    /source_file_name collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("Square sync writers leave source_file_name unset (NULL) today", () => {
  assert.match(
    squareSync,
    /insert into public\.sales_imports \(\s*id, restaurant_id, pos_integration_id, import_type, status,\s*records_processed/
  );
  assert.doesNotMatch(
    squareSync,
    /insert into public\.sales_imports \([\s\S]*?source_file_name/
  );
  assert.match(
    authoritySync,
    /insert into public\.sales_imports \(\s*id, restaurant_id, pos_integration_id, import_type, status,\s*records_processed/
  );
  assert.doesNotMatch(
    authoritySync,
    /insert into public\.sales_imports \([\s\S]*?source_file_name/
  );
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedSourceFileName = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 260 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedSourceFileName(null), true);
  assert.equal(isAllowedSourceFileName("square-sales-2026-09-28.csv"), true);
  assert.equal(isAllowedSourceFileName("a".repeat(260)), true);
  assert.equal(isAllowedSourceFileName("a".repeat(261)), false);
  assert.equal(isAllowedSourceFileName(""), false);
  assert.equal(isAllowedSourceFileName("   "), false);
  assert.equal(isAllowedSourceFileName("sales\tweek.csv"), false);
  assert.equal(isAllowedSourceFileName("sales\u007fweek.csv"), false);
  assert.equal(isAllowedSourceFileName("sales\nweek.csv"), false);
});

test("pgTAP fixture pins sales_imports.source_file_name CHECK site", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /sales_imports_source_file_name_check exists/);
  assert.match(pgTap, /sales_imports\.source_file_name CHECK allows NULL/);
  assert.match(
    pgTap,
    /sales_imports\.source_file_name CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /sales_imports\.source_file_name CHECK preserves length\(trim\) 1–260 bound/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII source file name is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /max-length printable ASCII source file name is not a control under COLLATE C/
  );
});
