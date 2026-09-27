import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927070000_mise_005aj_provider_message_id_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/provider_message_id_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005AJ pins provider_message_id cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AJ"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint supplier_email_deliveries_provider_message_id_check check \(/i
  );
  assert.match(
    migration,
    /provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /pg_catalog\.length\(provider_message_id\) between 1 and 512/
  );

  // Compose: do not rewrite complete-send (owned by open MISE-005T #428),
  // claim/rfc paths, envelope metadata, or supplier_orders delivery CHECK.
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_complete_supplier_email_send/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(sqlBody, /supplier_orders_email_delivery_check/i);
  assert.doesNotMatch(sqlBody, /rfc_message_id/i);
  assert.doesNotMatch(sqlBody, /claimed_from|claimed_to|claimed_subject/i);
  assert.doesNotMatch(sqlBody, /gmail_credentials/i);
});

test("gmail delivery originally left provider_message_id length-only (prove the gap)", () => {
  assert.match(
    originalGmail,
    /provider_message_id text check \(provider_message_id is null or length\(provider_message_id\) between 1 and 512\)/
  );
  assert.doesNotMatch(
    originalGmail,
    /provider_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  // Sibling rfc_message_id already had bare cntrl (later pinned by MISE-005J);
  // provider_message_id never got even a bare cntrl half on the CHECK.
  assert.match(
    originalGmail,
    /rfc_message_id !~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins provider_message_id CHECK site", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /supplier_email_deliveries_provider_message_id_check/);
  assert.match(pgTap, /provider_message_id CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /provider_message_id CHECK preserves length 1–512 bound/);
});
