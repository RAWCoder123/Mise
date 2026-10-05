import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005060000_mise_005hr_outreach_campaigns_value_proposition_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaigns_value_proposition_cntrl_locale_pin.test.sql",
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

test("MISE-005HR pins value_proposition CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_value_proposition_check check \(\s*char_length\(btrim\(value_proposition\)\) between 1 and 800\s*and value_proposition collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(
      `value_proposition collate "C" !~ E'${multilineControlClass}'`
    ),
    "value_proposition CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      "char_length(btrim(value_proposition)) between 1 and 800"
    ),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_name_check/,
    "must not reattach campaign name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_company_name_check/,
    "must not reattach company_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_sender_name_check/,
    "must not reattach sender_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_company_postal_address_check/,
    "must not reattach company_postal_address CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_audience_description_check/,
    "must not reattach audience_description CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_status_check/,
    "must not reattach status CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaigns_timezone_check/,
    "must not reattach timezone CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_leads/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%company_name%'/,
    "must leave company_name bounds untouched when dropping prior value_proposition CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%sender_name%'/,
    "must leave sender_name bounds untouched when dropping prior value_proposition CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%company_postal_address%'/,
    "must leave company_postal_address bounds untouched when dropping prior value_proposition CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%audience_description%'/,
    "must leave audience_description bounds untouched when dropping prior value_proposition CHECKs"
  );
});

test("original value_proposition CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?value_proposition text not null check \(char_length\(btrim\(value_proposition\)\) between 1 and 800\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?value_proposition text not null check \(char_length\(btrim\(value_proposition\)\) between 1 and 800\)[\s\S]{0,160}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("multiline value-proposition contract matches supplier-send allowlist and length bound", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const isAllowedOutreachCampaignValueProposition = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 800 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste without a corporate ops team"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\nwithout a corporate ops team"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\twithout a corporate ops team"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\rwithout a corporate ops team"
    ),
    true
  );
  assert.equal(isAllowedOutreachCampaignValueProposition(""), false);
  assert.equal(isAllowedOutreachCampaignValueProposition("   "), false);
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\u0008without a corporate ops team"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\u000bwithout a corporate ops team"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition(
      "Cut stockouts and waste\u007fwithout a corporate ops team"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition("a".repeat(800)),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignValueProposition("a".repeat(801)),
    false
  );
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
    /char_length\\\(btrim\\\(value_proposition\\\)\\\) between 1 and 800/
  );
  assert.match(
    pgTap,
    /outreach_campaigns audience_description CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /value_proposition CHECK stays dedicated \(excludes audience_description\)/
  );
  assert.match(
    pgTap,
    /LF in outreach campaign value proposition is accepted under multiline-aware gate/
  );
  assert.match(
    pgTap,
    /DEL in outreach campaign value proposition is rejected under COLLATE C/
  );
});
