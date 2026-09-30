import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930300000_mise_005dp_outreach_agent_runs_trigger_status_locale_pin.sql",
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
    "../supabase/tests/database/outreach_agent_runs_trigger_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DP pins outreach_agent_runs trigger_type and status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_agent_runs_trigger_type_check\s+check \(\s*trigger_type in \('manual', 'scheduled'\)\s*and trigger_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint outreach_agent_runs_status_check\s+check \(\s*status in \('running', 'completed', 'failed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`trigger_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "trigger_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'manual'") &&
      migration.includes("'scheduled'") &&
      migration.includes("'running'") &&
      migration.includes("'completed'") &&
      migration.includes("'failed'"),
    "exact trigger_type and status allowlists must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_enrollments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_suppressions/i);
  assert.doesNotMatch(sqlBody, /generation_provider/);
  assert.doesNotMatch(sqlBody, /error_summary/);
});

test("original outreach_agent_runs trigger_type and status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.outreach_agent_runs[\s\S]*?trigger_type text not null check \(trigger_type in \('manual', 'scheduled'\)\)[\s\S]*?status text not null default 'running' check \(status in \('running', 'completed', 'failed'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /trigger_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_agent_runs trigger_type and status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /outreach_agent_runs_trigger_type_check exists/);
  assert.match(pgTap, /outreach_agent_runs_status_check exists/);
  assert.match(pgTap, /outreach_agent_runs trigger_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_agent_runs trigger_type CHECK uses COLLATE C/);
  assert.match(pgTap, /outreach_agent_runs status CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_agent_runs status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token manual matches under COLLATE C/);
  assert.match(pgTap, /writer token scheduled matches under COLLATE C/);
  assert.match(pgTap, /writer token running matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /spaced trigger_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty run vocabulary token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted trigger_type and status tokens match under COLLATE C/
  );
});
