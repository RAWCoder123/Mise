import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006120000_mise_005ik_restaurant_email_connections_sender_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260622053735_email_scaffolding.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_email_connections_sender_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IK pins restaurant_email_connections.sender_email CHECK to COLLATE C mailbox shape", () => {
  assert.ok(migration.includes("MISE-005IK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_email_connections_sender_email_check check \(\s*sender_email is null\s*or \(\s*pg_catalog\.length\(sender_email\) between 3 and 254\s*and sender_email = pg_catalog\.btrim\(sender_email\)\s*and sender_email = pg_catalog\.lower\(sender_email collate "C"\) collate "C"\s*and sender_email collate "C" !~ '\[\[:cntrl:\]\]'\s*and sender_email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`sender_email collate "C" !~ '[[:cntrl:]]'`),
    "sender_email CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      `sender_email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`
    ),
    "sender_email CHECK must pin mailbox shape under COLLATE C"
  );
  assert.ok(
    migration.includes("pg_catalog.length(sender_email) between 3 and 254"),
    "exact length bound must match Gmail credential sibling (MISE-005O)"
  );

  // Compose: CHECK-only. Do not rewrite OAuth writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /service_complete_gmail_oauth/);
  assert.doesNotMatch(sqlBody, /service_claim_gmail/);
  assert.doesNotMatch(sqlBody, /gmail_credentials/);
  assert.doesNotMatch(sqlBody, /gmail_oauth_flows/);
  assert.doesNotMatch(sqlBody, /pos_integrations/);
  assert.doesNotMatch(sqlBody, /outreach_/);
  assert.doesNotMatch(
    sqlBody,
    /add constraint restaurant_email_connections_provider_check/,
    "must not reattach provider CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint restaurant_email_connections_status_check/,
    "must not reattach status CHECK by name rewrite"
  );
  assert.match(
    migration,
    /not ilike '%provider%'/,
    "must leave provider vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status vocabulary untouched"
  );
});

test("original restaurant_email_connections.sender_email was unbound nullable text", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_email_connections \([\s\S]*?sender_email text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_email_connections \([\s\S]*?sender_email text[^,\n]*check/
  );
  assert.match(
    original,
    /Verified sender email for display and readiness checks/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /sender_email collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
  assert.match(pgTap, /\[:space:\]/);
  assert.match(pgTap, /tab in sender_email local-part is rejected/);
  assert.match(pgTap, /newline in sender_email domain is rejected/);
  assert.match(pgTap, /NUL in sender_email domain is rejected/);
  assert.match(pgTap, /public\.restaurant_email_connections/);
});
