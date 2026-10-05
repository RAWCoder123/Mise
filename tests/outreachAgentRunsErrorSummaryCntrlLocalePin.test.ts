import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005130000_mise_005hy_outreach_agent_runs_error_summary_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_agent_runs_error_summary_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachAgent = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join("");

test("MISE-005HY pins outreach_agent_runs.error_summary CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_agent_runs_error_summary_check check \(\s*error_summary is null\s*or \(\s*length\(trim\(error_summary\)\) between 1 and 1000\s*and error_summary collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`error_summary collate "C" !~ E'${multilineControlClass}'`),
    "outreach_agent_runs error_summary CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(error_summary)) between 1 and 1000"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("error_summary is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /outreach_messages/i);
  assert.doesNotMatch(sqlBody, /outreach_events/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /outreach_leads/i);
  assert.doesNotMatch(sqlBody, /last_error/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /action_outcomes/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%campaigns_checked%'/,
    "must leave campaigns_checked bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%blocked_count%'/,
    "must leave blocked_count bounds untouched"
  );
});

test("original outreach_agent_runs.error_summary had no CHECK; writers bound length", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_agent_runs \([\s\S]*?error_summary text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_agent_runs \([\s\S]*?error_summary text[^\n]*check/
  );
  assert.match(
    outreachAgent,
    /error_summary:\s*summary\.errors\.length \? summary\.errors\.slice\(0,\s*5\)\.join\(" "\)\.slice\(0,\s*1_000\)\s*:\s*null/
  );
  assert.match(
    outreachAgent,
    /error_summary:\s*safeError\(error\)/
  );
  assert.match(
    outreachAgent,
    /function safeError\(error: unknown\)[\s\S]*?\.slice\(0,\s*500\)/
  );
});

test("error_summary multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`error_summary collate "C" !~ E'${multilineControlClass}'`),
    "SQL class must stay byte-aligned with unsafeSupplierSendMultilineControlPattern"
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

  assert.ok(
    pgTap.includes(`!~ E'${multilineControlClass}'`),
    "pgTAP must exercise the exact COLLATE C multiline control class"
  );
  assert.match(pgTap, /length\\\(trim\\\(error_summary\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in outreach agent error_summary is accepted/);
  assert.match(pgTap, /DEL in outreach agent error_summary is rejected/);
});
