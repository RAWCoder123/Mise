import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926103000_mise_005p_claimed_envelope_email_locale_pin.sql",
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
    "../supabase/tests/database/claimed_envelope_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005P pins claimed_from/claimed_to lower + shape on metadata CHECK", () => {
  assert.ok(migration.includes("MISE-005P"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists supplier_email_deliveries_mise_003c_metadata_check/i
  );
  assert.match(
    migration,
    /add constraint supplier_email_deliveries_mise_003c_metadata_check/
  );
  assert.match(
    migration,
    /claimed_from = pg_catalog\.lower\(claimed_from collate "C"\) collate "C"/
  );
  assert.match(
    migration,
    /claimed_to = pg_catalog\.lower\(claimed_to collate "C"\) collate "C"/
  );
  assert.match(migration, /claimed_from collate "C" !~ '\[\[:cntrl:\]\]'/);
  assert.match(migration, /claimed_to collate "C" !~ '\[\[:cntrl:\]\]'/);
  assert.match(
    migration,
    /claimed_from collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    migration,
    /claimed_to collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  // Preserve claimed_subject cntrl pin from MISE-005J when reattaching.
  assert.match(migration, /claimed_subject collate "C" !~ '\[\[:cntrl:\]\]'/);
  // Preserve the MISE-003C metadata contract shape.
  assert.match(migration, /mise\.supplier_send\.v1/);
  assert.match(migration, /mise\.supplier_send\.v2/);
  assert.match(migration, /mise\.purchase_authority\.v1/);
  // Compose with MISE-005J / MISE-005O: do not rewrite sibling CHECKs or RPCs.
  assert.doesNotMatch(migration, /gmail_credentials_sender_email_check/);
  assert.doesNotMatch(migration, /supplier_email_deliveries_rfc_message_id_check/);
  assert.doesNotMatch(
    migration,
    /create or replace function (public|private)\./i
  );
});

test("MISE-003C originally left claimed_from/to on bare lower/cntrl without shape", () => {
  assert.match(
    original003c,
    /claimed_from = pg_catalog\.lower\(pg_catalog\.btrim\(claimed_from\)\)/
  );
  assert.match(
    original003c,
    /claimed_to = pg_catalog\.lower\(pg_catalog\.btrim\(claimed_to\)\)/
  );
  assert.match(original003c, /claimed_from !~ '\[\[:cntrl:\]\]'/);
  assert.match(original003c, /claimed_to !~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(original003c, /claimed_from collate "C"/);
  assert.doesNotMatch(original003c, /claimed_to collate "C"/);
  assert.doesNotMatch(
    original003c,
    /claimed_from collate "C" ~ '\^\[\^\[:space:\]@\]/
  );
  assert.doesNotMatch(
    original003c,
    /claimed_to collate "C" ~ '\^\[\^\[:space:\]@\]/
  );
});

test("pgTAP fixture pins claimed_from/to lower, cntrl, and shape", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /supplier_email_deliveries_mise_003c_metadata_check/);
  assert.match(pgTap, /claimed_from CHECK uses COLLATE C lower/);
  assert.match(pgTap, /claimed_to CHECK uses COLLATE C lower/);
  assert.match(pgTap, /claimed_from CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /claimed_to CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /claimed_from CHECK uses COLLATE C \[\[:space:\]\] shape/);
  assert.match(pgTap, /claimed_to CHECK uses COLLATE C \[\[:space:\]\] shape/);
  assert.match(pgTap, /claimed_subject CHECK keeps COLLATE C cntrl rejection/);
});
