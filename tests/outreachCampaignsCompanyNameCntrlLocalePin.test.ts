import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005000000_mise_005hl_outreach_campaigns_company_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaigns_company_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HL pins outreach_campaigns.company_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_company_name_check check \(\s*char_length\(btrim\(company_name\)\) between 1 and 120\s*and company_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`company_name collate "C" !~ '[[:cntrl:]]'`),
    "company_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(company_name)) between 1 and 120"),
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
  assert.match(
    migration,
    /not ilike '%sender_name%'/,
    "must leave sender_name bounds untouched when dropping prior company_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%company_postal_address%'/,
    "must leave company_postal_address bounds untouched when dropping prior company_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%audience_description%'/,
    "must leave audience_description bounds untouched when dropping prior company_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%value_proposition%'/,
    "must leave value_proposition bounds untouched when dropping prior company_name CHECKs"
  );
});

test("original company_name CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?company_name text not null default 'Mise' check \(char_length\(btrim\(company_name\)\) between 1 and 120\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?company_name text not null default 'Mise' check \(char_length\(btrim\(company_name\)\) between 1 and 120\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("char_length(btrim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachCampaignCompanyName = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachCampaignCompanyName("Mise"), true);
  assert.equal(isAllowedOutreachCampaignCompanyName("Acme Foods"), true);
  assert.equal(isAllowedOutreachCampaignCompanyName("a".repeat(120)), true);
  assert.equal(isAllowedOutreachCampaignCompanyName("a".repeat(121)), false);
  assert.equal(isAllowedOutreachCampaignCompanyName(""), false);
  assert.equal(isAllowedOutreachCampaignCompanyName("   "), false);
  assert.equal(isAllowedOutreachCampaignCompanyName("Mise\tCo"), false);
  assert.equal(isAllowedOutreachCampaignCompanyName("Mise\nCo"), false);
  assert.equal(isAllowedOutreachCampaignCompanyName("Mise\u007fCo"), false);
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

  assert.match(pgTap, /company_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(company_name\\\)\\\) between 1 and 120/
  );
  assert.match(
    pgTap,
    /outreach_campaigns name CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /company_name CHECK stays dedicated \(excludes sender_name\)/
  );
  assert.match(
    pgTap,
    /tab in outreach campaign company_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach campaign company_name is rejected under COLLATE C/
  );
});
