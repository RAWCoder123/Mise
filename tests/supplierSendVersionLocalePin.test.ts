import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928190000_mise_005bt_supplier_send_version_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original003b = readFileSync(
  new URL(
    "../supabase/migrations/20260823062101_mise_003b_supplier_send_integrity.sql",
    import.meta.url
  ),
  "utf8"
);
const original003c = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_send_version_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const VERSION_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BT pins supplier-send version CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_email_deliveries_content_version_check check \(\s*content_version is null\s*or content_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint supplier_email_deliveries_authority_version_check check \(\s*authority_version is null\s*or authority_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`content_version collate "C" ~ '${VERSION_PATTERN}'`),
    "content_version CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`authority_version collate "C" ~ '${VERSION_PATTERN}'`),
    "authority_version CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("content_version is null"),
    "content_version CHECK must keep null unclaimed rows legal"
  );
  assert.ok(
    migration.includes("authority_version is null"),
    "authority_version CHECK must keep null unclaimed rows legal"
  );

  // Compose: CHECK-only. Do not rewrite compound metadata or writers.
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_mise_003c_metadata_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.approve_supplier_send_content/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_content_fingerprint_hex_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_authority_fingerprint_hex_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_last_error_code_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_provider_message_id/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
});

test("original supplier-send versions used compound allowlists without COLLATE C shape", () => {
  assert.match(
    original003b,
    /content_version = 'mise\.supplier_send\.v1'/
  );
  assert.match(
    original003b,
    /authority_version = 'mise\.purchase_authority\.v1'/
  );
  assert.match(
    original003c,
    /content_version in \('mise\.supplier_send\.v1', 'mise\.supplier_send\.v2'\)/
  );
  assert.match(
    original003c,
    /authority_version = 'mise\.purchase_authority\.v1'/
  );
  assert.doesNotMatch(
    original003b,
    /content_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original003c,
    /content_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original003b,
    /authority_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original003c,
    /authority_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.match(
    original003b,
    /content_version constant text := 'mise\.supplier_send\.v1'/
  );
  assert.match(
    original003c,
    /content_version constant text := 'mise\.supplier_send\.v2'/
  );
  assert.match(
    original003b,
    /authority_version constant text := 'mise\.purchase_authority\.v1'/
  );
  assert.match(
    original003c,
    /authority_version constant text := 'mise\.purchase_authority\.v1'/
  );
});

test("pgTAP fixture pins supplier-send version shapes to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /supplier_email_deliveries_content_version_check exists/);
  assert.match(
    pgTap,
    /supplier_email_deliveries_authority_version_check exists/
  );
  assert.match(pgTap, /content_version CHECK uses COLLATE C/);
  assert.match(pgTap, /authority_version CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /content_version CHECK preserves nullable unclaimed state/
  );
  assert.match(
    pgTap,
    /authority_version CHECK preserves nullable unclaimed state/
  );
  assert.match(
    pgTap,
    /writer content_version mise\.supplier_send\.v1 matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer content_version mise\.supplier_send\.v2 matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer authority_version mise\.purchase_authority\.v1 matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced supplier-send content_version is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced purchase-authority version is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty supplier-send version token is rejected under COLLATE C/
  );
});
