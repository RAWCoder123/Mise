import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005080000_mise_005ht_outreach_messages_body_text_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_messages_body_text_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = [
  "[",
  "\\x00-\\x08",
  "\\x0B",
  "\\x0C",
  "\\x0E-\\x1F",
  "\\x7F",
  "]",
].join("");

test("MISE-005HT pins body_text CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_messages_body_text_check check \(\s*char_length\(btrim\(body_text\)\) between 1 and 4000\s*and body_text collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(
      `body_text collate "C" !~ E'${multilineControlClass}'`
    ),
    "body_text CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(body_text)) between 1 and 4000"),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_messages_subject_check/,
    "must not reattach subject CHECK by name rewrite"
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
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%subject%'/,
    "must leave subject bounds untouched when dropping prior body_text CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%body_html%'/,
    "must leave body_html bounds untouched when dropping prior body_text CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%personalization_note%'/,
    "must leave personalization_note bounds untouched when dropping prior body_text CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched when dropping prior body_text CHECKs"
  );
});

test("original body_text CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?body_text text not null check \(char_length\(btrim\(body_text\)\) between 1 and 4000\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_messages \([\s\S]*?body_text text not null check \(char_length\(btrim\(body_text\)\) between 1 and 4000\)[\s\S]{0,160}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("multiline body-text contract matches supplier-send allowlist and length bound", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const isAllowedOutreachMessageBodyText = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 4000 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff."
    ),
    true
  );
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\nMise helps independent kitchens plan inventory."
    ),
    true
  );
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\tMise helps independent kitchens plan inventory."
    ),
    true
  );
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\rMise helps independent kitchens plan inventory."
    ),
    true
  );
  assert.equal(isAllowedOutreachMessageBodyText(""), false);
  assert.equal(isAllowedOutreachMessageBodyText("   "), false);
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\u0008Mise helps independent kitchens plan inventory."
    ),
    false
  );
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\u000bMise helps independent kitchens plan inventory."
    ),
    false
  );
  assert.equal(
    isAllowedOutreachMessageBodyText(
      "Thanks for running your restaurant.\u007fMise helps independent kitchens plan inventory."
    ),
    false
  );
  assert.equal(isAllowedOutreachMessageBodyText("a".repeat(4000)), true);
  assert.equal(isAllowedOutreachMessageBodyText("a".repeat(4001)), false);
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

  assert.ok(
    pgTap.includes(`!~ E'${multilineControlClass}'`),
    "pgTAP must exercise the exact COLLATE C multiline control class"
  );
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(body_text\\\)\\\) between 1 and 4000/
  );
  assert.match(pgTap, /outreach_messages body_html CHECK remains attachable/);
  assert.match(pgTap, /body_text CHECK stays dedicated \(excludes body_html\)/);
  assert.match(
    pgTap,
    /LF in outreach message body text is accepted under multiline-aware gate/
  );
  assert.match(
    pgTap,
    /DEL in outreach message body text is rejected under COLLATE C/
  );
});
