import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930180000_mise_005dd_sales_imports_import_type_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/sales_imports_import_type_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DD pins sales_imports import_type and status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DD"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint sales_imports_import_type_check\s+check \(\s*import_type in \('pos_sync', 'csv_upload', 'manual_adjustment'\)\s*and import_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint sales_imports_status_check\s+check \(\s*status in \('queued', 'processing', 'completed', 'failed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`import_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "import_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'pos_sync'") &&
      migration.includes("'csv_upload'") &&
      migration.includes("'manual_adjustment'") &&
      migration.includes("'queued'") &&
      migration.includes("'processing'") &&
      migration.includes("'completed'") &&
      migration.includes("'failed'"),
    "exact import_type and status allowlists must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /source_file_name/i);
  assert.doesNotMatch(sqlBody, /records_processed/i);
  assert.doesNotMatch(sqlBody, /error_message/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /\bmetadata\b/);
});

test("original sales_imports import_type and status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.sales_imports[\s\S]*?import_type text not null check \(import_type in \('pos_sync', 'csv_upload', 'manual_adjustment'\)\)[\s\S]*?status text not null default 'queued' check \(status in \('queued', 'processing', 'completed', 'failed'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /import_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins sales_imports import_type and status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(18\)/);
  assert.match(pgTap, /sales_imports_import_type_check exists/);
  assert.match(pgTap, /sales_imports_status_check exists/);
  assert.match(pgTap, /sales_imports import_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /sales_imports import_type CHECK uses COLLATE C/);
  assert.match(pgTap, /sales_imports status CHECK keeps exact allowlist/);
  assert.match(pgTap, /sales_imports status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token pos_sync matches under COLLATE C/);
  assert.match(pgTap, /writer token csv_upload matches under COLLATE C/);
  assert.match(pgTap, /writer token manual_adjustment matches under COLLATE C/);
  assert.match(pgTap, /writer token queued matches under COLLATE C/);
  assert.match(pgTap, /writer token processing matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /spaced import_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty import vocabulary token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted import_type and status tokens match under COLLATE C/
  );
});
