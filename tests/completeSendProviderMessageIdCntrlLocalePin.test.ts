import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926140000_mise_005t_complete_send_provider_message_id_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/complete_send_provider_message_id_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005T pins complete-send provider_message_id cntrl preflight to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005T"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.service_complete_supplier_email_send\(\s*p_actor_user_id uuid,\s*p_restaurant_id uuid,\s*p_order_id uuid,\s*p_claim_token uuid,\s*p_provider_message_id text/i
  );
  assert.match(
    migration,
    /or p_provider_message_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /grant execute on function private\.service_complete_supplier_email_send\(\s*uuid, uuid, uuid, uuid, text\s*\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.service_complete_supplier_email_send\(\s*uuid, uuid, uuid, uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  // Function body must not keep a bare (unpinned) provider_message_id cntrl preflight.
  const functionBody = migration.slice(
    migration.indexOf(
      "create or replace function private.service_complete_supplier_email_send"
    )
  );
  assert.doesNotMatch(
    functionBody,
    /or p_provider_message_id ~ '\[\[:cntrl:\]\]'/
  );
  // Compose with MISE-005J/005O/005P/005Q/005S: do not reattach sibling CHECKs
  // or rewrite claim/build/oauth.
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
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_complete_gmail_oauth/i
  );
});

test("MISE-003C originally left complete-send provider_message_id cntrl preflight unpinned", () => {
  assert.match(original003c, /or p_provider_message_id ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(
    original003c,
    /or p_provider_message_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins complete-send provider_message_id cntrl preflight to COLLATE C", () => {
  assert.match(pgTap, /select plan\(4\)/);
  assert.match(
    pgTap,
    /complete-send provider_message_id cntrl preflight uses COLLATE C/
  );
  assert.match(pgTap, /service_role retains EXECUTE on complete-send/);
  assert.match(pgTap, /authenticated lacks EXECUTE on complete-send/);
});
