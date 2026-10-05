import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005100000_mise_005hv_outreach_messages_subject_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_messages_subject_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HV pins outreach_messages.subject CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_subject_check check \(\s*char_length\(btrim\(subject\)\) between 1 and 78\s*and subject collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`subject collate "C" !~ '[[:cntrl:]]'`),
    "subject CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(subject)) between 1 and 78"),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_body_text_check/,
    "must not reattach body_text CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_body_html_check/,
    "must not reattach body_html CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_personalization_note_check/,
    "must not reattach personalization_note CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_status_check/,
    "must not reattach status CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_generation_provider_check/,
    "must not reattach generation_provider CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.match(
    migration,
    /not ilike '%body_text%'/,
    "must leave body_text bounds untouched when dropping prior subject CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%body_html%'/,
    "must leave body_html bounds untouched when dropping prior subject CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%personalization_note%'/,
    "must leave personalization_note bounds untouched when dropping prior subject CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched when dropping prior subject CHECKs"
  );
});

test("original subject CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?subject text not null check \(char_length\(btrim\(subject\)\) between 1 and 78\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?subject text not null check \(char_length\(btrim\(subject\)\) between 1 and 78\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("char_length(btrim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachMessageSubject = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 78 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachMessageSubject("Cut food cost without new staff"), true);
  assert.equal(isAllowedOutreachMessageSubject("Tonight's prep stays on track"), true);
  assert.equal(isAllowedOutreachMessageSubject("a".repeat(78)), true);
  assert.equal(isAllowedOutreachMessageSubject("a".repeat(79)), false);
  assert.equal(isAllowedOutreachMessageSubject(""), false);
  assert.equal(isAllowedOutreachMessageSubject("   "), false);
  assert.equal(isAllowedOutreachMessageSubject("Cut food\tcost without new staff"), false);
  assert.equal(isAllowedOutreachMessageSubject("Cut food\ncost without new staff"), false);
  assert.equal(isAllowedOutreachMessageSubject("Cut food\u007fcost without new staff"), false);
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

  assert.match(pgTap, /subject collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(subject\\\)\\\) between 1 and 78/
  );
  assert.match(
    pgTap,
    /outreach_messages body_text CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /subject CHECK stays dedicated \(excludes body_text\)/
  );
  assert.match(
    pgTap,
    /tab in outreach message subject is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach message subject is rejected under COLLATE C/
  );
});
