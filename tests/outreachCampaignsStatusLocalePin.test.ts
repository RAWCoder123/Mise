import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930310000_mise_005dq_outreach_campaigns_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_campaigns_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DQ pins outreach_campaigns.status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_status_check\s+check \(\s*status in \('draft', 'active', 'paused', 'completed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'active'") &&
      migration.includes("'paused'") &&
      migration.includes("'completed'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_enrollments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_suppressions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /generation_provider/);
  assert.doesNotMatch(sqlBody, /contact_basis/);
  assert.doesNotMatch(sqlBody, /claimed_from_status/);
});

test("original outreach_campaigns.status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.outreach_campaigns[\s\S]*?status text not null default 'draft' check \(status in \('draft', 'active', 'paused', 'completed'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_campaigns.status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(15\)/);
  assert.match(pgTap, /outreach_campaigns_status_check exists/);
  assert.match(pgTap, /outreach_campaigns status CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_campaigns status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token active matches under COLLATE C/);
  assert.match(pgTap, /writer token paused matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
  assert.match(pgTap, /ASCII-shaped Draft passes shape gate alone under COLLATE C/);
  assert.match(pgTap, /case-shifted DRAFT fails exact allowlist/);
  assert.match(pgTap, /trailing-space status token is rejected under COLLATE C/);
});
