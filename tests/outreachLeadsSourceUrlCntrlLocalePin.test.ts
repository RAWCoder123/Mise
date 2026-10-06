import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007040000_mise_005ir_outreach_leads_source_url_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_leads_source_url_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IR pins outreach_leads.source_url CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IR"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint outreach_leads_source_url_check check \(/i
  );
  assert.match(
    migration,
    /source_url collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(source_url\) between 1 and 2048/
  );
  assert.ok(
    migration.includes(`source_url collate "C" ~* '^https?://'`),
    "source_url CHECK must keep https?:// protocol under COLLATE C"
  );
  assert.doesNotMatch(
    migration,
    /source_url is null/i,
    "source_url is NOT NULL — CHECK must not include a null OR"
  );

  // Compose: CHECK-only. Do not rewrite outreach writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /outreach_campaigns/);
  assert.doesNotMatch(sqlBody, /\bcta_url\b/);
  assert.doesNotMatch(sqlBody, /logo_url/);
  assert.doesNotMatch(sqlBody, /restaurants/);
  assert.match(
    migration,
    /not ilike '%website%'/,
    "must leave website vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%business_name%'/,
    "must leave business_name vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%contact_name%'/,
    "must leave contact_name vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%fit_notes%'/,
    "must leave fit_notes vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%cuisine%'/,
    "must leave cuisine vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%city%'/,
    "must leave city vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%state%'/,
    "must leave state vocabulary untouched"
  );
  assert.match(
    migration,
    /conname is distinct from 'outreach_lead_website_url'/,
    "must not drop lead website CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_lead_website_url/i
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_(business_name|contact_name|fit_notes|cuisine|city|state)/i
  );
});

test("foundation originally left source_url protocol-only without length/cntrl", () => {
  assert.ok(
    foundation.includes(
      "source_url text not null check (source_url ~* '^https?://')"
    ),
    "foundation must declare NOT NULL protocol-prefix-only source_url CHECK"
  );
  assert.doesNotMatch(foundation, /source_url collate "C"/);
  assert.doesNotMatch(foundation, /length\(source_url\) between 1 and 2048/);
  assert.doesNotMatch(foundation, /source_url[^\n]*\[\[:cntrl:\]\]/);
});

test("pgTAP fixture pins source_url CHECK site with plan derived from call sites", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionSites = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    assertionSites.length,
    planned,
    `plan(${planned}) must equal ${assertionSites.length} assertion call sites counted from source`
  );
  assert.equal(planned, 10, "expected 10 independently counted assertion sites");

  assert.match(pgTap, /outreach_leads_source_url_check/);
  assert.match(pgTap, /source_url CHECK pins length 1–2048 bound/);
  assert.match(pgTap, /source_url CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /source_url CHECK keeps https\?:\/{2} protocol under COLLATE C/);
  assert.match(pgTap, /printable HTTPS source_url is not a control under COLLATE C/);
  assert.match(pgTap, /printable HTTP source_url is not a control under COLLATE C/);
  assert.match(pgTap, /ASCII tab in source_url is a control under COLLATE C/);
  assert.match(pgTap, /ASCII newline in source_url is a control under COLLATE C/);
  assert.match(pgTap, /ASCII DEL in source_url is a control under COLLATE C/);
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
