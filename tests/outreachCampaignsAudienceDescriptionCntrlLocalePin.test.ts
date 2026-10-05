import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005050000_mise_005hq_outreach_campaigns_audience_description_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaigns_audience_description_cntrl_locale_pin.test.sql",
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

test("MISE-005HQ pins audience_description CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_audience_description_check check \(\s*char_length\(btrim\(audience_description\)\) between 1 and 500\s*and audience_description collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(
      `audience_description collate "C" !~ E'${multilineControlClass}'`
    ),
    "audience_description CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      "char_length(btrim(audience_description)) between 1 and 500"
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
    /add constraint outreach_campaigns_value_proposition_check/,
    "must not reattach value_proposition CHECK by name rewrite"
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
    "must leave company_name bounds untouched when dropping prior audience CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%sender_name%'/,
    "must leave sender_name bounds untouched when dropping prior audience CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%company_postal_address%'/,
    "must leave company_postal_address bounds untouched when dropping prior audience CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%value_proposition%'/,
    "must leave value_proposition bounds untouched when dropping prior audience CHECKs"
  );
});

test("original audience_description CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?audience_description text not null check \(char_length\(btrim\(audience_description\)\) between 1 and 500\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?audience_description text not null check \(char_length\(btrim\(audience_description\)\) between 1 and 500\)[\s\S]{0,160}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("multiline audience-description contract matches supplier-send allowlist and length bound", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const isAllowedOutreachCampaignAudienceDescription = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 500 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants in Austin with 20-60 seats"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\nin Austin with 20-60 seats"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\tin Austin"
    ),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\rin Austin"
    ),
    true
  );
  assert.equal(isAllowedOutreachCampaignAudienceDescription(""), false);
  assert.equal(isAllowedOutreachCampaignAudienceDescription("   "), false);
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\u0008in Austin"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\u000bin Austin"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription(
      "Independent restaurants\u007fin Austin"
    ),
    false
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription("a".repeat(500)),
    true
  );
  assert.equal(
    isAllowedOutreachCampaignAudienceDescription("a".repeat(501)),
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
    /char_length\\\(btrim\\\(audience_description\\\)\\\) between 1 and 500/
  );
  assert.match(
    pgTap,
    /outreach_campaigns value_proposition CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /audience_description CHECK stays dedicated \(excludes value_proposition\)/
  );
  assert.match(
    pgTap,
    /LF in outreach campaign audience description is accepted under multiline-aware gate/
  );
  assert.match(
    pgTap,
    /DEL in outreach campaign audience description is rejected under COLLATE C/
  );
});
