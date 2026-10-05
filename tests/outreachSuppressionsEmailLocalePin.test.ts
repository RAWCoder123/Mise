import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005200000_mise_005if_outreach_suppressions_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_suppressions_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const webhook = readFileSync(
  new URL("../supabase/functions/outreach-webhook/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IF pins outreach_suppressions.email CHECK to COLLATE C shape", () => {
  assert.ok(migration.includes("MISE-005IF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_suppressions_email_check check \(\s*email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'\s*\)/
  );
  assert.ok(
    migration.includes(
      `email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`
    ),
    "suppressions email CHECK must pin [[:space:]] rejection under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers, generated keys, or siblings.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /drop column if exists email_normalized/i);
  assert.doesNotMatch(sqlBody, /add column email_normalized/i);
  assert.doesNotMatch(sqlBody, /outreach_leads/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /outreach_messages/i);
  assert.doesNotMatch(sqlBody, /restaurant_/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_suppressions_reason_check/,
    "must not reattach reason CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_suppressions_source_check/,
    "must not reattach source CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_suppressions_email_normalized_key/,
    "must not recreate email_normalized unique key"
  );
  assert.match(
    migration,
    /not ilike '%reason%'/,
    "must leave reason vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%source%'/,
    "must leave source vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%email_normalized%'/,
    "must leave email_normalized uniqueness untouched"
  );
});
test("original outreach_suppressions.email had no shape CHECK; writers copy lead email", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_suppressions \([\s\S]*?email text not null,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_suppressions \([\s\S]*?email text not null check/
  );
  assert.match(
    webhook,
    /\.from\("outreach_suppressions"\)\.insert\(\{\s*email:\s*leadResult\.data\.email/
  );
  assert.match(
    originalFoundation,
    /insert into public\.outreach_suppressions\(email, reason, source\)/
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

  assert.match(pgTap, /email collate "C" ~/);
  assert.match(pgTap, /\[\[:space:\]\]/);
  assert.match(pgTap, /ASCII tab breaks suppressions email shape/);
  assert.match(pgTap, /ASCII LF breaks suppressions email shape/);
  assert.match(pgTap, /ASCII space breaks suppressions email shape/);
});
