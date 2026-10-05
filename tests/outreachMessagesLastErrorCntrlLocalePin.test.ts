import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005120000_mise_005hx_outreach_messages_last_error_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_messages_last_error_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachAgent = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);
const outreachWebhook = readFileSync(
  new URL("../supabase/functions/outreach-webhook/index.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HX pins outreach_messages.last_error CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_last_error_check check \(\s*last_error is null\s*or \(\s*length\(trim\(last_error\)\) between 1 and 80\s*and last_error collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`last_error collate "C" !~ '[[:cntrl:]]'`),
    "outreach_messages last_error CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(last_error)) between 1 and 80"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("last_error is null"), "nullability must be preserved");

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
});

test("original outreach_messages.last_error had no CHECK; writers use short labels", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?last_error text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?last_error text[^\n]*check/
  );
  assert.match(outreachAgent, /last_error:\s*"provider_response_unknown"/);
  assert.match(outreachAgent, /last_error:\s*`resend_http_\$\{response\.status\}`/);
  assert.match(outreachWebhook, /last_error:\s*"provider_delivery_failed"/);
  assert.match(outreachWebhook, /last_error:\s*suppressionReason/);
  assert.match(
    originalFoundation,
    /last_error = 'recipient_unsubscribed'/
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

  assert.match(pgTap, /last_error collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(last_error\\\)\\\) between 1 and 80/
  );
  assert.match(pgTap, /tab in outreach last_error is rejected/);
  assert.match(pgTap, /DEL in outreach last_error is rejected/);
  assert.match(pgTap, /last_error is null/);
});
