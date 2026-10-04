import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005020000_mise_005hn_outreach_campaigns_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaigns_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HN pins outreach_campaigns.name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_campaigns_name_check check \(\s*char_length\(btrim\(name\)\) between 1 and 160\s*and name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`name collate "C" !~ '[[:cntrl:]]'`),
    "name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(name)) between 1 and 160"),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
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
    /not ilike '%company_name%'/,
    "must leave company_name bounds untouched when dropping prior name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%sender_name%'/,
    "must leave sender_name bounds untouched when dropping prior name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%company_postal_address%'/,
    "must leave company_postal_address bounds untouched when dropping prior name CHECKs"
  );
  assert.match(
    migration,
    /\\\\yname\\\\y|\\yname\\y/,
    "must use word-boundary matching so company_name/sender_name are not mistaken for bare name"
  );
});

test("original name CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?name text not null check \(char_length\(btrim\(name\)\) between 1 and 160\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_campaigns \([\s\S]*?name text not null check \(char_length\(btrim\(name\)\) between 1 and 160\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("char_length(btrim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachCampaignName = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 160 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachCampaignName("Pilot Launch"), true);
  assert.equal(isAllowedOutreachCampaignName("NYC Independent Restaurants"), true);
  assert.equal(isAllowedOutreachCampaignName("a".repeat(160)), true);
  assert.equal(isAllowedOutreachCampaignName("a".repeat(161)), false);
  assert.equal(isAllowedOutreachCampaignName(""), false);
  assert.equal(isAllowedOutreachCampaignName("   "), false);
  assert.equal(isAllowedOutreachCampaignName("Pilot\tLaunch"), false);
  assert.equal(isAllowedOutreachCampaignName("Pilot\nLaunch"), false);
  assert.equal(isAllowedOutreachCampaignName("Pilot\u007fLaunch"), false);
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

  assert.match(pgTap, /name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(name\\\)\\\) between 1 and 160/
  );
  assert.match(
    pgTap,
    /outreach_campaigns company_name CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /name CHECK stays dedicated \(excludes sender_name\)/
  );
  assert.match(
    pgTap,
    /tab in outreach campaign name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach campaign name is rejected under COLLATE C/
  );
});
