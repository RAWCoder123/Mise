import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  foldAsciiUpperCase,
  matchesGmailSenderEmailShape,
  normalizeGmailSenderEmail,
  GMAIL_SENDER_EMAIL_SHAPE
} from "../supabase/functions/_shared/gmail.ts";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926093000_mise_005o_gmail_sender_email_locale_pin.sql",
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
    "../supabase/tests/database/gmail_sender_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const gmailShared = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8"
);

test("MISE-005O pins gmail_credentials sender_email CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005O"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists gmail_credentials_sender_email_check/i
  );
  assert.match(
    migration,
    /add constraint gmail_credentials_sender_email_check[\s\S]*lower\(sender_email collate "C"\) collate "C"/
  );
  assert.match(
    migration,
    /sender_email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /sender_email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  // Compose with MISE-005J: do not rewrite delivery metadata or rfc_message_id.
  assert.doesNotMatch(migration, /supplier_email_deliveries_mise_003c_metadata_check/);
  assert.doesNotMatch(migration, /supplier_email_deliveries_rfc_message_id_check/);
});

test("MISE-005O pins service_complete_gmail_oauth email fail-closed to COLLATE C", () => {
  assert.match(
    migration,
    /create or replace function private\.service_complete_gmail_oauth\(\s*p_flow_id uuid,\s*p_provider_subject text,\s*p_sender_email text/i
  );
  assert.match(
    migration,
    /pg_catalog\.btrim\(coalesce\(p_sender_email, ''\)\) collate "C"/
  );
  assert.match(
    migration,
    /normalized_email collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /normalized_email collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    migration,
    /grant execute on function private\.service_complete_gmail_oauth\(uuid, text, text, text, text\[\]\)\s+to service_role/i
  );
});

test("original Gmail migration left sender_email on bare lower/cntrl without shape", () => {
  assert.match(
    originalGmail,
    /sender_email = lower\(sender_email\)\s+and sender_email !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(originalGmail, /sender_email collate "C"/);
  assert.match(
    originalGmail,
    /normalized_email text := lower\(trim\(p_sender_email\)\);/
  );
  assert.match(
    originalGmail,
    /normalized_email ~ '\[\[:cntrl:\]\]' or normalized_email !~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'/
  );
});

test("pgTAP fixture pins sender_email CHECK and OAuth fail-closed", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /gmail_credentials_sender_email_check/);
  assert.match(pgTap, /sender_email CHECK uses COLLATE C \[\[:space:\]\] shape/);
  assert.match(pgTap, /OAuth lower\/btrim sender_email uses COLLATE C/);
  assert.match(pgTap, /OAuth shape fail-closed uses COLLATE C/);
});

test("Edge Gmail helpers mirror ASCII C [[:space:]] rejection and A-Z lower", () => {
  assert.match(gmailShared, /MISE-005O/);
  assert.match(gmailShared, /GMAIL_SENDER_EMAIL_SHAPE/);
  assert.equal(GMAIL_SENDER_EMAIL_SHAPE.source.includes("\\s"), false);
  assert.equal(matchesGmailSenderEmailShape("orders@fresh.test"), true);
  assert.equal(matchesGmailSenderEmailShape("orders\t@fresh.test"), false);
  assert.equal(matchesGmailSenderEmailShape("orders\n@fresh.test"), false);
  assert.equal(matchesGmailSenderEmailShape("orders fresh@test.example"), false);
  assert.equal(matchesGmailSenderEmailShape("not-an-email"), false);
  // JS \\s would reject NBSP; COLLATE C [[:space:]] does not treat U+00A0 as space.
  assert.equal(matchesGmailSenderEmailShape("orders\u00a0@fresh.test"), true);
  assert.equal(normalizeGmailSenderEmail(" ORDERS@Fresh.Example "), "orders@fresh.example");
  // A-Z fold only: keep Latin-1 capital É unchanged (matches lower(... COLLATE "C")).
  assert.equal(foldAsciiUpperCase("CAFÉ@Fresh.Example"), "cafÉ@fresh.example");
  assert.equal(normalizeGmailSenderEmail("CAFÉ@Fresh.Example"), "cafÉ@fresh.example");
});
