import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSupplierDeliveryVerifiedByEvidence } from "../services/domain/supplierDeliveryVerifiedByEvidence";

const migrationPath =
  "supabase/migrations/20261127010000_supplier_delivery_verified_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_delivery_verified_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/supplierDeliveryVerifiedByEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260802204120_operational_backend_foundation.sql",
  "utf8"
);

test("validateSupplierDeliveryVerifiedByEvidence rejects null, undefined, and blank verifiers", () => {
  assert.equal(
    validateSupplierDeliveryVerifiedByEvidence({ verifiedBy: null }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierDeliveryVerifiedByEvidence({
      verifiedBy: undefined,
    }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierDeliveryVerifiedByEvidence({ verifiedBy: "" }),
    "missing_verified_by"
  );
  assert.equal(
    validateSupplierDeliveryVerifiedByEvidence({
      verifiedBy: "   ",
    }),
    "missing_verified_by"
  );
});

test("validateSupplierDeliveryVerifiedByEvidence accepts a non-empty verifier id", () => {
  assert.equal(
    validateSupplierDeliveryVerifiedByEvidence({
      verifiedBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT verifier guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_supplier_delivery_verified_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.supplier_deliveries[\s\S]*enforce_supplier_delivery_verified_by_evidence/
  );
  assert.match(migration, /Supplier delivery verifier is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+verified_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}verified_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.record_supplier_delivery/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_supplier_delivery_verified_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_verified_by/);
  // Hosted writer already stamps auth.uid(); anonymization escape already exists.
  assert.match(
    foundationMigration,
    /insert into public\.supplier_deliveries\s*\(\s*restaurant_id, supplier_order_id, status, received_at, verified_by/
  );
  assert.match(
    foundationMigration,
    /verified_by uuid references auth\.users\(id\) on delete set null/
  );
});

test("pgTAP plan equals assertion call sites and covers null insert plus anonymization", () => {
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
  assert.match(pgTap, /Supplier delivery verifier is required/);
  assert.match(pgTap, /verified_by[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /record_supplier_delivery/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
