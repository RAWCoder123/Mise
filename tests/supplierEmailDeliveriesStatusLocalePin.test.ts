import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930350000_mise_005du_supplier_email_deliveries_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_email_deliveries_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DU pins supplier_email_deliveries status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_email_deliveries_status_check\s+check \(\s*status in \(\s*'sending',\s*'sent',\s*'failed',\s*'unknown'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'sending'") &&
      migration.includes("'sent'") &&
      migration.includes("'failed'") &&
      migration.includes("'unknown'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /supplier_email_deliveries_sent_check/);
  assert.doesNotMatch(sqlBody, /alter table private\.gmail_/i);
  assert.doesNotMatch(sqlBody, /alter table public\.email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /sender_email/);
  assert.doesNotMatch(sqlBody, /send-supplier-email/);
  assert.doesNotMatch(sqlBody, /link-gmail/);
  assert.doesNotMatch(sqlBody, /gmail-oauth-callback/);
});

test("original supplier_email_deliveries status used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /status text not null check \(status in \('sending', 'sent', 'failed', 'unknown'\)\)/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins supplier_email_deliveries status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /supplier_email_deliveries_status_check exists/);
  assert.match(pgTap, /supplier_email_deliveries status CHECK keeps exact allowlist/);
  assert.match(pgTap, /supplier_email_deliveries status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token sending matches under COLLATE C/);
  assert.match(pgTap, /writer token sent matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /writer token unknown matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
