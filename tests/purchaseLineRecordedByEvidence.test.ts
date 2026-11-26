import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineRecordedByEvidence } from "../services/domain/purchaseLineRecordedByEvidence";

const migrationPath =
  "supabase/migrations/20261126200000_purchase_line_recorded_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_recorded_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseLineRecordedByEvidence.ts",
  "utf8"
);
const ledgerMigration = readFileSync(
  "supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
  "utf8"
);

test("validatePurchaseLineRecordedByEvidence rejects null, undefined, and blank recorders", () => {
  assert.equal(
    validatePurchaseLineRecordedByEvidence({ recordedBy: null }),
    "missing_recorded_by"
  );
  assert.equal(
    validatePurchaseLineRecordedByEvidence({ recordedBy: undefined }),
    "missing_recorded_by"
  );
  assert.equal(
    validatePurchaseLineRecordedByEvidence({ recordedBy: "" }),
    "missing_recorded_by"
  );
  assert.equal(
    validatePurchaseLineRecordedByEvidence({ recordedBy: "   " }),
    "missing_recorded_by"
  );
});

test("validatePurchaseLineRecordedByEvidence accepts a non-empty recorder id", () => {
  assert.equal(
    validatePurchaseLineRecordedByEvidence({ recordedBy: "user-manager-1" }),
    null
  );
});

test("additive migration pins the BEFORE INSERT recorded_by guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_recorded_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_recorded_by_evidence/
  );
  assert.match(migration, /Purchase line recorder is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(migration, /alter\s+column\s+recorded_by\s+set\s+not\s+null/i);
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}recorded_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.doesNotMatch(migration, /create or replace function public\.supersede_purchase_line/i);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.reject_purchase_line_mutation/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_line_recorded_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_recorded_by/);
  // Hosted writer already stamps auth.uid(); anonymization escape already exists.
  assert.match(ledgerMigration, /p_supersedes_line_id, auth\.uid\(\)/);
  assert.match(
    ledgerMigration,
    /old\.recorded_by is not null[\s\S]*new\.recorded_by is null/
  );
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch![1]);
  const assertionSites = [
    ...pgTap.matchAll(/^select (is|isnt|ok|matches|has_function)\(/gm)
  ].length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 8);
  assert.match(pgTap, /Purchase line recorder is required/);
  assert.match(pgTap, /recorded_by[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /ingest_purchase_lines/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
