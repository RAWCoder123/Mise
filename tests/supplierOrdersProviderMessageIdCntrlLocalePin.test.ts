import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927080000_mise_005ak_supplier_orders_provider_message_id_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalGmail = readFileSync(
  new URL(
    "../supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_orders_provider_message_id_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005AK pins supplier_orders provider_message_id cntrl half to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AK"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint supplier_orders_email_delivery_check check \(/i
  );
  assert.match(
    migration,
    /provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /pg_catalog\.length\(provider_message_id\) between 1 and 512/
  );
  assert.match(
    migration,
    /email_provider is null or email_provider = 'gmail'/
  );
  assert.match(migration, /sent_at is not null/);
  assert.match(migration, /sent_by_user_id is not null/);

  // Compose: do not rewrite complete-send (owned by open MISE-005T #428),
  // private delivery CHECK (owned by open MISE-005AJ #444), claim/rfc paths,
  // or envelope metadata.
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(sqlBody, /supplier_email_deliveries_provider_message_id_check/i);
  assert.doesNotMatch(
    sqlBody,
    /alter table private\.supplier_email_deliveries/i
  );
  assert.doesNotMatch(sqlBody, /rfc_message_id/i);
  assert.doesNotMatch(sqlBody, /claimed_from|claimed_to|claimed_subject/i);
  assert.doesNotMatch(sqlBody, /gmail_credentials/i);
});

test("gmail delivery originally left supplier_orders provider_message_id length-only (prove the gap)", () => {
  assert.match(
    originalGmail,
    /add constraint supplier_orders_email_delivery_check check \(/i
  );
  assert.match(
    originalGmail,
    /\(provider_message_id is null or length\(provider_message_id\) between 1 and 512\)/
  );
  assert.doesNotMatch(
    originalGmail,
    /provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins supplier_orders provider_message_id CHECK site", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /supplier_orders_email_delivery_check/);
  assert.match(
    pgTap,
    /provider_message_id half uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /provider_message_id half preserves length 1–512 bound/
  );
  assert.match(pgTap, /email_provider half preserved/);
  assert.match(pgTap, /draft\/sent coherence half preserved/);
});
