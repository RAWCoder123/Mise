import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005140000_mise_005hz_outreach_leads_fit_notes_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_fit_notes_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const outreachDomain = readFileSync(
  new URL("../services/domain/outreach.ts", import.meta.url),
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

test("MISE-005HZ pins outreach_leads.fit_notes CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_fit_notes_check check \(\s*fit_notes is null\s*or \(\s*length\(trim\(fit_notes\)\) between 1 and 500\s*and fit_notes collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`fit_notes collate "C" !~ E'${multilineControlClass}'`),
    "outreach_leads fit_notes CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(fit_notes)) between 1 and 500"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("fit_notes is null"), "nullability must be preserved");

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
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurants/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%business_name%'/,
    "must leave business_name bounds untouched when dropping prior fit_notes CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_name%'/,
    "must leave contact_name bounds untouched when dropping prior fit_notes CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%contact_basis%'/,
    "must leave contact_basis bounds untouched when dropping prior fit_notes CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%cuisine%'/,
    "must leave cuisine bounds untouched when dropping prior fit_notes CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_business_name_check'/,
    "must leave business_name CHECK untouched when dropping prior fit_notes CHECKs"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_leads_status_check'/,
    "must leave status CHECK untouched when dropping prior fit_notes CHECKs"
  );
});

test("original outreach_leads.fit_notes had no CHECK; domain writer bounds length 500", () => {
  assert.match(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?fit_notes text,/
  );
  assert.doesNotMatch(
    originalFoundation,
    /create table if not exists public\.outreach_leads \([\s\S]*?fit_notes text[^\n]*check/
  );
  assert.match(
    outreachDomain,
    /fitNotes:\s*optionalText\(input\.fitNotes,\s*"fitNotes",\s*500\)/
  );
  assert.match(
    outreachDomain,
    /function requireText\([\s\S]*?\/\[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\]\//
  );
});

test("fit_notes multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`fit_notes collate "C" !~ E'${multilineControlClass}'`),
    "SQL class must stay byte-aligned with unsafeSupplierSendMultilineControlPattern"
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
  assert.match(pgTap, /length\\\(trim\\\(fit_notes\\\)\\\) between 1 and 500/);
  assert.match(pgTap, /LF in outreach lead fit_notes is accepted/);
  assert.match(pgTap, /DEL in outreach lead fit_notes is rejected/);
  assert.match(pgTap, /outreach_leads business_name CHECK remains attachable/);
  assert.match(pgTap, /fit_notes CHECK stays dedicated \(excludes business_name\)/);
});
