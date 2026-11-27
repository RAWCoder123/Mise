import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateSetupAttachmentCreatedByEvidence } from "../services/domain/setupAttachmentCreatedByEvidence";

const migrationPath =
  "supabase/migrations/20261127200000_setup_attachment_created_by_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/setup_attachment_created_by_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/setupAttachmentCreatedByEvidence.ts",
  "utf8"
);
const foundationMigration = readFileSync(
  "supabase/migrations/20260623001301_setup_persistence_observability.sql",
  "utf8"
);
const hostedWriterMigration = readFileSync(
  "supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
  "utf8"
);

test("validateSetupAttachmentCreatedByEvidence rejects null, undefined, and blank creators", () => {
  assert.equal(
    validateSetupAttachmentCreatedByEvidence({ createdBy: null }),
    "missing_created_by"
  );
  assert.equal(
    validateSetupAttachmentCreatedByEvidence({ createdBy: undefined }),
    "missing_created_by"
  );
  assert.equal(
    validateSetupAttachmentCreatedByEvidence({ createdBy: "" }),
    "missing_created_by"
  );
  assert.equal(
    validateSetupAttachmentCreatedByEvidence({ createdBy: "   " }),
    "missing_created_by"
  );
});

test("validateSetupAttachmentCreatedByEvidence accepts a non-empty creator id", () => {
  assert.equal(
    validateSetupAttachmentCreatedByEvidence({
      createdBy: "user-manager-1",
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT creator guard without a NOT NULL CHECK", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_setup_attachment_created_by_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.setup_attachments[\s\S]*enforce_setup_attachment_created_by_evidence/
  );
  assert.match(migration, /Setup attachment creator is required/);
  // No table-level NOT NULL restore — that would block auth anonymization UPDATEs.
  assert.doesNotMatch(
    migration,
    /alter\s+column\s+created_by\s+set\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /add\s+constraint\s+\w*[\s\S]{0,120}created_by\s+is\s+not\s+null/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.save_restaurant_setup/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_setup_attachment_created_by_evidence\(\)[\s\S]*service_role/
  );
  assert.match(evidence, /missing_created_by/);
  // Soft nullable creator + ON DELETE SET NULL already exist; hosted setup stamps auth.uid().
  assert.match(
    foundationMigration,
    /created_by uuid default auth\.uid\(\) references auth\.users\(id\) on delete set null/
  );
  assert.match(
    hostedWriterMigration,
    /insert into public\.setup_attachments \([\s\S]*created_by[\s\S]*auth\.uid\(\)/
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
  assert.match(pgTap, /Setup attachment creator is required/);
  assert.match(pgTap, /created_by[\s\S]*null/);
  assert.match(pgTap, /delete from auth\.users/);
  assert.match(pgTap, /save_restaurant_setup/);
  assert.match(pgTap, /pg_temp\.error_of/);
});
