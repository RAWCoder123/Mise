import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928030000_mise_005bd_gmail_provider_subject_locale_pin.sql",
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
    "../supabase/tests/database/gmail_provider_subject_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const edgeSource = readFileSync(
  new URL("../supabase/functions/gmail-oauth-callback/index.ts", import.meta.url),
  "utf8"
);
const sharedGmail = readFileSync(
  new URL("../supabase/functions/_shared/gmail.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const SUBJECT_PATTERN = "^[A-Za-z0-9_-]{1,255}$";

test("MISE-005BD pins gmail_credentials.provider_subject CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BD"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint gmail_credentials_provider_subject_check check \(\s*provider_subject collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,255\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`provider_subject collate "C" ~ '${SUBJECT_PATTERN}'`),
    "provider_subject CHECK must pin under COLLATE C"
  );

  // Compose: do not rewrite contested complete-oauth / sender_email (#423),
  // OAuth state_hash (#438), Square merchant_id (#460), or free-form ledgers.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /service_complete_gmail_oauth/i);
  assert.doesNotMatch(sqlBody, /add constraint[^;]*sender_email/i);
  assert.doesNotMatch(sqlBody, /alter table private\.square_credentials/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("original gmail_credentials.provider_subject CHECK was length-only", () => {
  assert.match(
    originalGmail,
    /provider_subject text not null check \(length\(provider_subject\) between 1 and 255\)/
  );
  assert.doesNotMatch(
    originalGmail,
    /provider_subject collate "C" ~ '\^\[A-Za-z0-9_-\]\{1,255\}\$'/
  );
});

test("Edge gmail-oauth-callback provider_subject shape matches the pinned ASCII class", () => {
  assert.match(
    edgeSource,
    /const GMAIL_PROVIDER_SUBJECT_PATTERN = \/\^\[A-Za-z0-9_-\]\{1,255\}\$\//
  );
  assert.match(edgeSource, /function isGmailProviderSubject\(value: string\)/);
  assert.match(edgeSource, /if \(!isGmailProviderSubject\(identity\.subject\)\)/);
  assert.match(edgeSource, /gmail_oauth_provider_subject_invalid/);
  assert.match(edgeSource, /token_response_invalid/);

  // Do not rewrite contested _shared/gmail.ts while #423 is open.
  assert.doesNotMatch(sharedGmail, /GMAIL_PROVIDER_SUBJECT_PATTERN/);
  assert.doesNotMatch(sharedGmail, /isGmailProviderSubject/);

  // Mirror the Edge allowlist locally so the static contract stays executable.
  const GMAIL_PROVIDER_SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
  const isGmailProviderSubject = (value: string) =>
    GMAIL_PROVIDER_SUBJECT_PATTERN.test(value);

  assert.equal(isGmailProviderSubject("123456789012345678901"), true);
  assert.equal(isGmailProviderSubject("mise-003b-relinked-subject"), true);
  assert.equal(isGmailProviderSubject("abc_DEF-012"), true);
  assert.equal(isGmailProviderSubject("subject with space"), false);
  assert.equal(isGmailProviderSubject("sujeto-ñ"), false);
  assert.equal(isGmailProviderSubject("subject\twith-tab"), false);
  assert.equal(isGmailProviderSubject(""), false);
  assert.equal(isGmailProviderSubject("a".repeat(256)), false);
  assert.equal(isGmailProviderSubject("a".repeat(255)), true);
});

test("pgTAP fixture pins gmail_credentials.provider_subject shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /gmail_credentials_provider_subject_check exists/);
  assert.match(
    pgTap,
    /gmail_credentials\.provider_subject CHECK uses COLLATE C ASCII shape/
  );
  assert.match(
    pgTap,
    /gmail_credentials\.provider_subject CHECK is not length-only/
  );
  assert.match(pgTap, /numeric Google sub matches under COLLATE C/);
  assert.match(pgTap, /fixture ASCII subject matches under COLLATE C/);
  assert.match(pgTap, /spaced provider_subject is rejected under COLLATE C/);
  assert.match(pgTap, /ASCII tab provider_subject is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII provider_subject is rejected under COLLATE C/);
});
