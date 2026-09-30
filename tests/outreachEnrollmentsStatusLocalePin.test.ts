import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930330000_mise_005ds_outreach_enrollments_status_locale_pin.sql",
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
    "../supabase/tests/database/outreach_enrollments_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DS pins outreach_enrollments status and claimed_from_status CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_enrollments_status_check\s+check \(\s*status in \(\s*'queued',\s*'awaiting_review',\s*'ready',\s*'processing',\s*'contacted',\s*'replied',\s*'interested',\s*'not_interested',\s*'completed',\s*'suppressed',\s*'attention_required'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint outreach_enrollments_claimed_from_status_check\s+check \(\s*claimed_from_status in \('queued', 'ready', 'contacted'\)\s*and claimed_from_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`claimed_from_status collate "C" ~ '${TOKEN_PATTERN}'`),
    "claimed_from_status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'queued'") &&
      migration.includes("'awaiting_review'") &&
      migration.includes("'ready'") &&
      migration.includes("'processing'") &&
      migration.includes("'contacted'") &&
      migration.includes("'replied'") &&
      migration.includes("'interested'") &&
      migration.includes("'not_interested'") &&
      migration.includes("'completed'") &&
      migration.includes("'suppressed'") &&
      migration.includes("'attention_required'"),
    "exact status allowlist must be preserved"
  );
  assert.ok(
    migration.includes("claimed_from_status in ('queued', 'ready', 'contacted')"),
    "exact claimed_from_status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_suppressions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /generation_provider/);
  assert.doesNotMatch(sqlBody, /contact_basis/);
});

test("original outreach_enrollments vocabulary used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /claimed_from_status text check \(claimed_from_status in \('queued', 'ready', 'contacted'\)\)/
  );
  assert.match(
    original,
    /status text not null default 'queued' check \(\s*status in \(\s*'queued', 'awaiting_review', 'ready', 'processing', 'contacted', 'replied',\s*'interested', 'not_interested', 'completed', 'suppressed', 'attention_required'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /claimed_from_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_enrollments vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(30\)/);
  assert.match(pgTap, /outreach_enrollments_status_check exists/);
  assert.match(pgTap, /outreach_enrollments status CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_enrollments status CHECK uses COLLATE C/);
  assert.match(pgTap, /outreach_enrollments_claimed_from_status_check exists/);
  assert.match(
    pgTap,
    /outreach_enrollments claimed_from_status CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /outreach_enrollments claimed_from_status CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token queued matches under COLLATE C/);
  assert.match(pgTap, /writer token awaiting_review matches under COLLATE C/);
  assert.match(pgTap, /writer token ready matches under COLLATE C/);
  assert.match(pgTap, /writer token processing matches under COLLATE C/);
  assert.match(pgTap, /writer token contacted matches under COLLATE C/);
  assert.match(pgTap, /writer token replied matches under COLLATE C/);
  assert.match(pgTap, /writer token interested matches under COLLATE C/);
  assert.match(pgTap, /writer token not_interested matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /writer token suppressed matches under COLLATE C/);
  assert.match(pgTap, /writer token attention_required matches under COLLATE C/);
  assert.match(pgTap, /writer token claimed_from queued matches under COLLATE C/);
  assert.match(pgTap, /writer token claimed_from ready matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token claimed_from contacted matches under COLLATE C/
  );
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /spaced claimed_from_status token is rejected under COLLATE C/
  );
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /empty claimed_from_status token is rejected under COLLATE C/
  );
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated claimed_from_status token is rejected under COLLATE C/
  );
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /non-ASCII claimed_from_status token is rejected under COLLATE C/
  );
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted claimed_from_status tokens match under COLLATE C/
  );
});
