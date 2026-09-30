import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930290000_mise_005do_outreach_suppressions_reason_source_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_suppressions_reason_source_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DO pins outreach_suppressions reason and source CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_suppressions_reason_check\s+check \(\s*reason in \(\s*'recipient_request',\s*'hard_bounce',\s*'spam_complaint',\s*'provider_suppression',\s*'manual'\s*\)\s*and reason collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint outreach_suppressions_source_check\s+check \(\s*source in \('unsubscribe', 'resend_webhook', 'operator'\)\s*and source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`reason collate "C" ~ '${TOKEN_PATTERN}'`),
    "reason CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`source collate "C" ~ '${TOKEN_PATTERN}'`),
    "source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'recipient_request'") &&
      migration.includes("'hard_bounce'") &&
      migration.includes("'spam_complaint'") &&
      migration.includes("'provider_suppression'") &&
      migration.includes("'manual'"),
    "exact reason allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'unsubscribe'") &&
      migration.includes("'resend_webhook'") &&
      migration.includes("'operator'"),
    "exact source allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_unsubscribe_outreach/i);
  assert.doesNotMatch(sqlBody, /outreach-webhook/i);
  assert.doesNotMatch(sqlBody, /outreach-agent/i);
  assert.doesNotMatch(sqlBody, /outreach_messages_generation_provider_check/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_source_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
});

test("original outreach_suppressions vocabulary used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /reason text not null check \(reason in \('recipient_request', 'hard_bounce', 'spam_complaint', 'provider_suppression', 'manual'\)\)/
  );
  assert.match(
    original,
    /source text not null check \(source in \('unsubscribe', 'resend_webhook', 'operator'\)\)/
  );
  assert.doesNotMatch(
    original,
    /reason collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_suppressions vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(24\)/);
  assert.match(pgTap, /outreach_suppressions_reason_check exists/);
  assert.match(pgTap, /outreach_suppressions reason CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_suppressions reason CHECK uses COLLATE C/);
  assert.match(pgTap, /outreach_suppressions_source_check exists/);
  assert.match(pgTap, /outreach_suppressions source CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_suppressions source CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token recipient_request matches under COLLATE C/);
  assert.match(pgTap, /writer token hard_bounce matches under COLLATE C/);
  assert.match(pgTap, /writer token spam_complaint matches under COLLATE C/);
  assert.match(pgTap, /writer token provider_suppression matches under COLLATE C/);
  assert.match(pgTap, /writer token manual matches under COLLATE C/);
  assert.match(pgTap, /writer token unsubscribe matches under COLLATE C/);
  assert.match(pgTap, /writer token resend_webhook matches under COLLATE C/);
  assert.match(pgTap, /writer token operator matches under COLLATE C/);
  assert.match(pgTap, /spaced reason token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced source token is rejected under COLLATE C/);
  assert.match(pgTap, /empty reason token is rejected under COLLATE C/);
  assert.match(pgTap, /empty source token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated reason token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated source token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII reason token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII source token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted reason tokens match under COLLATE C/);
  assert.match(pgTap, /all allowlisted source tokens match under COLLATE C/);
});
