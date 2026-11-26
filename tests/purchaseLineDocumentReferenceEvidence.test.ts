import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineSourceDocumentReferenceEvidence } from "../services/domain/purchaseLineSourceDocumentReferenceEvidence";

const migrationPath =
  "supabase/migrations/20261126110000_purchase_line_document_reference_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_document_reference_evidence.test.sql",
  "utf8"
);
const application = readFileSync("services/application/purchaseLines.ts", "utf8");
const evidence = readFileSync(
  "services/domain/purchaseLineSourceDocumentReferenceEvidence.ts",
  "utf8"
);

test("validatePurchaseLineSourceDocumentReferenceEvidence rejects blank and padded refs", () => {
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: null
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: undefined
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: ""
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: "   "
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: "\t\n"
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: "  INV-1  "
    }),
    "invalid_source_document_reference_shape"
  );
  assert.equal(
    validatePurchaseLineSourceDocumentReferenceEvidence({
      sourceDocumentReference: "INV-1"
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT document-reference guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_document_reference_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_document_reference_evidence/
  );
  assert.match(
    migration,
    /Purchase line source document reference must be non-blank and unpadded/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_line_document_reference_evidence\(\)[\s\S]*service_role/
  );
  assert.match(application, /validatePurchaseLineSourceDocumentReferenceEvidence/);
  assert.match(evidence, /invalid_source_document_reference_shape/);
});

test("pgTAP plan equals assertion call sites and covers forged plus legitimate paths", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch?.[1]);
  const assertionSites = (
    pgTap.match(/^select (?:is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 10);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(
    pgTap,
    /Purchase line source document reference must be non-blank and unpadded/
  );
  assert.match(pgTap, /whitespace-only source_document_reference/);
  assert.match(pgTap, /tab\/newline-only source_document_reference/);
  assert.match(pgTap, /padded source_document_reference/);
  assert.match(pgTap, /RPC blank source_document_reference still fails closed/);
  assert.match(pgTap, /RPC padded source_document_reference still trims/);
  assert.match(pgTap, /trimmed non-empty source_document_reference/);
  assert.match(pgTap, /legitimate trimmed document references remain recordable/);
});
