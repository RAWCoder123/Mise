import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005110000_mise_005hw_outreach_events_event_type_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_events_event_type_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HW pins outreach_events.event_type CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_events_event_type_check check \(\s*char_length\(btrim\(event_type\)\) between 1 and 100\s*and event_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`event_type collate "C" !~ '[[:cntrl:]]'`),
    "event_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(event_type)) between 1 and 100"),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_events_provider_event_id_check/,
    "must not reattach provider_event_id CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_events_provider_message_id_check/,
    "must not reattach provider_message_id CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.match(
    migration,
    /not ilike '%provider_event_id%'/,
    "must leave provider_event_id bounds untouched when dropping prior event_type CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%provider_message_id%'/,
    "must leave provider_message_id bounds untouched when dropping prior event_type CHECKs"
  );
});

test("original event_type CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_events \([\s\S]*?event_type text not null check \(char_length\(btrim\(event_type\)\) between 1 and 100\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_events \([\s\S]*?event_type text not null check \(char_length\(btrim\(event_type\)\) between 1 and 100\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("char_length(btrim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachEventType = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 100 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachEventType("email.delivered"), true);
  assert.equal(isAllowedOutreachEventType("email.bounced"), true);
  assert.equal(isAllowedOutreachEventType("email.complained"), true);
  assert.equal(isAllowedOutreachEventType("a".repeat(100)), true);
  assert.equal(isAllowedOutreachEventType("a".repeat(101)), false);
  assert.equal(isAllowedOutreachEventType(""), false);
  assert.equal(isAllowedOutreachEventType("   "), false);
  assert.equal(isAllowedOutreachEventType("email.\tdelivered"), false);
  assert.equal(isAllowedOutreachEventType("email.\ndelivered"), false);
  assert.equal(isAllowedOutreachEventType("email.\u007fdelivered"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /event_type collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(event_type\\\)\\\) between 1 and 100/
  );
  assert.match(
    pgTap,
    /outreach_events provider_event_id UNIQUE remains intact/
  );
  assert.match(
    pgTap,
    /event_type CHECK stays dedicated \(excludes provider_event_id\)/
  );
  assert.match(pgTap, /exactly one event_type_check constraint is attached/);
});
