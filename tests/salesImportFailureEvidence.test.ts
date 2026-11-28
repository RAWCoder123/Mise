import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSalesImportFailureEvidence } from "../services/domain/salesImportFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128130000_sales_import_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/sales_import_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/salesImportFailureEvidence.ts",
  "utf8"
);
const salesImportsMigration = readFileSync(
  "supabase/migrations/202606210002_restaurant_ops_backbone.sql",
  "utf8"
);
const squareSyncMigration = readFileSync(
  "supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
  "utf8"
);

test("validateSalesImportFailureEvidence rejects failed rows without error_message", () => {
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "failed",
      errorMessage: null,
    }),
    "missing_error_message"
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "failed",
      errorMessage: "   ",
    }),
    "missing_error_message"
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "failed",
      errorMessage: "",
    }),
    "missing_error_message"
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "failed",
    }),
    "missing_error_message"
  );
});

test("validateSalesImportFailureEvidence accepts non-failed and stamped failed rows", () => {
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "queued",
      errorMessage: null,
    }),
    null
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "processing",
      errorMessage: null,
    }),
    null
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "completed",
      errorMessage: null,
    }),
    null
  );
  assert.equal(
    validateSalesImportFailureEvidence({}),
    null
  );
  assert.equal(
    validateSalesImportFailureEvidence({
      status: "failed",
      errorMessage: "square_token_expired",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_sales_import_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.sales_imports[\s\S]*enforce_sales_import_failure_evidence/
  );
  assert.match(migration, /Sales import failure evidence is required/);
  assert.match(migration, /new\.status = 'failed'/);
  assert.match(migration, /nullif\(btrim\(new\.error_message\), ''\) is null/);
  // No table-level NOT NULL / status-implies-error CHECK — tip stays
  // INSERT-only and preserves non-failure rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+error_message\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s*=\s*'failed'[\s\S]{0,120}error_message\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_record_square_sync_failure/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_record_square_sync_failure/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_sales_import_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_error_message/);
  // Column stays nullable; hosted failure writer already stamps evidence.
  assert.match(salesImportsMigration, /error_message text,/);
  assert.match(
    squareSyncMigration,
    /insert into public\.sales_imports \([\s\S]*error_message[\s\S]*'failed'/
  );
});

test("pgTAP plan equals assertion call sites and covers null failure insert plus UPDATE escape", () => {
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
  assert.equal(planned, 8);
  assert.match(pgTap, /Sales import failure evidence is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
