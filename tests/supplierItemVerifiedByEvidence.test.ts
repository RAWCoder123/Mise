import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSupplierItemVerifiedByEvidence } from "../services/domain/supplierItemVerifiedByEvidence";

const migrationPath =
  "supabase/migrations/20261127170000_supplier_item_verified_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_item_verified_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/supplierItemVerifiedByEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
  "utf8"
);

test("validateSupplierItemVerifiedByEvidence rejects verified rows without verified_by", () => {
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "verified",
      verifiedBy: null,
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "verified",
      verifiedBy: "   ",
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "verified",
      verifiedBy: "",
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "verified",
    }),
    "missing_verified_by"
  );
});

test("validateSupplierItemVerifiedByEvidence accepts draft and attributed verified rows", () => {
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "draft",
      verifiedBy: null,
    }),
    null
  );
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "rejected",
      verifiedBy: null,
    }),
    null
  );
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "expired",
      verifiedBy: null,
    }),
    null
  );
  assert.equal(validateSupplierItemVerifiedByEvidence({}), null);
  assert.equal(
    validateSupplierItemVerifiedByEvidence({
      verificationStatus: "verified",
      verifiedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT verifier guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_supplier_item_verified_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.supplier_items[\s\S]*enforce_supplier_item_verified_by_evidence/
  );
  assert.match(migration, /Supplier item verifier is required/);
  assert.match(migration, /new\.verification_status = 'verified'/);
  // No table-level NOT NULL / status-implies-actor CHECK — that would
  // block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+verified_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,160}verified_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.verify_supplier_item/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_supplier_item_verified_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_verified_by/);
  // Column is nullable with ON DELETE SET NULL; status vocabulary includes verified.
  assert.match(
    foundationMigration,
    /alter table public\.supplier_items[\s\S]*verified_by uuid references auth\.users\(id\) on delete set null/
  );
  assert.match(
    foundationMigration,
    /add constraint supplier_items_verification_status_check[\s\S]*verification_status in \('draft', 'verified', 'rejected', 'expired'\)/
  );
});

test("pgTAP plan equals assertion call sites and covers null verifier plus anonymization", () => {
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
  assert.match(pgTap, /Supplier item verifier is required/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
