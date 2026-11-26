import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineSupersedeTargetEvidence } from "../services/domain/purchaseLineSupersedeTargetEvidence";

const migrationPath =
  "supabase/migrations/20261126180000_purchase_line_supersede_target_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_supersede_target_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseLineSupersedeTargetEvidence.ts",
  "utf8"
);

const target = {
  supplierId: "supplier-a",
  sourceDocumentReference: "INV-1",
  lineIndex: 0,
  lineType: "purchase" as const,
  revision: 0
};

test("validatePurchaseLineSupersedeTargetEvidence allows revision-0 rows", () => {
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: null,
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 0,
      target: null
    }),
    null
  );
});

test("validatePurchaseLineSupersedeTargetEvidence rejects missing targets", () => {
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 1,
      target: null
    }),
    "supersede_target_missing"
  );
});

test("validatePurchaseLineSupersedeTargetEvidence rejects identity forgeries", () => {
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-b",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 1,
      target
    }),
    "supersede_target_supplier_mismatch"
  );
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-OTHER",
      lineIndex: 0,
      lineType: "purchase",
      revision: 1,
      target
    }),
    "supersede_target_document_mismatch"
  );
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 1,
      lineType: "purchase",
      revision: 1,
      target
    }),
    "supersede_target_line_index_mismatch"
  );
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "credit",
      revision: 1,
      target
    }),
    "supersede_target_line_type_mismatch"
  );
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 2,
      target
    }),
    "supersede_target_revision_mismatch"
  );
});

test("validatePurchaseLineSupersedeTargetEvidence accepts identity-preserving corrections", () => {
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: "supplier-a",
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 1,
      target
    }),
    null
  );
  assert.equal(
    validatePurchaseLineSupersedeTargetEvidence({
      supersedesLineId: "line-1",
      supplierId: null,
      sourceDocumentReference: "INV-1",
      lineIndex: 0,
      lineType: "purchase",
      revision: 1,
      target: { ...target, supplierId: null }
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT supersede-target guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_supersede_target_evidence\(\)/
  );
  assert.match(
    migration,
    /create trigger purchase_lines_supersede_target_evidence/
  );
  assert.match(
    migration,
    /Purchase line correction must preserve supplier identity/
  );
  assert.match(
    migration,
    /Purchase line correction must preserve document identity/
  );
  assert.match(
    migration,
    /Purchase line correction must preserve line index/
  );
  assert.match(
    migration,
    /Purchase line correction must preserve line type/
  );
  assert.match(
    migration,
    /Purchase line correction revision must follow the superseded line/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.append_purchase_line/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.ingest_purchase_lines/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.supersede_purchase_line/
  );
  assert.doesNotMatch(migration, /not valid/i);
});

test("pgTAP plan is derived from assertion call sites", () => {
  const assertionCount = (
    pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(assertionCount, 12);
  assert.match(pgTap, /select plan\(12\);/);
  assert.match(pgTap, /direct insert rejects cross-supplier supersession/);
  assert.match(pgTap, /direct insert rejects cross-document supersession/);
  assert.match(pgTap, /direct insert rejects line-index-mismatched supersession/);
  assert.match(pgTap, /direct insert rejects line-type-mismatched supersession/);
  assert.match(
    pgTap,
    /direct insert rejects non-contiguous supersession revision/
  );
  assert.match(pgTap, /RPC supersede still accepts identity-preserving corrections/);
  assert.match(pgTap, /RPC still rejects a second supersession of the same target/);
});

test("evidence module documents the forgeable path closed by this tip", () => {
  assert.match(evidence, /Netting then treats[\s\S]*forged successor/i);
  assert.match(evidence, /supersede_target_supplier_mismatch/);
  assert.match(evidence, /supersede_target_document_mismatch/);
  assert.match(evidence, /supersede_target_revision_mismatch/);
});
