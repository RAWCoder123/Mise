import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005180000_mise_005id_outreach_leads_cuisine_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_cuisine_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachDomain = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005ID pins outreach_leads.cuisine CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005ID"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_cuisine_check check \(\s*cuisine is null\s*or \(\s*length\(trim\(cuisine\)\) between 1 and 120\s*and cuisine collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`cuisine collate "C" !~ '[[:cntrl:]]'`),
    "cuisine CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(cuisine)) between 1 and 120"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("cuisine is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers, triggers, or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_business_name_check/,
    "must not reattach business_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_contact_name_check/,
    "must not reattach contact_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_fit_notes_check/,
    "must not reattach fit_notes CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_city_check/,
    "must not reattach city CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_state_check/,
    "must not reattach state CHECK by name rewrite"
  );
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
    /not ilike '%business_name%'/,
    "must leave business_name bounds untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_name%'/,
    "must leave contact_name bounds untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%fit_notes%'/,
    "must leave fit_notes bounds untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%city%'/,
    "must leave city bounds untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%state%'/,
    "must leave state bounds untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_business_name_check'/,
    "must leave business_name CHECK untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_contact_name_check'/,
    "must leave contact_name CHECK untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_fit_notes_check'/,
    "must leave fit_notes CHECK untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_city_check'/,
    "must leave city CHECK untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_state_check'/,
    "must leave state CHECK untouched when dropping prior cuisine CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_status_check'/,
    "must leave status CHECK untouched when dropping prior cuisine CHECKs"
  );
});

test("original cuisine had no CHECK; domain writer bounds length 120", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?cuisine text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?cuisine text[^\n]*check/
  );
  assert.match(
    outreachDomain,
    /cuisine:\s*optionalText\(input\.cuisine,\s*"cuisine",\s*120\)/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachLeadCuisine = (value: string | null) => {
    if (value === null) return true;
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachLeadCuisine(null), true);
  assert.equal(isAllowedOutreachLeadCuisine("Italian"), true);
  assert.equal(isAllowedOutreachLeadCuisine("Modern American"), true);
  assert.equal(isAllowedOutreachLeadCuisine("a".repeat(120)), true);
  assert.equal(isAllowedOutreachLeadCuisine("a".repeat(121)), false);
  assert.equal(isAllowedOutreachLeadCuisine(""), false);
  assert.equal(isAllowedOutreachLeadCuisine("   "), false);
  assert.equal(isAllowedOutreachLeadCuisine("Ita\tlian"), false);
  assert.equal(isAllowedOutreachLeadCuisine("Ita\nlian"), false);
  assert.equal(isAllowedOutreachLeadCuisine("Ita\u007flian"), false);
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

  assert.match(pgTap, /cuisine collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(cuisine\\\)\\\) between 1 and 120/
  );
  assert.match(
    pgTap,
    /outreach_leads business_name CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /outreach_leads status CHECK remains attachable/
  );
  assert.match(
    pgTap,
    /cuisine CHECK stays dedicated \(excludes business_name\)/
  );
  assert.match(
    pgTap,
    /cuisine CHECK stays dedicated \(excludes state\)/
  );
  assert.match(
    pgTap,
    /tab in outreach lead cuisine is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach lead cuisine is rejected under COLLATE C/
  );
});
