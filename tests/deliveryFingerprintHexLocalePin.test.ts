import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927100000_mise_005am_delivery_fingerprint_hex_locale_pin.sql",
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
    "../supabase/tests/database/delivery_fingerprint_hex_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const HEX_PATTERN = "^[a-f0-9]{64}$";

test("MISE-005AM pins delivery fingerprint hex CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_email_deliveries_content_fingerprint_hex_check check \(\s*content_fingerprint is null\s*or content_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint supplier_email_deliveries_authority_fingerprint_hex_check check \(\s*authority_fingerprint is null\s*or authority_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`content_fingerprint collate "C" ~ '${HEX_PATTERN}'`),
    "content_fingerprint must pin hex under COLLATE C"
  );
  assert.ok(
    migration.includes(`authority_fingerprint collate "C" ~ '${HEX_PATTERN}'`),
    "authority_fingerprint must pin hex under COLLATE C"
  );

  // Compose: additive CHECKs only. Do not rewrite contested compound CHECK
  // or writer RPCs owned by open stacks.
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_mise_003[bc]_metadata_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.approve_supplier_send_content/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_email_deliveries_provider_message_id_check/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
});

test("original delivery fingerprint hex classes were bare", () => {
  assert.match(
    original003b,
    /content_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.match(
    original003b,
    /authority_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.doesNotMatch(
    original003b,
    /content_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.doesNotMatch(
    original003b,
    /authority_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'/
  );

  assert.match(
    original003c,
    /content_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.match(
    original003c,
    /authority_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.doesNotMatch(
    original003c,
    /content_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'/
  );
  assert.doesNotMatch(
    original003c,
    /authority_fingerprint collate "C" ~ '\^\[a-f0-9\]\{64\}\$'/
  );
});

test("pgTAP fixture pins delivery fingerprint hex to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(
    pgTap,
    /supplier_email_deliveries_content_fingerprint_hex_check exists/
  );
  assert.match(
    pgTap,
    /supplier_email_deliveries_authority_fingerprint_hex_check exists/
  );
  assert.match(pgTap, /content_fingerprint hex CHECK uses COLLATE C/);
  assert.match(pgTap, /authority_fingerprint hex CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /content_fingerprint hex CHECK preserves nullable unclaimed state/
  );
  assert.match(
    pgTap,
    /authority_fingerprint hex CHECK preserves nullable unclaimed state/
  );
  assert.match(
    pgTap,
    /ASCII lowercase hex fingerprint matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /uppercase hex fingerprint is rejected under COLLATE C/
  );
});
