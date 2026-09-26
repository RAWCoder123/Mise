import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926042000_mise_005j_supplier_send_envelope_cntrl_locale_pin.sql",
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
const original003c = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_send_envelope_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005J pins supplier-send envelope cntrl CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005J"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists gmail_credentials_sender_email_check/i
  );
  assert.match(
    migration,
    /drop constraint if exists supplier_email_deliveries_rfc_message_id_check/i
  );
  assert.match(
    migration,
    /drop constraint if exists supplier_email_deliveries_mise_003c_metadata_check/i
  );
  assert.match(
    migration,
    /sender_email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /rfc_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /claimed_from collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /claimed_to collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /claimed_subject collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  // Preserve the MISE-003C metadata contract shape.
  assert.match(migration, /mise\.supplier_send\.v1/);
  assert.match(migration, /mise\.supplier_send\.v2/);
  assert.match(migration, /mise\.purchase_authority\.v1/);
  // Compose with open stacks: do not rewrite claim / approve / complete RPCs.
  assert.doesNotMatch(
    migration,
    /create or replace function (public|private)\./i
  );
});

test("Gmail OAuth delivery originally left sender_email and rfc_message_id cntrl unpinned", () => {
  assert.match(
    originalGmail,
    /sender_email !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    originalGmail,
    /rfc_message_id !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalGmail,
    /sender_email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalGmail,
    /rfc_message_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("MISE-003C originally left claimed envelope cntrl CHECKs unpinned", () => {
  assert.match(
    original003c,
    /claimed_from !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    original003c,
    /claimed_to !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    original003c,
    /claimed_subject !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    original003c,
    /claimed_from collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    original003c,
    /claimed_to collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    original003c,
    /claimed_subject collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins the five envelope CHECK sites", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /gmail_credentials_sender_email_check/);
  assert.match(pgTap, /supplier_email_deliveries_rfc_message_id_check/);
  assert.match(pgTap, /supplier_email_deliveries_mise_003c_metadata_check/);
  assert.match(pgTap, /sender_email collate "C" !~/);
  assert.match(pgTap, /rfc_message_id collate "C" !~/);
  assert.match(pgTap, /claimed_from collate "C" !~/);
  assert.match(pgTap, /claimed_to collate "C" !~/);
  assert.match(pgTap, /claimed_subject collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
});
