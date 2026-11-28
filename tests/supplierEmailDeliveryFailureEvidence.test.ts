import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSupplierEmailDeliveryFailureEvidence } from "../services/domain/supplierEmailDeliveryFailureEvidence";

const migrationPath =
  "supabase/migrations/20261128140000_supplier_email_delivery_failure_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/supplier_email_delivery_failure_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/supplierEmailDeliveryFailureEvidence.ts",
  "utf8"
);
const deliveryMigration = readFileSync(
  "supabase/migrations/20260719062148_gmail_backend_oauth_delivery.sql",
  "utf8"
);

test("validateSupplierEmailDeliveryFailureEvidence rejects failed/unknown without last_error_code", () => {
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "failed",
      lastErrorCode: null,
    }),
    "missing_last_error_code"
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "failed",
      lastErrorCode: "   ",
    }),
    "missing_last_error_code"
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "unknown",
      lastErrorCode: "",
    }),
    "missing_last_error_code"
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "unknown",
    }),
    "missing_last_error_code"
  );
});

test("validateSupplierEmailDeliveryFailureEvidence accepts sending/sent and stamped failures", () => {
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "sending",
      lastErrorCode: null,
    }),
    null
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "sent",
      lastErrorCode: null,
    }),
    null
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({}),
    null
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "failed",
      lastErrorCode: "provider_rejected",
    }),
    null
  );
  assert.equal(
    validateSupplierEmailDeliveryFailureEvidence({
      status: "unknown",
      lastErrorCode: "legacy_unproven_claim",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT failure-evidence guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_supplier_email_delivery_failure_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on private\.supplier_email_deliveries[\s\S]*enforce_supplier_email_delivery_failure_evidence/
  );
  assert.match(
    migration,
    /Supplier email delivery failure evidence is required/
  );
  assert.match(migration, /new\.status in \('failed', 'unknown'\)/);
  assert.match(
    migration,
    /nullif\(btrim\(new\.last_error_code\), ''\) is null/
  );
  // No table-level NOT NULL / status-implies-error CHECK — tip stays
  // INSERT-only and preserves sending/sent rows.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+last_error_code\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,200}status\s+in\s*\(\s*'failed'[\s\S]{0,120}last_error_code\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.service_fail_supplier_email_send/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_supplier_email_delivery_failure_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_last_error_code/);
  // Column stays nullable; claim writers INSERT sending without evidence.
  assert.match(deliveryMigration, /last_error_code text check/);
  assert.match(
    deliveryMigration,
    /insert into private\.supplier_email_deliveries \([\s\S]*'sending'/
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
  assert.equal(planned, 9);
  assert.match(pgTap, /Supplier email delivery failure evidence is required/);
  assert.match(pgTap, /status = 'failed'/);
  assert.match(pgTap, /INSERT-only tip/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
