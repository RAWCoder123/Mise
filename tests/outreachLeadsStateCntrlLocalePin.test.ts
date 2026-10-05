import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005170000_mise_005ic_outreach_leads_state_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_state_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachDomain = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IC pins outreach_leads.state CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_state_check check \(\s*state is null\s*or \(\s*length\(trim\(state\)\) between 1 and 80\s*and state collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`state collate "C" !~ '[[:cntrl:]]'`),
    "state CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(state)) between 1 and 80"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("state is null"), "nullability must be preserved");

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
    "must leave business_name bounds untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_name%'/,
    "must leave contact_name bounds untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%fit_notes%'/,
    "must leave fit_notes bounds untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%city%'/,
    "must leave city bounds untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%cuisine%'/,
    "must leave cuisine bounds untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_business_name_check'/,
    "must leave business_name CHECK untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_contact_name_check'/,
    "must leave contact_name CHECK untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_fit_notes_check'/,
    "must leave fit_notes CHECK untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_city_check'/,
    "must leave city CHECK untouched when dropping prior state CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_status_check'/,
    "must leave status CHECK untouched when dropping prior state CHECKs"
  );
});

test("original state had no CHECK; domain writer bounds length 80", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?state text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?state text[^\n]*check/
  );
  assert.match(
    outreachDomain,
    /state:\s*optionalText\(input\.state,\s*"state",\s*80\)/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachLeadState = (value: string | null) => {
    if (value === null) return true;
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 80 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachLeadState(null), true);
  assert.equal(isAllowedOutreachLeadState("TX"), true);
  assert.equal(isAllowedOutreachLeadState("California"), true);
  assert.equal(isAllowedOutreachLeadState("a".repeat(80)), true);
  assert.equal(isAllowedOutreachLeadState("a".repeat(81)), false);
  assert.equal(isAllowedOutreachLeadState(""), false);
  assert.equal(isAllowedOutreachLeadState("   "), false);
  assert.equal(isAllowedOutreachLeadState("T\tX"), false);
  assert.equal(isAllowedOutreachLeadState("T\nX"), false);
  assert.equal(isAllowedOutreachLeadState("T\u007fX"), false);
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

  assert.match(pgTap, /state collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(state\\\)\\\) between 1 and 80/
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
    /state CHECK stays dedicated \(excludes business_name\)/
  );
  assert.match(
    pgTap,
    /state CHECK stays dedicated \(excludes city\)/
  );
  assert.match(
    pgTap,
    /tab in outreach lead state is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach lead state is rejected under COLLATE C/
  );
});
