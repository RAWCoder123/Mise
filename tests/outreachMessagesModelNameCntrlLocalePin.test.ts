import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005190000_mise_005ie_outreach_messages_model_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_messages_model_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachAgent = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IE pins outreach_messages.model_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_model_name_check check \(\s*model_name is null\s*or \(\s*length\(trim\(model_name\)\) between 1 and 80\s*and model_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`model_name collate "C" !~ '[[:cntrl:]]'`),
    "outreach_messages model_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(model_name)) between 1 and 80"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("model_name is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /error_summary/i);
  assert.doesNotMatch(sqlBody, /outreach_events/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /outreach_leads/i);
  assert.doesNotMatch(sqlBody, /restaurant_/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /mise_actions/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%subject%'/,
    "must leave subject bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%body_html%'/,
    "must leave body_html bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%body_text%'/,
    "must leave body_text bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%personalization_note%'/,
    "must leave personalization_note bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%provider_message_id%'/,
    "must leave provider_message_id bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%last_error%'/,
    "must leave last_error bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%generation_provider%'/,
    "must leave generation_provider bounds untouched"
  );
});

test("original outreach_messages.model_name had no CHECK; writer inserts env model without length gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?model_name text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?model_name text[^\n]*check/
  );
  assert.match(outreachAgent, /model_name:\s*generated\.model/);
  assert.match(
    outreachAgent,
    /const model = Deno\.env\.get\("OPENAI_OUTREACH_MODEL"\) \?\? "gpt-5\.6"/
  );
  assert.match(outreachAgent, /model:\s*null/);
  assert.doesNotMatch(
    outreachAgent,
    /optionalString\([^)]*model[^)]*80\)/
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

  assert.match(pgTap, /model_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(model_name\\\)\\\) between 1 and 80/
  );
  assert.match(pgTap, /tab in outreach model_name is rejected/);
  assert.match(pgTap, /DEL in outreach model_name is rejected/);
  assert.match(pgTap, /model_name is null/);
});
