import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("scripts/staging-backup-restore-check.mjs", "utf8");
const recovery = readFileSync("docs/operations/RECOVERY.md", "utf8");
const incident = readFileSync("docs/operations/INCIDENT_RESPONSE.md", "utf8");
const evidence = JSON.parse(
  readFileSync(
    "docs/launch/evidence/recovery/2026-07-27-staging-restore.json",
    "utf8"
  )
);

test("restore proof rejects production and verifies content before cleanup", () => {
  assert.match(script, /SUPABASE_PRODUCTION_PROJECT_REF/);
  assert.match(script, /assertStagingPreflight/);
  assert.match(script, /PGSSLMODE:\s*"require"/);
  assert.match(script, /content_digest/);
  assert.match(script, /row_count/);
  assert.match(script, /ephemeral_cluster_removed/);
  assert.doesNotMatch(script, /SUPABASE_STAGING_SECRET_KEY/);
});

test("recorded recovery evidence is content-free and states its boundary", () => {
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.tables_verified, 43);
  assert.equal(evidence.rows_verified, 474);
  assert.equal(evidence.row_content_emitted, false);
  assert.match(evidence.dump_sha256, /^[a-f0-9]{64}$/);
  assert.ok(evidence.limitations.some((entry: string) => /Auth or Storage/.test(entry)));
});

test("incident runbook covers every private-beta emergency path", () => {
  for (const phrase of [
    "Tenant exposure",
    "Provider malfunction",
    "Bad recommendation",
    "Data restoration",
    "read_only",
    "integrations_paused",
    "emergency"
  ]) {
    assert.match(incident, new RegExp(phrase, "i"));
  }
  assert.match(recovery, /Never update or delete inventory history/i);
  assert.match(recovery, /hosted recovery exercise/i);
});
