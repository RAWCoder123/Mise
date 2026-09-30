import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930340000_mise_005dt_outreach_messages_status_locale_pin.sql",
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
    "../supabase/tests/database/outreach_messages_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DT pins outreach_messages status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_status_check\s+check \(\s*status in \(\s*'draft',\s*'approved',\s*'sending',\s*'sent',\s*'delivered',\s*'failed',\s*'send_unknown',\s*'bounced',\s*'complained',\s*'suppressed',\s*'cancelled'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'approved'") &&
      migration.includes("'sending'") &&
      migration.includes("'sent'") &&
      migration.includes("'delivered'") &&
      migration.includes("'failed'") &&
      migration.includes("'send_unknown'") &&
      migration.includes("'bounced'") &&
      migration.includes("'complained'") &&
      migration.includes("'suppressed'") &&
      migration.includes("'cancelled'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /generation_provider/);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_enrollments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_suppressions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/);
  assert.doesNotMatch(sqlBody, /provider_message_id/);
  assert.doesNotMatch(sqlBody, /outreach-agent/);
  assert.doesNotMatch(sqlBody, /outreach-webhook/);
});

test("original outreach_messages status used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /status text not null default 'draft' check \(\s*status in \('draft', 'approved', 'sending', 'sent', 'delivered', 'failed', 'send_unknown', 'bounced', 'complained', 'suppressed', 'cancelled'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_messages status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(19\)/);
  assert.match(pgTap, /outreach_messages_status_check exists/);
  assert.match(pgTap, /outreach_messages status CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_messages status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token sending matches under COLLATE C/);
  assert.match(pgTap, /writer token sent matches under COLLATE C/);
  assert.match(pgTap, /writer token delivered matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /writer token send_unknown matches under COLLATE C/);
  assert.match(pgTap, /writer token bounced matches under COLLATE C/);
  assert.match(pgTap, /writer token complained matches under COLLATE C/);
  assert.match(pgTap, /writer token suppressed matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
