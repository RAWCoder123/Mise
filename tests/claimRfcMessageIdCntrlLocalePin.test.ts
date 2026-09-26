import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926133000_mise_005s_claim_rfc_message_id_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/claim_rfc_message_id_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005S pins claim RFC Message-Id cntrl preflight to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005S"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.service_claim_supplier_email_send\(\s*p_actor_user_id uuid,\s*p_restaurant_id uuid,\s*p_order_id uuid,\s*p_idempotency_key uuid,\s*p_rfc_message_id text/i
  );
  assert.match(
    migration,
    /or p_rfc_message_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  // Preserve MISE-005R credential identity pin so this tip is compose-safe alone.
  assert.match(
    migration,
    /credential\.sender_email <> pg_catalog\.lower\(\s*pg_catalog\.btrim\(connection\.sender_email\) collate "C"\s*\) collate "C"/
  );
  assert.match(
    migration,
    /grant execute on function private\.service_claim_supplier_email_send\(\s*uuid, uuid, uuid, uuid, text\s*\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.service_claim_supplier_email_send\(\s*uuid, uuid, uuid, uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  // Function body must not keep a bare (unpinned) rfc cntrl preflight.
  const functionBody = migration.slice(
    migration.indexOf("create or replace function private.service_claim_supplier_email_send")
  );
  assert.doesNotMatch(
    functionBody,
    /or p_rfc_message_id ~ '\[\[:cntrl:\]\]'/
  );
  // Compose with MISE-005J/005O/005P/005Q: do not reattach sibling CHECKs or rewrite build.
  assert.doesNotMatch(migration, /gmail_credentials_sender_email_check/);
  assert.doesNotMatch(
    migration,
    /supplier_email_deliveries_mise_003c_metadata_check/
  );
  assert.doesNotMatch(
    migration,
    /supplier_email_deliveries_rfc_message_id_check/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.build_supplier_send_content/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_gmail_oauth/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
});

test("MISE-003C originally left claim RFC Message-Id cntrl preflight unpinned", () => {
  assert.match(
    original003c,
    /or p_rfc_message_id ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    original003c,
    /or p_rfc_message_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins claim RFC Message-Id cntrl preflight to COLLATE C", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(pgTap, /claim RFC Message-Id cntrl preflight uses COLLATE C/);
  assert.match(pgTap, /claim credential identity lower\/btrim uses COLLATE C/);
  assert.match(pgTap, /service_role retains EXECUTE on claim/);
  assert.match(pgTap, /authenticated lacks EXECUTE on claim/);
});
