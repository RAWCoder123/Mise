import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateOutreachCampaignActivatedAtEvidence } from "../services/domain/outreachCampaignActivatedAtEvidence";

const migrationPath =
  "supabase/migrations/20261128230000_outreach_campaign_activated_at_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/outreach_campaign_activated_at_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/outreachCampaignActivatedAtEvidence.ts",
  "utf8"
);
const outreachMigration = readFileSync(
  "supabase/migrations/20260718010000_outreach_agent.sql",
  "utf8"
);

test("validateOutreachCampaignActivatedAtEvidence rejects active without activated_at", () => {
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
      activatedAt: null,
    }),
    "missing_activated_at"
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
      activatedAt: "   ",
    }),
    "missing_activated_at"
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
      activatedAt: "",
    }),
    "missing_activated_at"
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
    }),
    "missing_activated_at"
  );
});

test("validateOutreachCampaignActivatedAtEvidence accepts draft/paused/completed and stamped active", () => {
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "draft",
      activatedAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "paused",
      activatedAt: null,
    }),
    null
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "completed",
      activatedAt: null,
    }),
    null
  );
  assert.equal(validateOutreachCampaignActivatedAtEvidence({}), null);
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
      activatedAt: "2026-11-28T11:00:00.000Z",
    }),
    null
  );
  assert.equal(
    validateOutreachCampaignActivatedAtEvidence({
      status: "active",
      activatedAt: new Date("2026-11-28T11:00:00.000Z"),
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT activated_at guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_outreach_campaign_activated_at_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.outreach_campaigns[\s\S]*enforce_outreach_campaign_activated_at_evidence/
  );
  assert.match(migration, /Outreach campaign activation time is required/);
  assert.match(migration, /new\.status = 'active'/);
  assert.match(migration, /new\.activated_at is null/);
  // No table-level NOT NULL / status-implies-timestamp CHECK — tip stays
  // INSERT-only and preserves draft/paused/completed rows and UPDATE escapes.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+activated_at\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'active'[\s\S]{0,120}activated_at\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_/i
  );
  assert.doesNotMatch(
    migration,
    /from\("outreach_campaigns"\)[\s\S]{0,80}\.(insert|update)/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_outreach_campaign_activated_at_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_activated_at/);
  // Column stays nullable; create writers INSERT draft without activation time.
  assert.match(outreachMigration, /activated_at timestamptz,/);
  assert.match(
    outreachMigration,
    /constraint outreach_campaign_activation_approved check \(status <> 'active' or approved_at is not null\)/
  );
  assert.match(
    outreachMigration,
    /status text not null default 'draft' check \(status in \('draft', 'active', 'paused', 'completed'\)\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null activate insert plus UPDATE escape", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm),
  ].length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 9);
  assert.match(pgTap, /Outreach campaign activation time is required/);
  assert.match(pgTap, /active status without activated_at/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
