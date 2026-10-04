import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005030000_mise_005ho_outreach_leads_business_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_business_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HO pins outreach_leads.business_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_business_name_check check \(\s*char_length\(btrim\(business_name\)\) between 1 and 160\s*and business_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`business_name collate "C" !~ '[[:cntrl:]]'`),
    "business_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(business_name)) between 1 and 160"),
    "exact char_length(btrim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_status_check/,
    "must not reattach status CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_contact_basis_check/,
    "must not reattach contact_basis CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_email_check/,
    "must not reattach email CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_source_url_check/,
    "must not reattach source_url CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_lead_website_url/,
    "must not reattach website URL CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_enrollments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.match(
    migration,
    /not ilike '%contact_basis%'/,
    "must leave contact_basis bounds untouched when dropping prior business_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_name%'/,
    "must leave contact_name bounds untouched when dropping prior business_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%source_url%'/,
    "must leave source_url bounds untouched when dropping prior business_name CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_status_check'/,
    "must leave status CHECK untouched when dropping prior business_name CHECKs"
  );
});

test("original business_name CHECK had char_length(btrim) only without cntrl gate", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?business_name text not null check \(char_length\(btrim\(business_name\)\) between 1 and 160\)/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?business_name text not null check \(char_length\(btrim\(business_name\)\) between 1 and 160\)[\s\S]{0,120}\[\[:cntrl:\]\]/
  );
});

test("char_length(btrim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachLeadBusinessName = (value: string) => {
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 160 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachLeadBusinessName("Harbor Kitchen"), true);
  assert.equal(isAllowedOutreachLeadBusinessName("Café Norte"), true);
  assert.equal(isAllowedOutreachLeadBusinessName("a".repeat(160)), true);
  assert.equal(isAllowedOutreachLeadBusinessName("a".repeat(161)), false);
  assert.equal(isAllowedOutreachLeadBusinessName(""), false);
  assert.equal(isAllowedOutreachLeadBusinessName("   "), false);
  assert.equal(isAllowedOutreachLeadBusinessName("Harbor\tKitchen"), false);
  assert.equal(isAllowedOutreachLeadBusinessName("Harbor\nKitchen"), false);
  assert.equal(isAllowedOutreachLeadBusinessName("Harbor\u007fKitchen"), false);
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

  assert.match(pgTap, /business_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(business_name\\\)\\\) between 1 and 160/
  );
  assert.match(
    pgTap,
    /outreach_leads status CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /business_name CHECK stays dedicated \(excludes contact_basis\)/
  );
  assert.match(
    pgTap,
    /tab in outreach lead business_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach lead business_name is rejected under COLLATE C/
  );
});
