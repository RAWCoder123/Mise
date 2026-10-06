import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007020000_mise_005ip_outreach_campaigns_cta_url_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/outreach_campaigns_cta_url_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005IP pins outreach_campaigns.cta_url CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IP"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint outreach_campaign_cta_url check \(/i
  );
  assert.match(
    migration,
    /cta_url collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(cta_url\) between 1 and 2048/
  );
  assert.ok(
    migration.includes(`cta_url collate "C" ~* '^https?://'`),
    "cta_url CHECK must keep https?:// protocol under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite outreach writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /outreach_leads/);
  assert.doesNotMatch(sqlBody, /\bwebsite\b/);
  assert.doesNotMatch(sqlBody, /logo_url/);
  assert.doesNotMatch(sqlBody, /restaurants/);
  assert.match(
    migration,
    /not ilike '%send_window%'/,
    "must leave send_window CHECK composition untouched"
  );
  assert.match(
    migration,
    /not ilike '%weekdays%'/,
    "must leave weekdays CHECK composition untouched"
  );
  assert.match(
    migration,
    /not ilike '%approved_at%'/,
    "must leave activation CHECK composition untouched"
  );
  assert.match(
    migration,
    /not ilike '%company_name%'/,
    "must leave company_name vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%sender_name%'/,
    "must leave sender_name vocabulary untouched"
  );
  assert.match(
    migration,
    /not ilike '%timezone%'/,
    "must leave timezone CHECK composition untouched"
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint outreach_campaign_(company_name|sender_name|timezone)/i
  );});

test("foundation originally left cta_url protocol-only without length/cntrl", () => {
  assert.ok(
    foundation.includes(
      "constraint outreach_campaign_cta_url check (cta_url is null or cta_url ~* '^https?://')"
    ),
    "foundation must declare protocol-prefix-only cta_url CHECK"
  );
  assert.doesNotMatch(foundation, /cta_url collate "C"/);
  assert.doesNotMatch(foundation, /length\(cta_url\) between 1 and 2048/);
  assert.doesNotMatch(foundation, /cta_url[^\n]*\[\[:cntrl:\]\]/);
});

test("pgTAP fixture pins cta_url CHECK site with plan derived from call sites", () => {
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

  assert.match(pgTap, /outreach_campaign_cta_url/);
  assert.match(pgTap, /cta_url CHECK pins length 1–2048 bound/);
  assert.match(pgTap, /cta_url CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /cta_url CHECK keeps https\?:\/{2} protocol under COLLATE C/);
  assert.match(pgTap, /printable HTTPS CTA URL is not a control under COLLATE C/);
  assert.match(pgTap, /printable HTTP CTA URL is not a control under COLLATE C/);
  assert.match(pgTap, /ASCII tab in CTA URL is a control under COLLATE C/);
  assert.match(pgTap, /ASCII newline in CTA URL is a control under COLLATE C/);
  assert.match(pgTap, /ASCII DEL in CTA URL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
