import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930270000_mise_005dm_outreach_generation_provider_locale_pin.sql",
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
    "../supabase/tests/database/outreach_generation_provider_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DM pins outreach_messages generation_provider CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_generation_provider_check\s+check \(\s*generation_provider in \('openai', 'deterministic_fallback'\)\s*and generation_provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`generation_provider collate "C" ~ '${TOKEN_PATTERN}'`),
    "generation_provider CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'openai'") &&
      migration.includes("'deterministic_fallback'"),
    "exact generation_provider allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /outreach_messages_status_check/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /provider_message_id/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_source_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /outreach-agent/i);
});

test("original outreach_messages generation_provider used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /generation_provider text not null check \(generation_provider in \('openai', 'deterministic_fallback'\)\)/
  );
  assert.doesNotMatch(
    original,
    /generation_provider collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach generation_provider to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /outreach_messages_generation_provider_check exists/);
  assert.match(
    pgTap,
    /outreach_messages generation_provider CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /outreach_messages generation_provider CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token openai matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token deterministic_fallback matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced generation_provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty generation_provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated generation_provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII generation_provider token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted generation_provider tokens match under COLLATE C/
  );
});
