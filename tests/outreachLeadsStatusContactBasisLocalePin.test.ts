import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930320000_mise_005dr_outreach_leads_status_contact_basis_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260718010000_outreach_agent.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/outreach_leads_status_contact_basis_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DR pins outreach_leads status and contact_basis CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint outreach_leads_status_check\s+check \(\s*status in \(\s*'new',\s*'approved',\s*'contacted',\s*'replied',\s*'interested',\s*'not_interested',\s*'unsubscribed',\s*'bounced',\s*'invalid'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint outreach_leads_contact_basis_check\s+check \(\s*contact_basis in \('public_business_contact', 'referral', 'opt_in'\)\s*and contact_basis collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`contact_basis collate "C" ~ '${TOKEN_PATTERN}'`),
    "contact_basis CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'new'") &&
      migration.includes("'approved'") &&
      migration.includes("'contacted'") &&
      migration.includes("'replied'") &&
      migration.includes("'interested'") &&
      migration.includes("'not_interested'") &&
      migration.includes("'unsubscribed'") &&
      migration.includes("'bounced'") &&
      migration.includes("'invalid'"),
    "exact status allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'public_business_contact'") &&
      migration.includes("'referral'") &&
      migration.includes("'opt_in'"),
    "exact contact_basis allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_campaigns/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_enrollments/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_suppressions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_agent_runs/i);
  assert.doesNotMatch(sqlBody, /claimed_from_status/);
  assert.doesNotMatch(sqlBody, /generation_provider/);
});

test("original outreach_leads vocabulary used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /contact_basis text not null check \(contact_basis in \('public_business_contact', 'referral', 'opt_in'\)\)/
  );
  assert.match(
    original,
    /status text not null default 'new' check \(\s*status in \('new', 'approved', 'contacted', 'replied', 'interested', 'not_interested', 'unsubscribed', 'bounced', 'invalid'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /contact_basis collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins outreach_leads vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(28\)/);
  assert.match(pgTap, /outreach_leads_status_check exists/);
  assert.match(pgTap, /outreach_leads status CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_leads status CHECK uses COLLATE C/);
  assert.match(pgTap, /outreach_leads_contact_basis_check exists/);
  assert.match(pgTap, /outreach_leads contact_basis CHECK keeps exact allowlist/);
  assert.match(pgTap, /outreach_leads contact_basis CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token new matches under COLLATE C/);
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token contacted matches under COLLATE C/);
  assert.match(pgTap, /writer token replied matches under COLLATE C/);
  assert.match(pgTap, /writer token interested matches under COLLATE C/);
  assert.match(pgTap, /writer token not_interested matches under COLLATE C/);
  assert.match(pgTap, /writer token unsubscribed matches under COLLATE C/);
  assert.match(pgTap, /writer token bounced matches under COLLATE C/);
  assert.match(pgTap, /writer token invalid matches under COLLATE C/);
  assert.match(pgTap, /writer token public_business_contact matches under COLLATE C/);
  assert.match(pgTap, /writer token referral matches under COLLATE C/);
  assert.match(pgTap, /writer token opt_in matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced contact_basis token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty contact_basis token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated contact_basis token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII contact_basis token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
  assert.match(pgTap, /all allowlisted contact_basis tokens match under COLLATE C/);
});
