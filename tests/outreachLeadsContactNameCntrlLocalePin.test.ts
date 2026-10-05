import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005150000_mise_005ia_outreach_leads_contact_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_contact_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachDomain = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IA pins outreach_leads.contact_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_contact_name_check check \(\s*contact_name is null\s*or \(\s*length\(trim\(contact_name\)\) between 1 and 120\s*and contact_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`contact_name collate "C" !~ '[[:cntrl:]]'`),
    "contact_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(contact_name)) between 1 and 120"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("contact_name is null"), "nullability must be preserved");

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
    /add constraint outreach_leads_fit_notes_check/,
    "must not reattach fit_notes CHECK by name rewrite"
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
    "must leave business_name bounds untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_basis%'/,
    "must leave contact_basis bounds untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%fit_notes%'/,
    "must leave fit_notes bounds untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%cuisine%'/,
    "must leave cuisine bounds untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_business_name_check'/,
    "must leave business_name CHECK untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_fit_notes_check'/,
    "must leave fit_notes CHECK untouched when dropping prior contact_name CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_status_check'/,
    "must leave status CHECK untouched when dropping prior contact_name CHECKs"
  );
});

test("original contact_name had no CHECK; domain writer bounds length 120", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?contact_name text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?contact_name text[^\n]*check/
  );
  assert.match(
    outreachDomain,
    /contactName:\s*optionalText\(input\.contactName,\s*"contactName",\s*120\)/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedOutreachLeadContactName = (value: string | null) => {
    if (value === null) return true;
    const trimmed = value.trim();
    return (
      trimmed.length >= 1 &&
      trimmed.length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedOutreachLeadContactName(null), true);
  assert.equal(isAllowedOutreachLeadContactName("Jordan Lee"), true);
  assert.equal(isAllowedOutreachLeadContactName("José García"), true);
  assert.equal(isAllowedOutreachLeadContactName("a".repeat(120)), true);
  assert.equal(isAllowedOutreachLeadContactName("a".repeat(121)), false);
  assert.equal(isAllowedOutreachLeadContactName(""), false);
  assert.equal(isAllowedOutreachLeadContactName("   "), false);
  assert.equal(isAllowedOutreachLeadContactName("Jordan\tLee"), false);
  assert.equal(isAllowedOutreachLeadContactName("Jordan\nLee"), false);
  assert.equal(isAllowedOutreachLeadContactName("Jordan\u007fLee"), false);
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

  assert.match(pgTap, /contact_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(contact_name\\\)\\\) between 1 and 120/
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
    /contact_name CHECK stays dedicated \(excludes business_name\)/
  );
  assert.match(
    pgTap,
    /contact_name CHECK stays dedicated \(excludes contact_basis\)/
  );
  assert.match(
    pgTap,
    /tab in outreach lead contact_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in outreach lead contact_name is rejected under COLLATE C/
  );
});
