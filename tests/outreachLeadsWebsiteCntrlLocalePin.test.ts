import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007030000_mise_005iq_outreach_leads_website_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_leads_website_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IQ pins outreach_leads.website CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IQ"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint outreach_lead_website_url check \(/i
  );
  assert.match(
    migration,
    /website collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(website\) between 1 and 2048/
  );
  assert.ok(
    migration.includes(`website collate "C" ~* '^https?://'`),
    "website CHECK must keep https?:// protocol under COLLATE C"
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
    /not ilike '%source_url%'/,
    "must leave source_url vocabulary untouched"
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
    /conname is distinct from 'outreach_leads_source_url_check'/,
    "must not drop lead source_url CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_leads_(source_url|business_name|contact_name|fit_notes|cuisine|city|state)/i
  );
});

test("foundation originally left website protocol-only without length/cntrl", () => {
  assert.ok(
    foundation.includes(
      "constraint outreach_lead_website_url check (website is null or website ~* '^https?://')"
    ),
    "foundation must declare protocol-prefix-only website CHECK"
  );
  assert.doesNotMatch(foundation, /website collate "C"/);
  assert.doesNotMatch(foundation, /length\(website\) between 1 and 2048/);
  assert.doesNotMatch(foundation, /website[^\n]*\[\[:cntrl:\]\]/);
});

test("pgTAP fixture pins website CHECK site with plan derived from call sites", () => {
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

  assert.match(pgTap, /outreach_lead_website_url/);
  assert.match(pgTap, /website CHECK pins length 1–2048 bound/);
  assert.match(pgTap, /website CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /website CHECK keeps https\?:\/{2} protocol under COLLATE C/);
  assert.match(pgTap, /printable HTTPS website URL is not a control under COLLATE C/);
  assert.match(pgTap, /printable HTTP website URL is not a control under COLLATE C/);
  assert.match(pgTap, /ASCII tab in website URL is a control under COLLATE C/);
  assert.match(pgTap, /ASCII newline in website URL is a control under COLLATE C/);
  assert.match(pgTap, /ASCII DEL in website URL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
